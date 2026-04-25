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
  usePrefs.setState({ units: 'metric', languageOverride: null });
}

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
});
