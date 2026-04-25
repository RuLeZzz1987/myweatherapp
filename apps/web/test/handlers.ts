import { http, HttpResponse } from 'msw';

import type { GeocodeResponse, GeocodeResult, Units, WeatherResponse } from '../src/lib/api/types';

/**
 * MSW handlers — the test counterpart to the Worker's `/api/*` routes.
 *
 * We mirror the response shape exactly (results + cachedAt + source) so
 * both production and tests exercise the same parsing path. Specific
 * input strings are reserved as fixtures so individual tests can ask for
 * the case they want without re-defining handlers each time:
 *
 *   - `osl` / `oslo` → 1 result (Oslo, NO)
 *   - `ber` / `berlin` → 1 result (Berlin, DE)
 *   - `paris` → 2 results (Paris, FR + Paris, US-TX)
 *   - `noresults` → empty list (200)
 *   - `slow` → 200 with a small delay (for testing pending state)
 *   - `boom` → 502 ApiError
 *   - `unauth` → 401 (covered by the no-retry-on-4xx queryClient default)
 *
 * Tests that need bespoke behaviour can `server.use(...)` to override.
 */

const oslo: GeocodeResult = {
  id: '3143244',
  name: 'Oslo',
  country: 'Norway',
  countryCode: 'NO',
  latitude: 59.9139,
  longitude: 10.7522,
  timezone: 'Europe/Oslo',
};

const berlin: GeocodeResult = {
  id: '2950159',
  name: 'Berlin',
  country: 'Germany',
  countryCode: 'DE',
  latitude: 52.52,
  longitude: 13.405,
  timezone: 'Europe/Berlin',
};

const parisFR: GeocodeResult = {
  id: '2988507',
  name: 'Paris',
  country: 'France',
  countryCode: 'FR',
  latitude: 48.8566,
  longitude: 2.3522,
  timezone: 'Europe/Paris',
};

const parisTX: GeocodeResult = {
  id: '4717560',
  name: 'Paris',
  country: 'United States',
  countryCode: 'US',
  admin1: 'Texas',
  latitude: 33.6609,
  longitude: -95.5555,
  timezone: 'America/Chicago',
};

function ok(results: GeocodeResult[]): GeocodeResponse {
  return {
    results,
    cachedAt: new Date('2026-01-01T00:00:00Z').toISOString(),
    source: 'upstream',
  };
}

const FIXTURES: Record<string, GeocodeResult[]> = {
  osl: [oslo],
  oslo: [oslo],
  ber: [berlin],
  berlin: [berlin],
  paris: [parisFR, parisTX],
  noresults: [],
};

// ---------------------------------------------------------------------------
// Weather fixtures
// ---------------------------------------------------------------------------

interface WeatherSeed {
  geocode: GeocodeResult;
  metric: { temperature: number; weatherCode: number; isDay: boolean };
}

const WEATHER_SEEDS: WeatherSeed[] = [
  { geocode: oslo, metric: { temperature: 8, weatherCode: 3, isDay: true } },
  { geocode: berlin, metric: { temperature: 12, weatherCode: 2, isDay: true } },
  { geocode: parisFR, metric: { temperature: 14, weatherCode: 1, isDay: true } },
];

function buildWeather(seed: WeatherSeed, units: Units): WeatherResponse {
  // Crude °C → °F so the test fixture is internally consistent. The
  // worker normally sends the right unit upstream; we mirror that here
  // without touching real arithmetic.
  const tempC = seed.metric.temperature;
  const temperature = units === 'metric' ? tempC : Math.round(tempC * (9 / 5) + 32);
  const apparentTemperature = temperature - 1;
  const tempMax = temperature + 4;
  const tempMin = temperature - 4;

  return {
    location: {
      name: seed.geocode.name,
      country: seed.geocode.country,
      latitude: seed.geocode.latitude,
      longitude: seed.geocode.longitude,
      timezone: seed.geocode.timezone,
    },
    units,
    current: {
      time: '2026-04-25T12:00',
      temperature,
      apparentTemperature,
      humidity: 60,
      windSpeed: units === 'metric' ? 12 : 7,
      windDirection: 220,
      precipitation: 0,
      precipitationProbability: 10,
      cloudCover: seed.metric.weatherCode === 1 ? 30 : 70,
      pressureMsl: 1015,
      weatherCode: seed.metric.weatherCode,
      isDay: seed.metric.isDay,
    },
    hourly: Array.from({ length: 24 }).map((_, i) => ({
      time: `2026-04-25T${String(i).padStart(2, '0')}:00`,
      temperature: temperature + (i % 5),
      precipitationProbability: i % 4 === 0 ? 30 : 0,
      weatherCode: seed.metric.weatherCode,
    })),
    daily: Array.from({ length: 7 }).map((_, i) => ({
      date: `2026-04-${String(25 + i).padStart(2, '0')}`,
      weatherCode: seed.metric.weatherCode,
      tempMax,
      tempMin,
      apparentTempMax: tempMax - 1,
      apparentTempMin: tempMin - 1,
      sunrise: `2026-04-${String(25 + i).padStart(2, '0')}T05:30`,
      sunset: `2026-04-${String(25 + i).padStart(2, '0')}T20:45`,
      uvIndexMax: 4,
      precipitationSum: 0,
      precipitationProbabilityMax: 20,
      windSpeedMax: units === 'metric' ? 18 : 11,
      windDirectionDominant: 220,
    })),
    fetchedAt: new Date('2026-04-25T12:00:00Z').toISOString(),
    source: 'upstream',
    attribution: 'Open-Meteo',
  };
}

function findSeedByLatLon(lat: number, lon: number): WeatherSeed | undefined {
  return WEATHER_SEEDS.find(
    (s) => Math.abs(s.geocode.latitude - lat) < 0.05 && Math.abs(s.geocode.longitude - lon) < 0.05,
  );
}

export const handlers = [
  http.get('*/api/geocode', async ({ request }) => {
    const url = new URL(request.url);
    const q = (url.searchParams.get('q') ?? '').trim().toLowerCase();

    if (q === 'boom') {
      return HttpResponse.json(
        { error: 'upstream_error', message: 'Upstream temporarily unavailable' },
        { status: 502 },
      );
    }
    if (q === 'unauth') {
      return HttpResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
    if (q === 'slow') {
      await new Promise((r) => setTimeout(r, 50));
      return HttpResponse.json(ok([oslo]));
    }
    return HttpResponse.json(ok(FIXTURES[q] ?? []));
  }),

  http.get('*/api/weather', async ({ request }) => {
    const url = new URL(request.url);
    const lat = Number(url.searchParams.get('lat'));
    const lon = Number(url.searchParams.get('lon'));
    const units = (url.searchParams.get('units') ?? 'metric') as Units;
    const name = url.searchParams.get('name') ?? '';

    if (name === 'boom' || Number.isNaN(lat) || Number.isNaN(lon)) {
      return HttpResponse.json(
        { error: 'upstream_error', message: 'Upstream weather error' },
        { status: 502 },
      );
    }

    const seed = findSeedByLatLon(lat, lon);
    if (!seed) {
      return HttpResponse.json(
        buildWeather(
          {
            geocode: { ...oslo, name: name || oslo.name, latitude: lat, longitude: lon },
            metric: { temperature: 10, weatherCode: 3, isDay: true },
          },
          units,
        ),
      );
    }
    return HttpResponse.json(buildWeather(seed, units));
  }),
];
