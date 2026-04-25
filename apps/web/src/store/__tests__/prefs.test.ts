import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { PREFS_STORAGE_KEY, usePrefs } from '../prefs';

/**
 * Reset between tests — `usePrefs` is a module-level singleton, so any
 * mutation in one test bleeds into the next without explicit cleanup.
 * `localStorage` is already cleared by the global setupFile, but we also
 * snap the store back to its persisted defaults.
 */
function resetStore() {
  localStorage.removeItem(PREFS_STORAGE_KEY);
  usePrefs.setState({ units: 'metric', languageOverride: null, recentSearches: [] });
}

const oslo = {
  id: '3143244',
  name: 'Oslo',
  country: 'Norway',
  countryCode: 'NO',
  latitude: 59.9139,
  longitude: 10.7522,
  timezone: 'Europe/Oslo',
};
const paris = {
  id: '2988507',
  name: 'Paris',
  country: 'France',
  countryCode: 'FR',
  latitude: 48.8566,
  longitude: 2.3522,
  timezone: 'Europe/Paris',
};
const berlin = {
  id: '2950159',
  name: 'Berlin',
  country: 'Germany',
  countryCode: 'DE',
  latitude: 52.52,
  longitude: 13.405,
  timezone: 'Europe/Berlin',
};

describe('usePrefs', () => {
  beforeEach(() => {
    resetStore();
  });
  afterEach(() => {
    resetStore();
  });

  it('defaults to metric and no language override', () => {
    const { units, languageOverride } = usePrefs.getState();
    expect(units).toBe('metric');
    expect(languageOverride).toBeNull();
  });

  it('setUnits updates and persists', () => {
    usePrefs.getState().setUnits('imperial');
    expect(usePrefs.getState().units).toBe('imperial');

    const persisted = JSON.parse(localStorage.getItem(PREFS_STORAGE_KEY) ?? '{}');
    expect(persisted.state.units).toBe('imperial');
  });

  it('toggleUnits flips between metric and imperial', () => {
    usePrefs.getState().toggleUnits();
    expect(usePrefs.getState().units).toBe('imperial');
    usePrefs.getState().toggleUnits();
    expect(usePrefs.getState().units).toBe('metric');
  });

  it('setLanguageOverride accepts a supported locale', () => {
    usePrefs.getState().setLanguageOverride('de');
    expect(usePrefs.getState().languageOverride).toBe('de');
  });

  it('setLanguageOverride accepts null to clear the override', () => {
    usePrefs.getState().setLanguageOverride('fr');
    usePrefs.getState().setLanguageOverride(null);
    expect(usePrefs.getState().languageOverride).toBeNull();
  });

  it('merge() drops an unsupported persisted locale', () => {
    // Simulate a locale that used to be supported and was later removed —
    // we should treat it as if no override was ever set.
    localStorage.setItem(
      PREFS_STORAGE_KEY,
      JSON.stringify({
        state: { units: 'imperial', languageOverride: 'kl' },
        version: 1,
      }),
    );

    void usePrefs.persist.rehydrate();

    expect(usePrefs.getState().languageOverride).toBeNull();
    expect(usePrefs.getState().units).toBe('imperial');
  });

  it('merge() coerces a bogus units value back to metric', () => {
    localStorage.setItem(
      PREFS_STORAGE_KEY,
      JSON.stringify({
        state: { units: 'lunar', languageOverride: null },
        version: 1,
      }),
    );

    void usePrefs.persist.rehydrate();

    expect(usePrefs.getState().units).toBe('metric');
  });

  describe('recent searches', () => {
    it('starts empty', () => {
      expect(usePrefs.getState().recentSearches).toEqual([]);
    });

    it('pushRecentSearch prepends and persists', () => {
      usePrefs.getState().pushRecentSearch(oslo);
      const state = usePrefs.getState();
      expect(state.recentSearches.map((r) => r.id)).toEqual(['3143244']);

      const persisted = JSON.parse(localStorage.getItem(PREFS_STORAGE_KEY) ?? '{}');
      expect(persisted.state.recentSearches).toHaveLength(1);
      expect(persisted.state.recentSearches[0].id).toBe('3143244');
    });

    it('dedupes by id and re-orders to most recent', () => {
      const { pushRecentSearch } = usePrefs.getState();
      pushRecentSearch(oslo);
      pushRecentSearch(paris);
      pushRecentSearch(oslo);

      expect(usePrefs.getState().recentSearches.map((r) => r.id)).toEqual(['3143244', '2988507']);
    });

    it('caps at 5 entries, dropping the oldest', () => {
      const { pushRecentSearch } = usePrefs.getState();
      for (let i = 0; i < 7; i++) {
        pushRecentSearch({ ...oslo, id: `id-${i}`, name: `City-${i}` });
      }

      const state = usePrefs.getState();
      expect(state.recentSearches).toHaveLength(5);
      // Most recent first: id-6, id-5, ..., id-2 — id-0/id-1 dropped.
      expect(state.recentSearches.map((r) => r.id)).toEqual([
        'id-6',
        'id-5',
        'id-4',
        'id-3',
        'id-2',
      ]);
    });

    it('removeRecentSearch drops the matching entry only', () => {
      const { pushRecentSearch, removeRecentSearch } = usePrefs.getState();
      pushRecentSearch(oslo);
      pushRecentSearch(paris);
      pushRecentSearch(berlin);

      removeRecentSearch('2988507'); // paris

      expect(usePrefs.getState().recentSearches.map((r) => r.id)).toEqual(['2950159', '3143244']);
    });

    it('clearRecentSearches empties the strip', () => {
      usePrefs.getState().pushRecentSearch(oslo);
      usePrefs.getState().clearRecentSearches();
      expect(usePrefs.getState().recentSearches).toEqual([]);
    });

    it('merge() rehydrates and dedupes a stale persisted list', () => {
      localStorage.setItem(
        PREFS_STORAGE_KEY,
        JSON.stringify({
          state: {
            units: 'metric',
            languageOverride: null,
            recentSearches: [oslo, oslo, paris, { not: 'a real geocode' }, berlin],
          },
          version: 2,
        }),
      );

      void usePrefs.persist.rehydrate();

      expect(usePrefs.getState().recentSearches.map((r) => r.id)).toEqual([
        '3143244',
        '2988507',
        '2950159',
      ]);
    });
  });
});
