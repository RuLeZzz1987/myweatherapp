import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';

import { AppHeader } from './components/AppHeader';
import { AttributionFooter } from './components/AttributionFooter';
import { CurrentWeatherHero } from './components/CurrentWeatherHero';
import { DailyForecast } from './components/DailyForecast';
import { EmptyState } from './components/EmptyState';
import { ErrorState } from './components/ErrorState';
import { HourlyForecast } from './components/HourlyForecast';
import { LiveRegion } from './components/LiveRegion';
import { OfflineBanner } from './components/OfflineBanner';
import { RecentSearches, type RecentCardSnapshot } from './components/RecentSearches';
import { SecondaryStats } from './components/SecondaryStats';
import { WeatherSkeleton } from './components/WeatherSkeleton';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { useWeather } from './hooks/useWeather';
import { selectionFromGeocode, useUrlSelection, type UrlSelection } from './hooks/useUrlSelection';
import type { GeocodeResult, WeatherResponse } from './lib/api/types';
import { usePrefs } from './store/prefs';

/**
 * SPEC §5.6 primary view. Three regions:
 *   1. AppHeader (brand + units toggle + language picker + search)
 *   2. Main: empty-state copy on first load → CurrentWeatherHero once
 *      a city is selected
 *   3. Recent-searches strip below the hero, with snapshots from the
 *      TanStack Query cache so each card reflects the latest data
 *      we've already seen for that city
 *   4. AttributionFooter at the bottom
 *
 * The URL is the source of truth for the active selection so refresh /
 * share-link survives. Selection updates also push the city onto the
 * recent-searches list (capped 5, deduped by upstream id).
 */

function App() {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? i18n.language ?? 'en';
  const queryClient = useQueryClient();

  const units = usePrefs((s) => s.units);
  const recents = usePrefs((s) => s.recentSearches);
  const pushRecentSearch = usePrefs((s) => s.pushRecentSearch);
  const removeRecentSearch = usePrefs((s) => s.removeRecentSearch);

  const { selection, setSelection } = useUrlSelection();
  const online = useOnlineStatus();

  const weatherQuery = useWeather(
    selection
      ? {
          lat: selection.lat,
          lon: selection.lon,
          ...(selection.name ? { name: selection.name } : {}),
          ...(selection.country ? { country: selection.country } : {}),
        }
      : null,
    units,
  );

  // When a deep-linked selection (URL only carries lat/lon/name) lands
  // its first weather payload, promote it onto the recents strip so a
  // shared link backfills the card. We don't bump position on every
  // refetch — the explicit selection handlers below own ordering.
  const weatherData = weatherQuery.data;
  useEffect(() => {
    if (!selection || !weatherData) return;
    if (recents.some((r) => r.id === selection.id)) return;
    const fromSelection = inferGeocodeFromSelectionAndWeather(selection, weatherData);
    if (!fromSelection) return;
    pushRecentSearch(fromSelection);
  }, [selection, weatherData, recents, pushRecentSearch]);

  function handleCitySelect(result: GeocodeResult) {
    pushRecentSearch(result);
    setSelection(selectionFromGeocode(result), { push: true });
  }

  function handleRecentSelect(geocode: GeocodeResult) {
    pushRecentSearch(geocode);
    setSelection(selectionFromGeocode(geocode), { push: true });
  }

  // Read each recent city's last-seen weather from the TanStack Query
  // cache so the strip shows live numbers instead of placeholders. We
  // never fetch on its behalf — that would multiply network requests
  // every time `recents` re-orders. `dataUpdatedAt` is included as a
  // "tick" so when a refetch lands the memo runs again and the active
  // card picks up the new temperature.
  const dataTick = weatherQuery.dataUpdatedAt;
  const recentCards = useMemo<RecentCardSnapshot[]>(() => {
    void dataTick;
    return recents.map((g) => {
      const cached = queryClient.getQueryData<WeatherResponse>([
        'weather',
        g.latitude.toFixed(4),
        g.longitude.toFixed(4),
        units,
      ]);
      return {
        geocode: g,
        ...(cached
          ? {
              temperature: cached.current.temperature,
              weatherCode: cached.current.weatherCode,
              isDay: cached.current.isDay,
            }
          : {}),
      };
    });
  }, [recents, units, queryClient, dataTick]);

  const cityLabel = useMemo(() => {
    if (weatherQuery.data) {
      const { name, country } = weatherQuery.data.location;
      return country ? `${name}, ${country}` : name;
    }
    if (selection) {
      return selection.country ? `${selection.name}, ${selection.country}` : selection.name || null;
    }
    return null;
  }, [weatherQuery.data, selection]);

  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-surface-strong focus:px-3 focus:py-2 focus:text-sm focus:text-text"
      >
        {t('app.skipToContent')}
      </a>

      <main
        id="main"
        aria-label={t('app.main')}
        className="mx-auto flex min-h-svh max-w-5xl flex-col gap-8 px-6 py-6"
      >
        <AppHeader onCitySelect={handleCitySelect} />

        <OfflineBanner online={online} />

        <LiveRegion
          // Parent supplies `key` so each fresh announcement is a
          // remount — see LiveRegion.tsx for why setting key on the
          // returned JSX wouldn't survive memoization.
          key={`${liveRegionStatus(weatherQuery)}:${weatherQuery.dataUpdatedAt}`}
          cityLabel={cityLabel}
          status={liveRegionStatus(weatherQuery)}
        />

        <section className="flex flex-1 flex-col gap-8">
          {weatherQuery.data ? (
            <>
              <CurrentWeatherHero
                weather={weatherQuery.data}
                locale={locale}
                preferredUnits={units}
              />
              <SecondaryStats weather={weatherQuery.data} units={units} locale={locale} />
              <HourlyForecast weather={weatherQuery.data} locale={locale} />
              <DailyForecast weather={weatherQuery.data} locale={locale} />
            </>
          ) : selection && weatherQuery.isError ? (
            <ErrorState
              error={weatherQuery.error}
              online={online}
              cityLabel={cityLabel ?? undefined}
              onRetry={() => {
                void weatherQuery.refetch();
              }}
            />
          ) : selection ? (
            <WeatherSkeleton cityLabel={cityLabel ?? undefined} />
          ) : (
            <EmptyState />
          )}

          <RecentSearches
            cards={recentCards}
            units={units}
            locale={locale}
            activeId={selection?.id ?? null}
            onSelect={handleRecentSelect}
            onRemove={removeRecentSearch}
          />
        </section>

        <AttributionFooter />
      </main>
    </>
  );
}

function liveRegionStatus(
  query: ReturnType<typeof useWeather>,
): 'idle' | 'loading' | 'success' | 'error' {
  if (query.isError) return 'error';
  if (query.isFetching && !query.data) return 'loading';
  if (query.data) return 'success';
  return 'idle';
}

/**
 * URL deep-links may carry less than a full GeocodeResult (someone
 * shared `/?lat=…&lon=…` only). Once the weather payload lands we can
 * synthesize a record good enough to live on the recents strip.
 */
function inferGeocodeFromSelectionAndWeather(
  selection: UrlSelection,
  weather: WeatherResponse,
): GeocodeResult | null {
  const id =
    selection.id ??
    `${weather.location.latitude.toFixed(4)}:${weather.location.longitude.toFixed(4)}`;
  return {
    id,
    name: selection.name || weather.location.name || '',
    country: selection.country || weather.location.country || '',
    countryCode: selection.countryCode ?? '',
    latitude: weather.location.latitude,
    longitude: weather.location.longitude,
    timezone: selection.timezone ?? weather.location.timezone,
  };
}

export default App;
