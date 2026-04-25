import type { GeocodeResponse, Units, WeatherResponse } from './types';

/**
 * Thin fetch wrapper for the MyWeather Worker API. We deliberately stay at
 * `fetch` instead of pulling in axios/ky — payloads are small, retries are
 * handled by TanStack Query, and the Worker never asks for cookies or
 * non-trivial headers.
 *
 * URLs are relative (`/api/...`) so the same code works in:
 *   - Vite dev (Vite proxies `/api/*` → `wrangler dev` on :8787)
 *   - Production (the same Worker serves /api and the SPA)
 *   - Tests (jsdom resolves `/api/...` against `http://localhost:3000`,
 *     and MSW intercepts it).
 */

export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

interface ErrorBody {
  error?: string;
  message?: string;
}

async function readError(res: Response, fallback: string): Promise<ApiError> {
  let body: ErrorBody = {};
  try {
    body = (await res.json()) as ErrorBody;
  } catch {
    // Response had no JSON body (e.g. 504 from a proxy) — keep the empty
    // shape and lean on the fallback message.
  }
  return new ApiError(body.message ?? fallback, res.status, body.error);
}

export interface FetchGeocodeOptions {
  language?: string;
  limit?: number;
  signal?: AbortSignal;
}

export async function fetchGeocode(
  q: string,
  { language, limit, signal }: FetchGeocodeOptions = {},
): Promise<GeocodeResponse> {
  const params = new URLSearchParams({ q });
  if (language) params.set('language', language);
  if (limit && limit > 0) params.set('limit', String(limit));

  const res = await fetch(`/api/geocode?${params.toString()}`, {
    signal,
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    throw await readError(res, `Geocoding failed (${res.status})`);
  }
  return (await res.json()) as GeocodeResponse;
}

export interface FetchWeatherArgs {
  lat: number;
  lon: number;
  units: Units;
  name?: string;
  country?: string;
  signal?: AbortSignal;
}

export async function fetchWeather({
  lat,
  lon,
  units,
  name,
  country,
  signal,
}: FetchWeatherArgs): Promise<WeatherResponse> {
  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lon),
    units,
  });
  if (name) params.set('name', name);
  if (country) params.set('country', country);

  const res = await fetch(`/api/weather?${params.toString()}`, {
    signal,
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    throw await readError(res, `Weather request failed (${res.status})`);
  }
  return (await res.json()) as WeatherResponse;
}
