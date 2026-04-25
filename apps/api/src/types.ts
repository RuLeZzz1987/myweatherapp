/**
 * MyWeather — shared types between routes, the upstream client, and the
 * Durable Object cache. Mirrors the public API contract documented in
 * SPEC.md §6 (with the upstream Open-Meteo free tier as the source of truth
 * for which fields exist).
 */

export type Units = 'metric' | 'imperial';

export interface GeocodeResult {
  id: string;
  name: string;
  country: string;
  countryCode: string;
  admin1?: string;
  latitude: number;
  longitude: number;
  timezone: string;
}

export interface WeatherCurrent {
  time: string;
  temperature: number;
  apparentTemperature: number;
  humidity: number;
  windSpeed: number;
  windDirection: number;
  precipitation: number;
  precipitationProbability?: number;
  cloudCover: number;
  pressureMsl: number;
  weatherCode: number;
  isDay: boolean;
}

export interface WeatherHourly {
  time: string;
  /** Anchor field — entries with a null upstream temperature are dropped. */
  temperature: number;
  /**
   * Open-Meteo can null this out when the precipitation model lacks
   * coverage. UI should render "—" or hide the badge rather than
   * displaying 0%.
   */
  precipitationProbability: number | null;
  weatherCode: number;
}

export interface WeatherDaily {
  date: string;
  weatherCode: number;
  /** Anchor — entries with null max OR min are dropped. */
  tempMax: number;
  /** Anchor — entries with null max OR min are dropped. */
  tempMin: number;
  apparentTempMax: number;
  apparentTempMin: number;
  sunrise: string;
  sunset: string;
  /** Null near the poles in winter / when the model has no UV signal. */
  uvIndexMax: number | null;
  precipitationSum: number;
  /** Null when the model lacks precipitation coverage for the day. */
  precipitationProbabilityMax: number | null;
  windSpeedMax: number;
  windDirectionDominant: number;
}

export interface WeatherResponse {
  location: {
    name: string;
    country: string;
    latitude: number;
    longitude: number;
    timezone: string;
  };
  units: Units;
  current: WeatherCurrent;
  hourly: WeatherHourly[];
  daily: WeatherDaily[];
  fetchedAt: string;
  source: 'cache' | 'upstream' | 'stale';
  attribution: 'Open-Meteo';
}

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
