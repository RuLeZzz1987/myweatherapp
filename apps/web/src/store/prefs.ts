import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

import { isSupportedLocale, type SupportedLocale } from '../i18n/supportedLocales';
import type { GeocodeResult } from '../lib/api/types';

/**
 * UI preferences — see SPEC.md §5.3.
 *
 * The slice owns three concerns:
 *   1. Units (°C / °F). Default is metric for every currently-supported
 *      locale (SPEC §5.8); the header toggle lets the user override and
 *      the choice persists across reloads.
 *   2. Language override. Boot-time language detection lives in
 *      `i18n/index.ts` (URL > localStorage > navigator > en); once the user
 *      picks via the header picker, that choice is mirrored here so any
 *      component can read it without subscribing to i18next directly. The
 *      i18next side stays the source of truth for *active* language; this
 *      slice records the *user's stated preference* so we can distinguish
 *      "browser detected nb" from "user chose nb".
 *   3. Recent searches: deduped by upstream id, capped at 5, ordered
 *      most-recent-first. Used by the recent-searches strip on the home
 *      view and as a reload-survivor for the URL deep-link.
 *
 * Persisted under `myweather:prefs` (versioned for future migrations).
 */

export type Units = 'metric' | 'imperial';

export const RECENT_SEARCHES_LIMIT = 5;

export interface PrefsState {
  units: Units;
  languageOverride: SupportedLocale | null;
  recentSearches: GeocodeResult[];

  setUnits: (u: Units) => void;
  toggleUnits: () => void;
  setLanguageOverride: (l: SupportedLocale | null) => void;
  pushRecentSearch: (r: GeocodeResult) => void;
  removeRecentSearch: (id: string) => void;
  clearRecentSearches: () => void;
}

const STORAGE_KEY = 'myweather:prefs';
const STORAGE_VERSION = 2;

function isLikelyGeocode(value: unknown): value is GeocodeResult {
  if (!value || typeof value !== 'object') return false;
  const v = value as Partial<GeocodeResult>;
  return (
    typeof v.id === 'string' &&
    typeof v.name === 'string' &&
    typeof v.latitude === 'number' &&
    typeof v.longitude === 'number'
  );
}

function dedupeAndCap(list: readonly GeocodeResult[]): GeocodeResult[] {
  const seen = new Set<string>();
  const out: GeocodeResult[] = [];
  for (const item of list) {
    if (!isLikelyGeocode(item)) continue;
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    out.push(item);
    if (out.length >= RECENT_SEARCHES_LIMIT) break;
  }
  return out;
}

export const usePrefs = create<PrefsState>()(
  persist(
    (set) => ({
      units: 'metric',
      languageOverride: null,
      recentSearches: [],

      setUnits: (units) => {
        set({ units });
      },
      toggleUnits: () => {
        set((s) => ({ units: s.units === 'metric' ? 'imperial' : 'metric' }));
      },
      setLanguageOverride: (languageOverride) => {
        set({ languageOverride });
      },
      pushRecentSearch: (entry) => {
        set((s) => ({
          recentSearches: dedupeAndCap([
            entry,
            ...s.recentSearches.filter((r) => r.id !== entry.id),
          ]),
        }));
      },
      removeRecentSearch: (id) => {
        set((s) => ({ recentSearches: s.recentSearches.filter((r) => r.id !== id) }));
      },
      clearRecentSearches: () => {
        set({ recentSearches: [] });
      },
    }),
    {
      name: STORAGE_KEY,
      version: STORAGE_VERSION,
      storage: createJSONStorage(() => localStorage),
      // Older versions of the slice didn't carry recentSearches; pass them
      // through and let `merge` recoerce — failing to migrate would
      // silently clear users' prefs on a routine deploy.
      migrate: (persisted: unknown) => persisted as Partial<PrefsState>,
      partialize: (s) => ({
        units: s.units,
        languageOverride: s.languageOverride,
        recentSearches: s.recentSearches,
      }),
      // Validate everything on rehydrate — the persisted shape can drift
      // (we removed a locale, the GeocodeResult shape evolved, etc.) and
      // we'd rather fall back to defaults than throw.
      merge: (persisted, current) => {
        const incoming = (persisted ?? {}) as Partial<PrefsState>;
        const safeLang =
          incoming.languageOverride && isSupportedLocale(incoming.languageOverride)
            ? incoming.languageOverride
            : null;
        const safeUnits: Units = incoming.units === 'imperial' ? 'imperial' : 'metric';
        const safeRecents = Array.isArray(incoming.recentSearches)
          ? dedupeAndCap(incoming.recentSearches as GeocodeResult[])
          : [];
        return {
          ...current,
          units: safeUnits,
          languageOverride: safeLang,
          recentSearches: safeRecents,
        };
      },
    },
  ),
);

export const PREFS_STORAGE_KEY = STORAGE_KEY;
