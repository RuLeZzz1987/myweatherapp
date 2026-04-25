/**
 * Integration tests for the Hono router. Hits the worker via `SELF` (the
 * runtime exposes the Worker as a fetcher inside tests) and stubs
 * `globalThis.fetch` for outbound requests to Open-Meteo so tests are
 * deterministic and offline-safe.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SELF, env, runInDurableObject } from 'cloudflare:test';

const GEOCODE_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';

interface FetchScenario {
  matches: (url: string) => boolean;
  reply: () => Response;
}

let scenarios: FetchScenario[] = [];
let fetchSpy: ReturnType<typeof vi.spyOn> | undefined;

function mockFetch(matches: (url: string) => boolean, reply: () => Response) {
  scenarios.push({ matches, reply });
}

function jsonReply(status: number, body: unknown): Response {
  return new Response(typeof body === 'string' ? body : JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

beforeEach(async () => {
  scenarios = [];
  fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = input instanceof Request ? input.url : String(input);
    const scenario = scenarios.find((s) => s.matches(url));
    if (!scenario) {
      throw new Error(`No fetch mock matched: ${url}`);
    }
    return scenario.reply();
  });

  // Clear cache state between tests so each run starts cold.
  const id = env.WEATHER_CACHE.idFromName('cache');
  const stub = env.WEATHER_CACHE.get(id);
  await stub.fetch('https://do/purge', {
    method: 'POST',
    body: JSON.stringify({}),
  });
});

afterEach(() => {
  fetchSpy?.mockRestore();
});

describe('GET /api/health', () => {
  it('returns ok and version', async () => {
    const res = await SELF.fetch('http://test/api/health');
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, version: expect.any(String) });
  });
});

describe('GET /api/geocode', () => {
  it('rejects when q is missing', async () => {
    const res = await SELF.fetch('http://test/api/geocode');
    expect(res.status).toBe(400);
  });

  it('returns normalized hits and caches them', async () => {
    let upstreamCalls = 0;
    mockFetch(
      (url) => url.startsWith(GEOCODE_URL) && url.includes('name=Oslo'),
      () => {
        upstreamCalls += 1;
        return jsonReply(200, {
          results: [
            {
              id: 3143244,
              name: 'Oslo',
              latitude: 59.9127,
              longitude: 10.7461,
              country: 'Norway',
              country_code: 'NO',
              admin1: 'Oslo',
              timezone: 'Europe/Oslo',
            },
          ],
        });
      },
    );

    const res = await SELF.fetch('http://test/api/geocode?q=Oslo');
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      results: Array<{ name: string; countryCode: string; timezone: string; admin1?: string }>;
      source: string;
    };
    expect(body.source).toBe('upstream');
    expect(body.results).toHaveLength(1);
    expect(body.results[0]).toMatchObject({
      name: 'Oslo',
      countryCode: 'NO',
      timezone: 'Europe/Oslo',
      admin1: 'Oslo',
    });

    // Second call returns from cache without hitting upstream.
    const cached = await SELF.fetch('http://test/api/geocode?q=Oslo');
    const cachedBody = (await cached.json()) as { source: string };
    expect(cachedBody.source).toBe('cache');
    expect(upstreamCalls).toBe(1);
  });

  it('falls back to stale cache on upstream failure', async () => {
    mockFetch(
      (url) => url.startsWith(GEOCODE_URL) && url.includes('name=Berlin'),
      () =>
        jsonReply(200, {
          results: [
            {
              id: 1,
              name: 'Berlin',
              latitude: 52.52,
              longitude: 13.41,
              country: 'Germany',
              country_code: 'DE',
              timezone: 'Europe/Berlin',
            },
          ],
        }),
    );

    await SELF.fetch('http://test/api/geocode?q=Berlin');

    // Force the cached entry to be considered expired so the route re-fetches.
    const id = env.WEATHER_CACHE.idFromName('cache');
    const stub = env.WEATHER_CACHE.get(id);
    await runInDurableObject(stub, async (_instance, state) => {
      state.storage.sql.exec(
        'UPDATE entries SET expires_at = ? WHERE key LIKE ?',
        Date.now() - 60_000,
        'geo:berlin:%',
      );
    });

    // Reset upstream to fail next.
    scenarios = [
      {
        matches: (url) => url.startsWith(GEOCODE_URL),
        reply: () => new Response('', { status: 503 }),
      },
    ];

    const res = await SELF.fetch('http://test/api/geocode?q=Berlin');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { source: string };
    expect(body.source).toBe('stale');
  });
});

describe('GET /api/weather', () => {
  it('rejects when lat/lon are missing', async () => {
    const res = await SELF.fetch('http://test/api/weather');
    expect(res.status).toBe(400);
  });

  it('returns a normalized forecast and re-uses the cached copy', async () => {
    let upstreamCalls = 0;
    mockFetch(
      (url) => url.startsWith(FORECAST_URL) && url.includes('latitude=59.9127'),
      () => {
        upstreamCalls += 1;
        return jsonReply(200, sampleForecast());
      },
    );

    const res = await SELF.fetch(
      'http://test/api/weather?lat=59.9127&lon=10.7461&units=metric&name=Oslo&country=Norway',
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      source: string;
      location: { name: string; country: string; latitude: number; longitude: number };
      current: { temperature: number; isDay: boolean };
      hourly: unknown[];
      daily: unknown[];
      attribution: string;
      units: string;
    };
    expect(body.source).toBe('upstream');
    expect(body.location).toEqual({
      name: 'Oslo',
      country: 'Norway',
      latitude: 59.9127,
      longitude: 10.7461,
      timezone: 'Europe/Oslo',
    });
    expect(body.current.temperature).toBe(4.2);
    expect(body.current.isDay).toBe(true);
    expect(body.hourly).toHaveLength(2);
    expect(body.daily).toHaveLength(1);
    expect(body.attribution).toBe('Open-Meteo');
    expect(body.units).toBe('metric');

    const cached = await SELF.fetch(
      'http://test/api/weather?lat=59.9127&lon=10.7461&units=metric&name=Oslo&country=Norway',
    );
    expect(((await cached.json()) as { source: string }).source).toBe('cache');
    expect(upstreamCalls).toBe(1);
  });

  it('returns 502 when upstream fails and there is no cache', async () => {
    mockFetch(
      (url) => url.startsWith(FORECAST_URL),
      () => new Response('', { status: 500 }),
    );

    const res = await SELF.fetch('http://test/api/weather?lat=1&lon=2&units=metric');
    expect(res.status).toBe(502);
  });
});

function sampleForecast() {
  return {
    latitude: 59.9127,
    longitude: 10.7461,
    timezone: 'Europe/Oslo',
    current: {
      time: '2026-04-25T13:00',
      temperature_2m: 4.2,
      apparent_temperature: 1.1,
      relative_humidity_2m: 72,
      weather_code: 3,
      is_day: 1,
      wind_speed_10m: 12,
      wind_direction_10m: 270,
      precipitation: 0,
      precipitation_probability: 5,
      cloud_cover: 80,
      pressure_msl: 1015,
    },
    hourly: {
      time: ['2026-04-25T13:00', '2026-04-25T14:00'],
      temperature_2m: [4.2, 4.5],
      precipitation_probability: [5, 8],
      weather_code: [3, 3],
    },
    daily: {
      time: ['2026-04-25'],
      weather_code: [3],
      temperature_2m_max: [6],
      temperature_2m_min: [1],
      apparent_temperature_max: [4],
      apparent_temperature_min: [-2],
      sunrise: ['2026-04-25T05:30'],
      sunset: ['2026-04-25T20:45'],
      uv_index_max: [3],
      precipitation_sum: [0],
      precipitation_probability_max: [10],
      wind_speed_10m_max: [18],
      wind_direction_10m_dominant: [260],
    },
  };
}
