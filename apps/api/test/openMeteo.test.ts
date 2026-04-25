/**
 * Unit tests for the Open-Meteo upstream client (SPEC §7.1). The client
 * is intentionally pure (no Worker / DO bindings, just a `fetcher`
 * dependency) so we drive it with a stub fetcher and a fixture JSON.
 *
 * Coverage targets:
 *   - geocode(): happy path, missing optional fields, upstream non-200.
 *   - forecast(): happy path mapping, null-anchor slot dropping for
 *     hourly + daily, null sunrise/sunset survival (polar night),
 *     `is_day` numeric → boolean, optional `precipitation_probability`,
 *     `apparent_temperature_max ?? tmax` fallback, upstream non-200.
 */

import { describe, expect, it } from 'vitest';

import { forecast, geocode, UpstreamError } from '../src/upstream/openMeteo';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function stubFetcher(reply: Response | ((url: string) => Response)): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    // Honour the AbortSignal so tests that pass an aborted signal
    // exercise the real reject-as-AbortError code path the production
    // `fetch` would take.
    if (init?.signal?.aborted) {
      const err = new Error('Aborted');
      (err as { name?: string }).name = 'AbortError';
      throw err;
    }
    const url = input instanceof Request ? input.url : String(input);
    return typeof reply === 'function' ? reply(url) : reply;
  }) as typeof fetch;
}

// ---------------------------------------------------------------------------
// geocode()
// ---------------------------------------------------------------------------

describe('geocode()', () => {
  it('maps upstream hits to GeocodeResult shape', async () => {
    const fetcher = stubFetcher(
      jsonResponse(200, {
        results: [
          {
            id: 3143244,
            name: 'Oslo',
            latitude: 59.9127,
            longitude: 10.7461,
            country: 'Norway',
            country_code: 'no',
            admin1: 'Oslo',
            timezone: 'Europe/Oslo',
          },
        ],
      }),
    );
    const hits = await geocode('Oslo', { fetcher, language: 'en' });
    expect(hits).toEqual([
      {
        id: '3143244',
        name: 'Oslo',
        country: 'Norway',
        countryCode: 'NO', // upper-cased
        latitude: 59.9127,
        longitude: 10.7461,
        admin1: 'Oslo',
        timezone: 'Europe/Oslo',
      },
    ]);
  });

  it('omits admin1 when missing and defaults country/countryCode/timezone', async () => {
    const fetcher = stubFetcher(
      jsonResponse(200, {
        results: [
          { id: 1, name: 'Atlantis', latitude: 0, longitude: 0 }, // no country, no tz, no admin1
        ],
      }),
    );
    const hits = await geocode('Atlantis', { fetcher });
    expect(hits).toHaveLength(1);
    expect(hits[0]).toEqual({
      id: '1',
      name: 'Atlantis',
      country: '',
      countryCode: '',
      latitude: 0,
      longitude: 0,
      timezone: 'UTC',
    });
    expect('admin1' in hits[0]!).toBe(false);
  });

  it('returns an empty array when upstream omits `results`', async () => {
    const fetcher = stubFetcher(jsonResponse(200, {}));
    expect(await geocode('Nowhere', { fetcher })).toEqual([]);
  });

  it('throws UpstreamError(502) on non-200 upstream', async () => {
    const fetcher = stubFetcher(new Response('boom', { status: 503 }));
    await expect(geocode('Boom', { fetcher })).rejects.toMatchObject({
      name: 'UpstreamError',
      status: 503,
    });
  });

  it('surfaces aborted upstream as 504', async () => {
    const ac = new AbortController();
    ac.abort();
    await expect(
      geocode('Nope', { fetcher: stubFetcher(new Response()), signal: ac.signal }),
    ).rejects.toBeInstanceOf(UpstreamError);
  });
});

// ---------------------------------------------------------------------------
// forecast()
// ---------------------------------------------------------------------------

interface ForecastJson {
  latitude: number;
  longitude: number;
  timezone: string;
  current: Record<string, number | string>;
  hourly: Record<string, Array<string | number | null>>;
  daily: Record<string, Array<string | number | null>>;
}

function sampleForecast(): ForecastJson {
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
      time: ['2026-04-25T13:00', '2026-04-25T14:00', '2026-04-25T15:00'],
      temperature_2m: [4.2, 4.5, null],
      precipitation_probability: [5, null, 8],
      weather_code: [3, 3, 3],
    },
    daily: {
      time: ['2026-04-25', '2026-04-26'],
      weather_code: [3, 3],
      temperature_2m_max: [6, 7],
      temperature_2m_min: [1, 2],
      apparent_temperature_max: [4, null], // exercise tmax fallback
      apparent_temperature_min: [-2, null], // exercise tmin fallback
      sunrise: ['2026-04-25T05:30', null], // polar-night-style null
      sunset: [null, '2026-04-26T20:47'], // polar-day-style null
      uv_index_max: [3, null],
      precipitation_sum: [0, 0],
      precipitation_probability_max: [10, null],
      wind_speed_10m_max: [18, 16],
      wind_direction_10m_dominant: [260, 240],
    },
  };
}

