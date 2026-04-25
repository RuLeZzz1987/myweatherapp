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

function writeUrl(s: UrlSelection | null): void {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  const KEYS = ['id', 'lat', 'lon', 'name', 'country', 'cc'] as const;
  for (const k of KEYS) url.searchParams.delete(k);

  if (s) {
    if (s.id) url.searchParams.set('id', s.id);
    url.searchParams.set('lat', s.lat.toFixed(4));
    url.searchParams.set('lon', s.lon.toFixed(4));
    if (s.name) url.searchParams.set('name', s.name);
    if (s.country) url.searchParams.set('country', s.country);
    if (s.countryCode) url.searchParams.set('cc', s.countryCode);
  }
  // replaceState — we don't want every click to push a history entry that
  // leaves a "back to no-selection" stop. We use pushState only when the
  // caller explicitly asks (via setSelection's `push` arg).
  window.history.replaceState(window.history.state, '', url.toString());
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
    if (opts?.push && typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      const KEYS = ['id', 'lat', 'lon', 'name', 'country', 'cc'] as const;
      for (const k of KEYS) url.searchParams.delete(k);
      if (s) {
        if (s.id) url.searchParams.set('id', s.id);
        url.searchParams.set('lat', s.lat.toFixed(4));
        url.searchParams.set('lon', s.lon.toFixed(4));
        if (s.name) url.searchParams.set('name', s.name);
        if (s.country) url.searchParams.set('country', s.country);
        if (s.countryCode) url.searchParams.set('cc', s.countryCode);
      }
      window.history.pushState(null, '', url.toString());
      return;
    }
    writeUrl(s);
  }, []);

  return { selection, setSelection };
}
