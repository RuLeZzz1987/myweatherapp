/**
 * GET /api/geocode?q=<string>&limit=<n=5>&language=<bcp47>
 *
 * Proxies Open-Meteo's geocoding endpoint with a 24h cache layer keyed on
 * `geo:<lower(q)>:<lang>:<limit>` (language affects localized fields). See
 * SPEC.md §4.1.
 *
 * The cache + upstream interplay (incl. concurrent-request coalescing) lives
 * inside the `WeatherCache` DO behind `getOrFetch` — this route just shapes
 * the resulting discriminated union into a wire response.
 */

import { Hono } from 'hono';
import { z } from 'zod';

import { getCache } from '../do/WeatherCache';
import type { Env, GeocodeResponse, GeocodeResult } from '../types';

const GEOCODE_TTL_MS = 24 * 60 * 60 * 1_000;

const Query = z.object({
  q: z.string().trim().min(1).max(120),
  limit: z.coerce.number().int().min(1).max(10).optional(),
  language: z
    .string()
    .regex(/^[a-zA-Z]{2,3}$/, 'language must be a BCP-47 primary subtag')
    .optional(),
});

/**
 * What we persist in the DO. The wire payload (`GeocodeResponse`) is just
 * this plus a non-cached `source` discriminator added on the way out.
 */
interface CachedHits {
  results: GeocodeResult[];
  cachedAt: string;
}

export const geocodeRoute = new Hono<{ Bindings: Env }>().get('/', async (c) => {
  const parsed = Query.safeParse({
    q: c.req.query('q'),
    limit: c.req.query('limit'),
    language: c.req.query('language'),
  });
  if (!parsed.success) {
    return c.json({ error: 'invalid_query', issues: parsed.error.issues }, 400);
  }

  const { q, limit = 5, language } = parsed.data;

  const cache = getCache(c.env);
  // Whitespace-collapse the query before keying so "new york" and
  // "new  york" don't fan out into two cache rows. Stays 1:1 with whatever
  // we pass to upstream (we collapse there too via the same `qNormalized`).
  const qNormalized = q.trim().replace(/\s+/g, ' ');
  const lang = (language ?? 'en').toLowerCase();
  const key = `geo:${qNormalized.toLowerCase()}:${lang}:${limit}`;

  const result = await cache.getOrFetch<CachedHits>({
    key,
    ttlMs: GEOCODE_TTL_MS,
    kind: 'geocode',
    params: {
      q: qNormalized,
      limit,
      ...(language !== undefined ? { language } : {}),
    },
  });

  if (result.state === 'error') {
    return c.json({ error: 'upstream_error' }, result.status);
  }

  return c.json({ ...result.payload, source: result.state } satisfies GeocodeResponse);
});
