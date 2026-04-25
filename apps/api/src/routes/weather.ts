/**
 * GET /api/weather?lat=<n>&lon=<n>&units=<metric|imperial>&name=<string>&country=<string>
 *
 * Returns a normalized {@link WeatherResponse} (see SPEC.md §6). Cached for
 * 10 min in the WeatherCache DO under
 * `wx:<round4(lat)>:<round4(lon)>:<units>`. On upstream failure with a stale
 * cached entry available, returns it with `source: 'stale'`.
 *
 * `name` and `country` are forwarded from the geocoder (Open-Meteo's forecast
 * endpoint doesn't echo them) so the SPA doesn't need a second request to
 * label the response.
 *
 * The cache + upstream interplay (incl. concurrent-request coalescing) lives
 * inside the `WeatherCache` DO behind `getOrFetch` — this route just shapes
 * the resulting discriminated union into a wire response.
 */

import { Hono } from 'hono';
import { z } from 'zod';

import { getCache } from '../do/WeatherCache';
import type { Env, WeatherResponse } from '../types';

const WEATHER_TTL_MS = 10 * 60 * 1_000;

const Query = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lon: z.coerce.number().min(-180).max(180),
  units: z.enum(['metric', 'imperial']).default('metric'),
  // `name`/`country` are best-effort labels the SPA forwards from the
  // geocoder. They MUST be optional (empty string allowed) so deep links
  // like `/?lat=51.5&lon=-0.1` still resolve weather without a 400 — the
  // upstream + UI both gracefully fall back to coordinates when missing.
  name: z.string().trim().max(120).default(''),
  country: z.string().trim().max(120).default(''),
});

export const weatherRoute = new Hono<{ Bindings: Env }>().get('/', async (c) => {
  const parsed = Query.safeParse({
    lat: c.req.query('lat'),
    lon: c.req.query('lon'),
    units: c.req.query('units'),
    name: c.req.query('name'),
    country: c.req.query('country'),
  });
  if (!parsed.success) {
    return c.json({ error: 'invalid_query', issues: parsed.error.issues }, 400);
  }

  const { lat, lon, units, name, country } = parsed.data;

  const cache = getCache(c.env);
  const key = `wx:${round4(lat)}:${round4(lon)}:${units}`;

  const result = await cache.getOrFetch<WeatherResponse>({
    key,
    ttlMs: WEATHER_TTL_MS,
    kind: 'weather',
    params: { lat, lon, units, name, country },
  });

  if (result.state === 'error') {
    return c.json({ error: 'upstream_error' }, result.status);
  }

  // The stored payload always has `source: 'upstream'` and a `fetchedAt` we
  // populated when we wrote the row. Override `source` with whatever the DO
  // observed for *this* request (cache hit / fresh upstream / stale).
  return c.json({ ...result.payload, source: result.state } satisfies WeatherResponse);
});

function round4(n: number): string {
  return n.toFixed(4);
}
