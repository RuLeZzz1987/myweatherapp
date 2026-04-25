import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

import { useGeocode } from '../useGeocode';
import { server } from '../../../test/server';

/**
 * Each test gets a fresh QueryClient so cached results from one test
 * don't satisfy queries in the next one. Retries are off so an
 * intentionally-failing fixture surfaces immediately.
 */
function buildWrapper() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false, gcTime: 0 },
    },
  });
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  return { client, Wrapper };
}

describe('useGeocode', () => {
  beforeEach(() => {
    server.resetHandlers();
  });
  afterEach(() => {
    server.resetHandlers();
  });

  it('stays disabled below the minimum query length', () => {
    const { Wrapper } = buildWrapper();
    const { result } = renderHook(() => useGeocode('o'), { wrapper: Wrapper });

    expect(result.current.fetchStatus).toBe('idle');
    expect(result.current.data).toBeUndefined();
  });

  it('fetches results for a valid query', async () => {
    const { Wrapper } = buildWrapper();
    const { result } = renderHook(() => useGeocode('osl'), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data?.results).toHaveLength(1);
    expect(result.current.data?.results[0]?.name).toBe('Oslo');
    expect(result.current.data?.source).toBe('upstream');
  });

  it('returns an empty array (not an error) when the geocoder finds nothing', async () => {
    const { Wrapper } = buildWrapper();
    const { result } = renderHook(() => useGeocode('noresults'), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data?.results).toEqual([]);
  });

  it('surfaces upstream 5xx as an error state', async () => {
    const { Wrapper } = buildWrapper();
    const { result } = renderHook(() => useGeocode('boom'), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(result.current.error).toBeInstanceOf(Error);
  });

  it('forwards `language` so localized country names flow through', async () => {
    let capturedLanguage: string | null = null;
    server.use(
      http.get('*/api/geocode', ({ request }) => {
        const url = new URL(request.url);
        capturedLanguage = url.searchParams.get('language');
        return HttpResponse.json({
          results: [],
          cachedAt: new Date('2026-01-01').toISOString(),
          source: 'upstream',
        });
      }),
    );

    const { Wrapper } = buildWrapper();
    const { result } = renderHook(() => useGeocode('berlin', { language: 'nb' }), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(capturedLanguage).toBe('nb');
  });

  it('keeps previous data while a new query is loading', async () => {
    const { Wrapper } = buildWrapper();
    const { result, rerender } = renderHook(({ q }: { q: string }) => useGeocode(q), {
      wrapper: Wrapper,
      initialProps: { q: 'osl' },
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data?.results[0]?.name).toBe('Oslo');

    rerender({ q: 'ber' });
    // The Oslo data should still be visible while Berlin is in flight.
    expect(result.current.data?.results[0]?.name).toBe('Oslo');

    await waitFor(() => {
      expect(result.current.data?.results[0]?.name).toBe('Berlin');
    });
  });
});
