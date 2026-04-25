/**
 * Typed Open-Meteo client. Pure functions, no Worker/DO dependencies — so
 * unit-testable in isolation and easy to reason about. Validation runs
 * through Zod so a malformed upstream response surfaces as a clean error
 * rather than crashing downstream.
 *
 * Endpoints + parameters per SPEC.md §4.3.
 */

import { z } from 'zod';

import type {
  GeocodeResult,
  Units,
  WeatherCurrent,
  WeatherDaily,
  WeatherHourly,
  WeatherResponse,
} from '../types';

/** Default per-request budget. Open-Meteo is fast — 5s is generous. */
const UPSTREAM_TIMEOUT_MS = 5_000;

// ---------------------------------------------------------------------------
// Geocoding
// ---------------------------------------------------------------------------

const GeocodeUpstreamSchema = z.object({
  results: z
    .array(
      z.object({
        id: z.number(),
        name: z.string(),
        latitude: z.number(),
        longitude: z.number(),
        country: z.string().optional(),
        country_code: z.string().optional(),
        admin1: z.string().optional(),
        timezone: z.string().optional(),
      }),
    )
    .optional(),
});

export interface GeocodeOptions {
  /** BCP-47 primary subtag — Open-Meteo localizes admin1/country when set. */
  language?: string;
  /** 1..10. */
  limit?: number;
  /** Override fetch (used in tests). */
  fetcher?: typeof fetch;
  /** Override AbortController signal (timeout fallback if not provided). */
  signal?: AbortSignal;
}

export async function geocode(q: string, options: GeocodeOptions = {}): Promise<GeocodeResult[]> {
  const limit = clamp(options.limit ?? 5, 1, 10);
  const url = new URL('https://geocoding-api.open-meteo.com/v1/search');
  url.searchParams.set('name', q);
  url.searchParams.set('count', String(limit));
  url.searchParams.set('format', 'json');
  if (options.language) url.searchParams.set('language', options.language);

  const json = await fetchJson(url, options);
  const parsed = GeocodeUpstreamSchema.parse(json);

  return (parsed.results ?? []).map((r): GeocodeResult => {
    const base = {
      id: String(r.id),
      name: r.name,
      country: r.country ?? '',
      countryCode: (r.country_code ?? '').toUpperCase(),
      latitude: r.latitude,
      longitude: r.longitude,
      timezone: r.timezone ?? 'UTC',
    };
    return r.admin1 ? { ...base, admin1: r.admin1 } : base;
  });
}

// ---------------------------------------------------------------------------
// Forecast
// ---------------------------------------------------------------------------

const NumArr = z.array(z.number().nullable());
const StrArr = z.array(z.string());
// Open-Meteo legitimately returns `null` entries in `daily.sunrise` /
// `daily.sunset` during polar night / polar day at high latitudes
// (e.g. Tromsø in January — well within our supported coverage area).
// The mapper collapses null to '' so the UI can render "—".
const NullableStrArr = z.array(z.string().nullable());

const ForecastUpstreamSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  timezone: z.string(),
  current: z.object({
    time: z.string(),
    temperature_2m: z.number(),
    apparent_temperature: z.number(),
    relative_humidity_2m: z.number(),
    weather_code: z.number(),
    is_day: z.number(),
    wind_speed_10m: z.number(),
    wind_direction_10m: z.number(),
    precipitation: z.number(),
    precipitation_probability: z.number().optional(),
    cloud_cover: z.number(),
    pressure_msl: z.number(),
  }),
  hourly: z.object({
    time: StrArr,
    temperature_2m: NumArr,
    precipitation_probability: NumArr,
    weather_code: NumArr,
  }),
  daily: z.object({
    time: StrArr,
    weather_code: NumArr,
    temperature_2m_max: NumArr,
    temperature_2m_min: NumArr,
    apparent_temperature_max: NumArr,
    apparent_temperature_min: NumArr,
    sunrise: NullableStrArr,
    sunset: NullableStrArr,
    uv_index_max: NumArr,
    precipitation_sum: NumArr,
    precipitation_probability_max: NumArr,
    wind_speed_10m_max: NumArr,
    wind_direction_10m_dominant: NumArr,
  }),
});

export interface ForecastOptions {
  units: Units;
  fetcher?: typeof fetch;
  signal?: AbortSignal;
}

/**
 * Fetch current + 24h hourly + 7d daily forecast in one call. Returns the
 * normalized {@link WeatherResponse} minus `fetchedAt`/`source` fields,
 * which the caller (route handler) fills in based on cache state.
 */
