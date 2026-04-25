/**
 * GET /api/geocode?q=<string>&limit=<n=5>&language=<bcp47>
 *
 * Proxies Open-Meteo's geocoding endpoint with a 24h cache layer keyed on
 * `geo:<lower(q)>:<lang>` (language affects localized fields). See SPEC.md
 * §4.1.
 */

import { Hono } from 'hono';
import { z } from 'zod';

import { getCache } from '../do/WeatherCache';
import type { GeocodeResult } from '../types';
import type { Env } from '../types';
import { UpstreamError, geocode } from '../upstream/openMeteo';

const GEOCODE_TTL_MS = 24 * 60 * 60 * 1_000;

const Query = z.object({
  q: z.string().trim().min(1).max(120),
  limit: z.coerce.number().int().min(1).max(10).optional(),
  language: z
    .string()
    .regex(/^[a-zA-Z]{2,3}$/, 'language must be a BCP-47 primary subtag')
    .optional(),
});

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
  const lang = (language ?? 'en').toLowerCase();
  const key = `geo:${q.toLowerCase()}:${lang}:${limit}`;

  const cached = await cache.get<CachedHits>(key);
  if (cached.hit && cached.payload) {
    return c.json({ ...cached.payload, source: 'cache' as const });
  }

  try {
    const results = await geocode(q, {
      ...(language !== undefined ? { language } : {}),
      limit,
    });
    const payload: CachedHits = { results, cachedAt: new Date().toISOString() };
    await cache.set(key, payload, GEOCODE_TTL_MS);

    return c.json({ ...payload, source: 'upstream' as const });
  } catch (err) {
    if (cached.payload) {
      return c.json({ ...cached.payload, source: 'stale' as const });
    }
    if (err instanceof UpstreamError) {
      return c.json(
        { error: 'upstream_error', message: err.message },
        err.status === 504 ? 504 : 502,
      );
    }
    return c.json({ error: 'internal' }, 500);
  }
});
