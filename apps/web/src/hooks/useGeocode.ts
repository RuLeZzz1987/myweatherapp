import { keepPreviousData, useQuery, type UseQueryResult } from '@tanstack/react-query';

import { fetchGeocode } from '../lib/api/client';
import type { GeocodeResponse } from '../lib/api/types';

/**
 * SPEC §5.2 step 3 — feeds the search combobox typeahead.
 *
 * Caller is responsible for debouncing the input (see `useDebouncedValue`,
 * 250ms). This hook only worries about *what to fetch when the value
 * settles*:
 *
 *   - Disabled below 2 characters (a single letter is too noisy).
 *   - Trimmed in the queryKey so leading/trailing whitespace doesn't bust
 *     the cache.
 *   - `language` participates in the queryKey because the upstream
 *     localizes country/admin1 names per BCP-47 primary subtag — the
 *     same "ber" query in `de` vs `nb` returns the same Berlin coords
 *     but different country labels.
 *   - `keepPreviousData`: avoids a dropdown flicker between `osl` and
 *     `oslo` — the user keeps seeing the previous results until the new
 *     ones arrive.
 *   - 24h staleTime mirrors the server-side cache TTL exactly: refetching
 *     before then would just hit the DO and pay the round-trip for no
 *     new info.
 */

export interface UseGeocodeOptions {
  /**
   * BCP-47 primary subtag (e.g. `'de'`, `'nb'`). Forwarded to the upstream
   * so localized fields (country, admin1) come back in the active locale.
   */
  language?: string;
  /**
   * Max results to surface in the dropdown. Open-Meteo caps this at 10;
   * the SPEC asks for 5 to keep the typeahead readable.
   */
  limit?: number;
}

export const GEOCODE_MIN_QUERY = 2;

export function useGeocode(
  query: string,
  { language, limit = 5 }: UseGeocodeOptions = {},
): UseQueryResult<GeocodeResponse> {
  const trimmed = query.trim();
  const enabled = trimmed.length >= GEOCODE_MIN_QUERY;

  return useQuery<GeocodeResponse>({
    queryKey: ['geocode', trimmed, language ?? null, limit],
    queryFn: ({ signal }) => fetchGeocode(trimmed, { language, limit, signal }),
    enabled,
    staleTime: 24 * 60 * 60 * 1_000,
    placeholderData: keepPreviousData,
  });
}
