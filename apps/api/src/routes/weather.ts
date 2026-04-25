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
 */

import { Hono } from 'hono';
import { z } from 'zod';

import { getCache } from '../do/WeatherCache';
import type { Env, WeatherResponse } from '../types';
import { UpstreamError, forecast } from '../upstream/openMeteo';

const WEATHER_TTL_MS = 10 * 60 * 1_000;

const Query = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lon: z.coerce.number().min(-180).max(180),
  units: z.enum(['metric', 'imperial']).default('metric'),
  name: z.string().trim().min(1).max(120).default(''),
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

  const cached = await cache.get<WeatherResponse>(key);
  if (cached.hit && cached.payload) {
    return c.json({ ...cached.payload, source: 'cache' as const } satisfies WeatherResponse);
  }

  try {
    const fresh = await forecast(lat, lon, name, country, { units });
    const response: WeatherResponse = {
      ...fresh,
      fetchedAt: new Date().toISOString(),
      source: 'upstream',
    };
    await cache.set(key, response, WEATHER_TTL_MS);
    return c.json(response);
  } catch (err) {
    if (cached.payload) {
      return c.json({ ...cached.payload, source: 'stale' as const } satisfies WeatherResponse);
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

function round4(n: number): string {
  return n.toFixed(4);
}
