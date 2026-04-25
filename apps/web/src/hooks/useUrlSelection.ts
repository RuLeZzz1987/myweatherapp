import { useCallback, useEffect, useState } from 'react';

import type { GeocodeResult } from '../lib/api/types';

/**
 * URL is the source of truth for the currently-displayed location, so that:
 *   - Refresh / share-link survives selection.
 *   - Browser back/forward steps through previous searches.
 *   - Integration tests can deep-link into a city without going through the
 *     search flow.
 *
 * The shape carried in the URL is a subset of {@link GeocodeResult}: the
 * minimum needed to call `/api/weather`. `lat`, `lon` are rounded to 4
 * decimals to match the worker's cache-key resolution (~11m).
 *
 * Keys:
 *   `lat`, `lon`        — required pair, signal "selection set"
 *   `name`, `country`   — optional, used to label the response
 *   `id`                — optional, lets us rehydrate the matching recent
 *                         entry if the user shares a link
 *
 * `lang` is owned by `i18n/index.ts` and intentionally not touched here.
 */

export interface UrlSelection {
  id?: string;
  lat: number;
  lon: number;
  name: string;
  country: string;
  countryCode?: string;
  timezone?: string;
}

export function selectionFromGeocode(r: GeocodeResult): UrlSelection {
  return {
    id: r.id,
    lat: r.latitude,
    lon: r.longitude,
    name: r.name,
    country: r.country,
    countryCode: r.countryCode,
    timezone: r.timezone,
  };
}

function readUrl(): UrlSelection | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  if (!params.has('lat') || !params.has('lon')) return null;
  const lat = Number(params.get('lat'));
  const lon = Number(params.get('lon'));
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;

  const name = params.get('name') ?? '';
  const country = params.get('country') ?? '';
  const id = params.get('id') ?? undefined;
  const countryCode = params.get('cc') ?? undefined;
  return { id, lat, lon, name, country, countryCode };
}

/** All search-param keys this hook owns; cleared in `applyToUrl` first. */
const URL_KEYS = ['id', 'lat', 'lon', 'name', 'country', 'cc'] as const;

/**
 * Mutate `url`'s search params to reflect `s`. Removes every key this
 * hook owns first so going from a populated selection to `null` clears
 * everything. Caller decides whether to commit via push/replaceState.
 */
function applyToUrl(url: URL, s: UrlSelection | null): void {
  for (const k of URL_KEYS) url.searchParams.delete(k);
  if (!s) return;
  if (s.id) url.searchParams.set('id', s.id);
  url.searchParams.set('lat', s.lat.toFixed(4));
  url.searchParams.set('lon', s.lon.toFixed(4));
  if (s.name) url.searchParams.set('name', s.name);
  if (s.country) url.searchParams.set('country', s.country);
  if (s.countryCode) url.searchParams.set('cc', s.countryCode);
}

/**
 * Build the next URL string for `s`, preserving any unrelated params
 * already on the page (e.g. `?lang=de`). Returns `null` in non-browser
 * contexts (SSR/test harness) so the caller can short-circuit.
 */
function nextUrlFor(s: UrlSelection | null): string | null {
  if (typeof window === 'undefined') return null;
  const url = new URL(window.location.href);
  applyToUrl(url, s);
  return url.toString();
}

export interface UseUrlSelectionResult {
  selection: UrlSelection | null;
  setSelection: (s: UrlSelection | null, opts?: { push?: boolean }) => void;
}

export function useUrlSelection(): UseUrlSelectionResult {
  const [selection, setLocal] = useState<UrlSelection | null>(() => readUrl());

  useEffect(() => {
    function onPop() {
      setLocal(readUrl());
    }
    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
    };
  }, []);

  const setSelection = useCallback((s: UrlSelection | null, opts?: { push?: boolean }) => {
    setLocal(s);
    const next = nextUrlFor(s);
    if (next === null) return;
    // pushState leaves a back-stop; we only do that when an explicit
    // user action (recent-card click, search-result click) wants the
    // browser back button to walk the selection history. Otherwise
    // replaceState keeps the URL fresh without polluting history.
    if (opts?.push) {
      window.history.pushState(null, '', next);
    } else {
      window.history.replaceState(window.history.state, '', next);
    }
  }, []);

  return { selection, setSelection };
}
