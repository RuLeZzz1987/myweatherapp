import { keepPreviousData, useQuery, type UseQueryResult } from '@tanstack/react-query';

import { fetchWeather } from '../lib/api/client';
import type { Units, WeatherResponse } from '../lib/api/types';

/**
 * SPEC §5.2 step 4 — drives the hero, hourly strip, daily strip, and
 * secondary-stats panel. Single source of truth for "weather for the
 * currently-selected city".
 *
 * Disabled when no selection is set (the empty/landing state). Round-trips
 * through the worker, which short-circuits to the WeatherCache DO when the
 * 10-min TTL hasn't expired (`source: 'cache'`) or returns the previously
 * fetched payload with `source: 'stale'` if the upstream is unreachable —
 * the UI displays cache freshness from the response, not by guessing.
 *
 * Caching strategy:
 *   - `staleTime: 5 min`  — half the worker's 10-min TTL, so we don't
 *     refetch immediately after a tab refocus on a payload we already
 *     have.
 *   - `gcTime: 30 min`     — keeps an LRU set of recently-viewed cities
 *     warm in memory, so toggling between recents in the strip doesn't
 *     replay network requests.
 *   - `keepPreviousData`   — switching cities flashes the previous hero
 *     while the new one loads, instead of an empty skeleton.
 */

export interface UseWeatherSelection {
  lat: number;
  lon: number;
  name?: string;
  country?: string;
}

export function useWeather(
  selection: UseWeatherSelection | null,
  units: Units,
): UseQueryResult<WeatherResponse> {
  const enabled = !!selection;

  return useQuery<WeatherResponse>({
    queryKey: enabled
      ? [
          'weather',
          // Round to match worker key resolution; otherwise tiny float drift
          // re-fetches what the DO would have served from cache anyway.
          selection.lat.toFixed(4),
          selection.lon.toFixed(4),
          units,
        ]
      : ['weather', 'idle'],
    queryFn: ({ signal }) =>
      fetchWeather({
        lat: selection!.lat,
        lon: selection!.lon,
        units,
        ...(selection!.name ? { name: selection!.name } : {}),
        ...(selection!.country ? { country: selection!.country } : {}),
        signal,
      }),
    enabled,
    staleTime: 5 * 60 * 1_000,
    gcTime: 30 * 60 * 1_000,
    placeholderData: keepPreviousData,
  });
}
