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

/**
 * Baseline security headers applied to every response (API JSON + static
 * SPA assets). Kept conservative because the app has no auth, no third-
 * party iframes, and only ever talks to its own `/api/*` surface — so
 * tightening these doesn't block any feature.
 *
 *   - HSTS: 1y, includeSubDomains. Our `*.workers.dev` host is HTTPS-only
 *     anyway; this just hints to browsers to never downgrade.
 *   - X-Content-Type-Options: nosniff. JSON shouldn't be sniffed as HTML
 *     and the SPA's `text/html` doesn't need MIME guessing.
 *   - X-Frame-Options: DENY. We never embed ourselves in an iframe.
 *   - Referrer-Policy: strict-origin-when-cross-origin. No referrer leak
 *     into Open-Meteo when the SPA's <a href> targets external links.
 *   - Permissions-Policy: deny geolocation/camera/mic by default. The
 *     "use my location" flow is a future-spec item (see SPEC §5.2); when
 *     that lands we'll relax `geolocation=()` to `geolocation=(self)`.
 *   - X-Permitted-Cross-Domain-Policies: none. Locks down legacy Flash /
 *     Acrobat cross-domain probes — cheap insurance.
 *
 * CSP is intentionally NOT set here: Vite ships a SPA bundle with hashed
 * inline-style attributes (Tailwind v4 + React component styles) and
 * inline module preloads, so any non-trivial `style-src`/`script-src`
 * would break the build. Adding CSP would need a build-time nonce/hash
 * pipeline; the cost-vs-benefit doesn't pencil out for a public,
 * read-only weather UI. Documented in SPEC.md §11.
 */
const SECURITY_HEADERS: Readonly<Record<string, string>> = Object.freeze({
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'geolocation=(), camera=(), microphone=()',
  'X-Permitted-Cross-Domain-Policies': 'none',
});

function applySecurityHeaders(res: Response): Response {
  // `env.ASSETS.fetch()` returns immutable responses on Workers, so we
  // clone instead of mutating in place. For Hono responses this is a no-
  // op cost — we already build them fresh per request.
  const merged = new Headers(res.headers);
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) {
    if (!merged.has(k)) merged.set(k, v);
  }
  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers: merged,
  });
}

const api = new Hono<{ Bindings: Env }>()
  // /health intentionally only exposes the build version. We used to
  // include `env: APP_ENV` here, but a public health probe is the wrong
  // place to leak runtime metadata — `wrangler tail` and the dashboard
  // already cover internal observability.
  .get('/health', (c) => c.json({ ok: true, version: VERSION }))
  .route('/geocode', geocodeRoute)
  .route('/weather', weatherRoute)
  .notFound((c) => c.json({ error: 'not_found' }, 404))
  .onError((err, c) => {
    // Log everything we know server-side (Cloudflare's tail keeps the stack
    // for a few hours), but never echo `err.message` to the public response —
    // those strings can carry stack-frame names, env identifiers, or even
    // upstream payload fragments depending on what threw.
    console.error('API error:', err);
    return c.json({ error: 'internal' }, 500);
  });

const app = new Hono<{ Bindings: Env }>().route('/api', api);

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    const res = url.pathname.startsWith('/api')
      ? await app.fetch(request, env, ctx)
      : await env.ASSETS.fetch(request);

    return applySecurityHeaders(res);
  },
} satisfies ExportedHandler<Env>;

export type { Env } from './types';
