/**
 * MyWeather wire contracts — single source of truth for the JSON shapes
 * exchanged between `@myweather/api` (the Cloudflare Worker) and
 * `@myweather/web` (the SPA).
 *
 * Both apps depend on this package via pnpm workspaces; importing it on
 * either side is a normal `import type { … } from '@myweather/contracts'`,
 * with no project references / build-step gymnastics. See SPEC.md §6.
 *
 * If a field is missing on the upstream Open-Meteo response we don't
 * invent it — see SPEC §4.3 for the field-by-field treatment.
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

export interface GeocodeResponse {
  results: GeocodeResult[];
  cachedAt: string;
  source: 'cache' | 'upstream' | 'stale';
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
