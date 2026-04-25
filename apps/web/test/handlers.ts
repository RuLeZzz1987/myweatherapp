import { http, HttpResponse } from 'msw';

import type { GeocodeResponse, GeocodeResult } from '../src/lib/api/types';

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
];
