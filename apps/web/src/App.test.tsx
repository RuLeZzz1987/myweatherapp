/**
 * Integration test for the §10 step 6b App shell — confirms i18n and the
 * frontend-shell wiring (AppHeader + SearchBar + LanguagePicker +
 * UnitsToggle) hang together end-to-end.
 *
 *   - Side-effecting import of `./i18n` initializes i18next before render
 *   - Strings come from `react-i18next`'s `t()`
 *   - `<html lang>` reactively follows the active language
 *   - The language picker persists the user's choice to localStorage
 *
 * Browser-locale autodetection is exercised at the helper level
 * (`bestMatch.test.ts`); this file focuses on the React surface.
 */

import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import App from './App';
import i18n, { STORAGE_KEY } from './i18n';
import { PREFS_STORAGE_KEY, usePrefs } from './store/prefs';
import { renderWithProviders } from '../test/render';

function getLanguagePicker() {
  return screen.getByRole('combobox', { name: 'Language' });
}

describe('<App />', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
    usePrefs.setState({ units: 'metric', languageOverride: null });
    localStorage.removeItem(PREFS_STORAGE_KEY);
  });

  afterEach(async () => {
    await i18n.changeLanguage('en');
    usePrefs.setState({ units: 'metric', languageOverride: null });
    localStorage.removeItem(PREFS_STORAGE_KEY);
  });

  it('renders the brand and English copy by default', () => {
    renderWithProviders(<App />);

    expect(screen.getByRole('heading', { level: 1, name: 'MyWeather' })).toBeInTheDocument();
    expect(screen.getByText('Welcome to MyWeather')).toBeInTheDocument();
    expect(screen.getByText(/Personalized weather/i)).toBeInTheDocument();
    expect(screen.getByText('Search for a city to see the weather')).toBeInTheDocument();
  });

  it('renders both header controls and the search combobox', () => {
    renderWithProviders(<App />);

    expect(getLanguagePicker()).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Search for a city' })).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Units' })).toBeInTheDocument();
  });

  it('keeps <html lang> in sync with the active language', async () => {
    renderWithProviders(<App />);
    expect(document.documentElement.lang).toBe('en');

    await i18n.changeLanguage('de');
    expect(document.documentElement.lang).toBe('de');
  });

  it('switches the active language when the user picks a different option', async () => {
    const user = userEvent.setup();
    renderWithProviders(<App />);

    expect(getLanguagePicker()).toHaveValue('en');
    await user.selectOptions(getLanguagePicker(), 'de');

    // German catalog isn't shipped yet, so visible strings still fall back
    // to en — but the active language switched, `<html lang>` updated, and
    // the prefs slice recorded the override (vs auto-detection). Per-locale
    // strings are verified once catalogs land in §10 step 10.
    await waitFor(() => {
      expect(i18n.language).toBe('de');
    });
    expect(document.documentElement.lang).toBe('de');
    expect(usePrefs.getState().languageOverride).toBe('de');
  });

  it('renders each picker option in its own script', () => {
    renderWithProviders(<App />);

    const select = getLanguagePicker();
    const options = Array.from(select.querySelectorAll('option')).map((o) => ({
      value: o.value,
      label: o.textContent,
    }));

    expect(options.find((o) => o.value === 'de')?.label?.toLowerCase()).toContain('deutsch');
    expect(options.find((o) => o.value === 'pl')?.label?.toLowerCase()).toContain('polski');
    expect(options.find((o) => o.value === 'fi')?.label?.toLowerCase()).toContain('suomi');
  });

  it("persists the user's chosen language to localStorage (i18next side)", async () => {
    const user = userEvent.setup();
    renderWithProviders(<App />);

    await user.selectOptions(getLanguagePicker(), 'sv');

    await waitFor(() => {
      expect(window.localStorage.getItem(STORAGE_KEY)).toBe('sv');
    });
  });
});
