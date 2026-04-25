import { QueryCache, QueryClient } from '@tanstack/react-query';

import { ApiError } from './api/client';
import { reportQueryError } from './sentry';

/**
 * Single TanStack Query client for the whole app — see SPEC.md §5.3.
 *
 * Defaults are tuned for our two query types:
 *   - Geocode: results barely change for a given string, so `staleTime`
 *     is 24h and we keep previous data while typeahead refetches.
 *   - Weather (added in §10 step 8): server caches at 10min, so a 60s
 *     client-side `staleTime` is plenty.
 *
 * Common to both:
 *   - Refetch-on-focus is on so a user revisiting the tab gets fresh data
 *     without an explicit reload.
 *   - 4xx errors are NOT retried (a bad query won't get better with a
 *     retry); transient 5xx / network errors get one retry.
 *   - 5xx / network errors after retries exhaust are forwarded to Sentry
 *     via `reportQueryError` (no-op when `VITE_SENTRY_DSN` is unset).
 */
export function createQueryClient(): QueryClient {
  const queryCache = new QueryCache({
    onError: (error, query) => {
      const area = inferArea(query.queryKey);
      if (!area) return;
      reportQueryError(error, { area, queryKey: query.queryKey });
    },
  });

  return new QueryClient({
    queryCache,
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        gcTime: 30 * 60_000,
        refetchOnWindowFocus: true,
        retry: (failureCount, error) => {
          if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
            return false;
          }
          return failureCount < 1;
        },
      },
    },
  });
}

function inferArea(queryKey: readonly unknown[]): 'weather' | 'geocode' | null {
  const head = queryKey[0];
  if (head === 'weather') return 'weather';
  if (head === 'geocode') return 'geocode';
  return null;
}
