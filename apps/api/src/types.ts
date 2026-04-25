/**
 * Worker-local types. The wire contract (Units / GeocodeResult /
 * WeatherCurrent / WeatherHourly / WeatherDaily / WeatherResponse) lives
 * in `@myweather/contracts` and is shared with the SPA so both halves of
 * the app type-check against the exact same response shape. We re-export
 * those here so existing `'../types'` imports keep working without
 * bouncing through the workspace package name.
 */

export type {
  Units,
  GeocodeResult,
  GeocodeResponse,
  WeatherCurrent,
  WeatherHourly,
  WeatherDaily,
  WeatherResponse,
} from '@myweather/contracts';

/**
 * Worker runtime bindings. Mirrors `apps/api/wrangler.toml`.
 * The Durable Object namespace is typed against the concrete class so
 * `idFromName` etc. carry through.
 */
export interface Env {
  WEATHER_CACHE: DurableObjectNamespace;
  ASSETS: Fetcher;
  APP_ENV: string;
}
