/**
 * Augments `Cloudflare.Env` with our actual bindings so `env.WEATHER_CACHE`
 * is properly typed when imported from `cloudflare:test` / `cloudflare:workers`.
 *
 * Mirrors `apps/api/src/types.ts` `Env`. Wrangler 4 generates this file
 * automatically; we hand-write it because we don't run `wrangler types` as
 * a build step.
 */

export {};

declare global {
  namespace Cloudflare {
    interface Env {
      WEATHER_CACHE: DurableObjectNamespace;
      ASSETS: Fetcher;
      APP_ENV: string;
    }
  }
}

declare module 'cloudflare:workers' {
  // ProvidedEnv controls the shape of `env` exported from `cloudflare:workers`.
  // We deliberately mirror Cloudflare.Env here rather than declaring extra
  // bindings.
  type ProvidedEnv = Cloudflare.Env;
}
