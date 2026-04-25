/**
 * MyWeather — Cloudflare Worker entry point.
 *
 * Scaffolding stub. Routes (`/api/geocode`, `/api/weather`), the
 * `WeatherCache` Durable Object, and the Open-Meteo upstream client
 * are added in SPEC.md §10 step 3.
 */

export interface Env {
  // Bound in wrangler.toml — see SPEC.md §4.5.
  WEATHER_CACHE: DurableObjectNamespace;
  ASSETS: Fetcher;
  APP_ENV: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/api/health') {
      return Response.json({ ok: true, env: env.APP_ENV ?? 'development' });
    }

    if (url.pathname.startsWith('/api/')) {
      return Response.json({ error: 'not_implemented' }, { status: 501 });
    }

    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;

export class WeatherCache implements DurableObject {
  // Real implementation lands in step 3 (SQLite-backed cache, GC alarm).
  // Constructor intentionally minimal; bindings will be wired up then.
  async fetch(_request: Request): Promise<Response> {
    return Response.json({ error: 'not_implemented' }, { status: 501 });
  }
}
