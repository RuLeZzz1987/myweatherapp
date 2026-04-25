import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

import { useWeather } from '../useWeather';
import { server } from '../../../test/server';

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

const oslo = { lat: 59.9139, lon: 10.7522, name: 'Oslo', country: 'Norway' };
const berlin = { lat: 52.52, lon: 13.405, name: 'Berlin', country: 'Germany' };

describe('useWeather', () => {
  beforeEach(() => {
    server.resetHandlers();
  });
  afterEach(() => {
    server.resetHandlers();
  });

  it('stays idle when selection is null', () => {
    const { Wrapper } = buildWrapper();
    const { result } = renderHook(() => useWeather(null, 'metric'), { wrapper: Wrapper });
    expect(result.current.fetchStatus).toBe('idle');
    expect(result.current.data).toBeUndefined();
  });

  it('fetches weather for a selection', async () => {
    const { Wrapper } = buildWrapper();
    const { result } = renderHook(() => useWeather(oslo, 'metric'), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data?.location.name).toBe('Oslo');
    expect(result.current.data?.units).toBe('metric');
    expect(result.current.data?.current.temperature).toBe(8);
  });

  it('forwards units to the worker', async () => {
    let capturedUnits: string | null = null;
    server.use(
      http.get('*/api/weather', ({ request }) => {
        const url = new URL(request.url);
        capturedUnits = url.searchParams.get('units');
        return HttpResponse.json({
          location: { name: 'Stub', country: 'X', latitude: 0, longitude: 0, timezone: 'UTC' },
          units: 'imperial',
          current: {
            time: '2026-01-01T00:00',
            temperature: 50,
            apparentTemperature: 50,
            humidity: 50,
            windSpeed: 5,
            windDirection: 0,
            precipitation: 0,
            cloudCover: 0,
            pressureMsl: 1013,
            weatherCode: 0,
            isDay: true,
          },
          hourly: [],
          daily: [],
          fetchedAt: new Date().toISOString(),
          source: 'upstream',
          attribution: 'Open-Meteo',
        });
      }),
    );

    const { Wrapper } = buildWrapper();
    const { result } = renderHook(() => useWeather(oslo, 'imperial'), { wrapper: Wrapper });
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(capturedUnits).toBe('imperial');
  });

  it('surfaces a 502 as an error state', async () => {
    const { Wrapper } = buildWrapper();
    const { result } = renderHook(() => useWeather({ ...oslo, name: 'boom' }, 'metric'), {
      wrapper: Wrapper,
    });
    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });

  it('keeps previous data while switching cities', async () => {
    const { Wrapper } = buildWrapper();
    const { result, rerender } = renderHook(
      ({ s }: { s: typeof oslo }) => useWeather(s, 'metric'),
      { wrapper: Wrapper, initialProps: { s: oslo } },
    );
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data?.location.name).toBe('Oslo');

    rerender({ s: berlin });
    expect(result.current.data?.location.name).toBe('Oslo');

    await waitFor(() => {
      expect(result.current.data?.location.name).toBe('Berlin');
    });
  });
});
