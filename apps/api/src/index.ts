/**
 * MyWeather — Cloudflare Worker entry point.
 *
 * Single Worker that serves both the SPA (via the Static Assets binding)
 * and the JSON `/api/*` surface defined in SPEC.md §4.
 */

import { Hono } from 'hono';

import { geocodeRoute } from './routes/geocode';
import { weatherRoute } from './routes/weather';
import type { Env } from './types';

export { WeatherCache } from './do/WeatherCache';

const VERSION = '0.1.0';

const api = new Hono<{ Bindings: Env }>()
  .get('/health', (c) => c.json({ ok: true, version: VERSION, env: c.env.APP_ENV }))
  .route('/geocode', geocodeRoute)
  .route('/weather', weatherRoute)
  .notFound((c) => c.json({ error: 'not_found' }, 404))
  .onError((err, c) => {
    console.error('API error:', err);
    return c.json({ error: 'internal', message: err.message }, 500);
  });

const app = new Hono<{ Bindings: Env }>().route('/api', api);

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/api')) {
      return app.fetch(request, env, ctx);
    }

    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;

export type { Env } from './types';
