import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, type RenderOptions, type RenderResult } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';

/**
 * `renderWithProviders` — wraps the unit-under-test in everything App
 * normally provides (currently TanStack Query; the i18n provider is
 * implicit because `react-i18next` reads from a singleton `i18next`
 * instance imported by `src/i18n/index.ts`).
 *
 * Each call gets a fresh QueryClient so cached data from one test never
 * influences another. Retries are off + queries don't refetch on focus
 * to keep test output deterministic.
 */
function buildClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

export interface RenderWithProvidersOptions extends Omit<RenderOptions, 'wrapper'> {
  client?: QueryClient;
}

export function renderWithProviders(
  ui: ReactElement,
  { client, ...options }: RenderWithProvidersOptions = {},
): RenderResult & { client: QueryClient } {
  const queryClient = client ?? buildClient();
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  const result = render(ui, { wrapper: Wrapper, ...options });
  return { ...result, client: queryClient };
}