describe('forecast()', () => {
  it('maps the upstream payload to WeatherResponse shape', async () => {
    const fetcher = stubFetcher(jsonResponse(200, sampleForecast()));
    const out = await forecast(59.9127, 10.7461, 'Oslo', 'Norway', { fetcher, units: 'metric' });

    expect(out.location).toEqual({
      name: 'Oslo',
      country: 'Norway',
      latitude: 59.9127,
      longitude: 10.7461,
      timezone: 'Europe/Oslo',
    });
    expect(out.units).toBe('metric');
    expect(out.attribution).toBe('Open-Meteo');

    expect(out.current).toMatchObject({
      time: '2026-04-25T13:00',
      temperature: 4.2,
      apparentTemperature: 1.1,
      humidity: 72,
      windSpeed: 12,
      windDirection: 270,
      precipitation: 0,
      precipitationProbability: 5,
      cloudCover: 80,
      pressureMsl: 1015,
      weatherCode: 3,
      isDay: true, // is_day === 1 → true
    });
  });

  it('drops hourly slots whose anchor temperature is null', async () => {
    const fetcher = stubFetcher(jsonResponse(200, sampleForecast()));
    const out = await forecast(59.9127, 10.7461, 'Oslo', 'Norway', { fetcher, units: 'metric' });

    // The fixture has temperature_2m = [4.2, 4.5, null]; the third slot drops.
    expect(out.hourly).toHaveLength(2);
    expect(out.hourly.map((h) => h.time)).toEqual(['2026-04-25T13:00', '2026-04-25T14:00']);
    // precipitation_probability null → null on the wire (NOT 0).
    expect(out.hourly[1]?.precipitationProbability).toBeNull();
  });

  it('preserves null daily.uvIndexMax / precipitationProbabilityMax', async () => {
    const fetcher = stubFetcher(jsonResponse(200, sampleForecast()));
    const out = await forecast(59.9127, 10.7461, 'Oslo', 'Norway', { fetcher, units: 'metric' });

    expect(out.daily).toHaveLength(2);
    expect(out.daily[1]?.uvIndexMax).toBeNull();
    expect(out.daily[1]?.precipitationProbabilityMax).toBeNull();
  });

  it('survives null sunrise/sunset (polar night) — collapses to empty string', async () => {
    // Regression for M-3: an earlier StrArr = z.array(z.string()) made
    // ForecastUpstreamSchema.parse() throw on null sunrise/sunset and
    // turn the whole call into a 502 for high-latitude locations.
    const fetcher = stubFetcher(jsonResponse(200, sampleForecast()));
    const out = await forecast(69.65, 18.96, 'Tromsø', 'Norway', { fetcher, units: 'metric' });

    expect(out.daily[0]?.sunset).toBe(''); // upstream null → ''
    expect(out.daily[1]?.sunrise).toBe(''); // upstream null → ''
    // Non-null sibling values still pass through verbatim.
    expect(out.daily[0]?.sunrise).toBe('2026-04-25T05:30');
    expect(out.daily[1]?.sunset).toBe('2026-04-26T20:47');
  });

  it('falls back apparentTempMax/Min to tempMax/tempMin when null', async () => {
    const fetcher = stubFetcher(jsonResponse(200, sampleForecast()));
    const out = await forecast(59.9127, 10.7461, 'Oslo', 'Norway', { fetcher, units: 'metric' });

    // Day 1: apparent_temperature_max = null → falls back to tempMax (7).
    // Day 1: apparent_temperature_min = null → falls back to tempMin (2).
    expect(out.daily[1]?.apparentTempMax).toBe(7);
    expect(out.daily[1]?.apparentTempMin).toBe(2);
  });

  it('drops daily slots whose anchor tempMax or tempMin is null', async () => {
    const payload = sampleForecast();
    payload.daily.temperature_2m_max = [6, null];
    payload.daily.temperature_2m_min = [1, 2];
    const fetcher = stubFetcher(jsonResponse(200, payload));
    const out = await forecast(59.9127, 10.7461, 'Oslo', 'Norway', { fetcher, units: 'metric' });
    expect(out.daily.map((d) => d.date)).toEqual(['2026-04-25']);
  });

  it('omits current.precipitationProbability when upstream omits it', async () => {
    const payload = sampleForecast();
    delete payload.current.precipitation_probability;
    const fetcher = stubFetcher(jsonResponse(200, payload));
    const out = await forecast(59.9127, 10.7461, 'Oslo', 'Norway', { fetcher, units: 'metric' });

    expect('precipitationProbability' in out.current).toBe(false);
  });

  it('throws UpstreamError on non-200 upstream', async () => {
    const fetcher = stubFetcher(new Response('500', { status: 500 }));
    await expect(forecast(0, 0, '', '', { fetcher, units: 'metric' })).rejects.toMatchObject({
      name: 'UpstreamError',
      status: 500,
    });
  });

  it('respects an already-aborted signal on entry', async () => {
    // Regression for L-4: an aborted-on-entry signal previously slipped
    // through because addEventListener('abort', ...) was registered after
    // the underlying event had already fired.
    const ac = new AbortController();
    ac.abort();
    const fetcher = stubFetcher(jsonResponse(200, sampleForecast()));
    await expect(
      forecast(0, 0, '', '', { fetcher, units: 'metric', signal: ac.signal }),
    ).rejects.toBeInstanceOf(UpstreamError);
  });
});
