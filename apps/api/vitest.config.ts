import { cloudflareTest } from '@cloudflare/vitest-pool-workers';
import { defineConfig } from 'vitest/config';

/**
 * Run vitest tests inside a workerd instance with the same bindings as
 * `wrangler dev` — so the WeatherCache Durable Object and APP_ENV are real,
 * not mocked. See SPEC.md §7.1.
 */
export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: './wrangler.test.toml' },
    }),
  ],
});
