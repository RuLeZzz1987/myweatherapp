import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

import { isSupportedLocale, type SupportedLocale } from '../i18n/supportedLocales';

/**
 * UI preferences — see SPEC.md §5.3.
 *
 * The slice owns three concerns:
 *   1. Units (°C / °F). Default is metric for every currently-supported
 *      locale (SPEC §5.8); the toggle in §10 step 6b lets the user override
 *      and the choice persists across reloads.
 *   2. Language override. Boot-time language detection lives in
 *      `i18n/index.ts` (URL > localStorage > navigator > en); once the user
 *      picks via the header picker, that choice is mirrored here so any
 *      component can read it without subscribing to i18next directly. The
 *      i18next side stays the source of truth for *active* language; this
 *      slice records the *user's stated preference* so we can distinguish
 *      "browser detected nb" from "user chose nb".
 *   3. Recent searches will be added in §10 step 7. Keeping the slice
 *      narrow now so unrelated re-renders don't fire on units changes.
 *
 * Persisted under `myweather:prefs` (versioned for future migrations).
 */

export type Units = 'metric' | 'imperial';

export interface PrefsState {
  units: Units;
  languageOverride: SupportedLocale | null;

  setUnits: (u: Units) => void;
  toggleUnits: () => void;
  setLanguageOverride: (l: SupportedLocale | null) => void;
}

const STORAGE_KEY = 'myweather:prefs';
const STORAGE_VERSION = 1;

export const usePrefs = create<PrefsState>()(
  persist(
    (set) => ({
      units: 'metric',
      languageOverride: null,

      setUnits: (units) => {
        set({ units });
      },
      toggleUnits: () => {
        set((s) => ({ units: s.units === 'metric' ? 'imperial' : 'metric' }));
      },
      setLanguageOverride: (languageOverride) => {
        set({ languageOverride });
      },
    }),
    {
      name: STORAGE_KEY,
      version: STORAGE_VERSION,
      storage: createJSONStorage(() => localStorage),
      // Only persist user-authored fields; setters are recreated on hydrate.
      partialize: (s) => ({
        units: s.units,
        languageOverride: s.languageOverride,
      }),
      // Validate languageOverride on rehydrate — guards against a stale
      // localStorage entry pointing at a locale we've since removed from
      // SUPPORTED_LOCALES.
      merge: (persisted, current) => {
        const incoming = (persisted ?? {}) as Partial<PrefsState>;
        const safeLang =
          incoming.languageOverride && isSupportedLocale(incoming.languageOverride)
            ? incoming.languageOverride
            : null;
        const safeUnits: Units = incoming.units === 'imperial' ? 'imperial' : 'metric';
        return { ...current, units: safeUnits, languageOverride: safeLang };
      },
    },
  ),
);

export const PREFS_STORAGE_KEY = STORAGE_KEY;