export async function forecast(
  lat: number,
  lon: number,
  locationName: string,
  country: string,
  options: ForecastOptions,
): Promise<Omit<WeatherResponse, 'fetchedAt' | 'source'>> {
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', String(lat));
  url.searchParams.set('longitude', String(lon));
  url.searchParams.set(
    'current',
    [
      'temperature_2m',
      'apparent_temperature',
      'relative_humidity_2m',
      'weather_code',
      'is_day',
      'wind_speed_10m',
      'wind_direction_10m',
      'precipitation',
      'precipitation_probability',
      'cloud_cover',
      'pressure_msl',
    ].join(','),
  );
  url.searchParams.set(
    'hourly',
    ['temperature_2m', 'precipitation_probability', 'weather_code'].join(','),
  );
  url.searchParams.set(
    'daily',
    [
      'weather_code',
      'temperature_2m_max',
      'temperature_2m_min',
      'apparent_temperature_max',
      'apparent_temperature_min',
      'sunrise',
      'sunset',
      'uv_index_max',
      'precipitation_sum',
      'precipitation_probability_max',
      'wind_speed_10m_max',
      'wind_direction_10m_dominant',
    ].join(','),
  );
  url.searchParams.set('timezone', 'auto');
  url.searchParams.set('temperature_unit', options.units === 'metric' ? 'celsius' : 'fahrenheit');
  url.searchParams.set('wind_speed_unit', options.units === 'metric' ? 'kmh' : 'mph');
  url.searchParams.set('precipitation_unit', options.units === 'metric' ? 'mm' : 'inch');
  url.searchParams.set('forecast_days', '7');

  const json = await fetchJson(url, options);
  const parsed = ForecastUpstreamSchema.parse(json);

  const current: WeatherCurrent = {
    time: parsed.current.time,
    temperature: parsed.current.temperature_2m,
    apparentTemperature: parsed.current.apparent_temperature,
    humidity: parsed.current.relative_humidity_2m,
    windSpeed: parsed.current.wind_speed_10m,
    windDirection: parsed.current.wind_direction_10m,
    precipitation: parsed.current.precipitation,
    ...(parsed.current.precipitation_probability !== undefined
      ? { precipitationProbability: parsed.current.precipitation_probability }
      : {}),
    cloudCover: parsed.current.cloud_cover,
    pressureMsl: parsed.current.pressure_msl,
    weatherCode: parsed.current.weather_code,
    isDay: parsed.current.is_day === 1,
  };

  // Open-Meteo can null individual indices when a model lacks data for a
  // given hour/day. We refuse to invent numbers (zero would render
  // confidently as "0°C" / "0 mm" — see SPEC §4.3 "no fabrication").
  // Strategy:
  //   - If the *anchor* metric (hourly: temperature, daily: tempMax/Min)
  //     is null we drop the slot entirely.
  //   - Optional metrics that legitimately go null (probability, UV)
  //     surface as `null` and are rendered as "—" by the UI.
  //   - Remaining gaps fall back to a sibling metric (e.g. apparentTemp
  //     -> temp) or a sane neutral default with a comment.
  const hourly: WeatherHourly[] = parsed.hourly.time.flatMap((time, i) => {
    const temp = parsed.hourly.temperature_2m[i];
    if (temp == null) return [];
    const code = parsed.hourly.weather_code[i];
    const slot: WeatherHourly = {
      time,
      temperature: temp,
      precipitationProbability: parsed.hourly.precipitation_probability[i] ?? null,
      // Code 3 ("overcast") is the least-misleading neutral when the
      // upstream model omits a code — it doesn't imply any active
      // precipitation or extreme condition.
      weatherCode: code ?? 3,
    };
    return [slot];
  });

  const daily: WeatherDaily[] = parsed.daily.time.flatMap((date, i) => {
    const tmax = parsed.daily.temperature_2m_max[i];
    const tmin = parsed.daily.temperature_2m_min[i];
    if (tmax == null || tmin == null) return [];
    const code = parsed.daily.weather_code[i];
    const slot: WeatherDaily = {
      date,
      weatherCode: code ?? 3,
      tempMax: tmax,
      tempMin: tmin,
      apparentTempMax: parsed.daily.apparent_temperature_max[i] ?? tmax,
      apparentTempMin: parsed.daily.apparent_temperature_min[i] ?? tmin,
      sunrise: parsed.daily.sunrise[i] ?? '',
      sunset: parsed.daily.sunset[i] ?? '',
      uvIndexMax: parsed.daily.uv_index_max[i] ?? null,
      precipitationSum: parsed.daily.precipitation_sum[i] ?? 0,
      precipitationProbabilityMax: parsed.daily.precipitation_probability_max[i] ?? null,
      windSpeedMax: parsed.daily.wind_speed_10m_max[i] ?? 0,
      windDirectionDominant: parsed.daily.wind_direction_10m_dominant[i] ?? 0,
    };
    return [slot];
  });

  return {
    location: {
      name: locationName,
      country,
      latitude: parsed.latitude,
      longitude: parsed.longitude,
      timezone: parsed.timezone,
    },
    units: options.units,
    current,
    hourly,
    daily,
    attribution: 'Open-Meteo',
  };
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

async function fetchJson(
  url: URL,
  options: { fetcher?: typeof fetch; signal?: AbortSignal },
): Promise<unknown> {
  const fetcher = options.fetcher ?? fetch;
  // Compose caller's signal (if any) with our own timeout so whichever fires
  // first cancels the request.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  const onAbort = () => controller.abort();
  // If the upstream signal is *already* aborted by the time we get here,
  // the 'abort' event has already fired and addEventListener will never
  // notify us — propagate the abort eagerly instead.
  if (options.signal?.aborted) {
    controller.abort();
  } else {
    options.signal?.addEventListener('abort', onAbort, { once: true });
  }

  try {
    const res = await fetcher(url.toString(), { signal: controller.signal });
    if (!res.ok) {
      throw new UpstreamError(`Open-Meteo ${res.status}`, res.status);
    }
    return await res.json();
  } catch (err) {
    if (err instanceof UpstreamError) throw err;
    if ((err as { name?: string }).name === 'AbortError') {
      throw new UpstreamError('Open-Meteo request aborted', 504);
    }
    throw new UpstreamError(`Open-Meteo fetch failed: ${(err as Error).message}`, 502);
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener('abort', onAbort);
  }
}

export class UpstreamError extends Error {
  override readonly name = 'UpstreamError';
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}
