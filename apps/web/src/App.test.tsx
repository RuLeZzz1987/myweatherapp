/**
 * Integration test for the step-5 placeholder App — confirms the i18n stack
 * is wired end-to-end:
 *
 *   - Side-effecting import of `./i18n` initializes i18next before render
 *   - Strings come from `react-i18next`'s `t()`
 *   - `<html lang>` reactively follows the active language
 *   - The language picker persists the user's choice to localStorage
 *
 * Browser-locale autodetection is exercised at the helper level
 * (see `bestMatch.test.ts`); this file focuses on the React surface.
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import App from './App';
import i18n, { STORAGE_KEY } from './i18n';

describe('<App />', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
  });

  afterEach(async () => {
    await i18n.changeLanguage('en');
  });

  it('renders the brand and English copy by default', () => {
    render(<App />);

    expect(screen.getByRole('heading', { level: 1, name: 'MyWeather' })).toBeInTheDocument();
    expect(screen.getByText('Welcome to MyWeather')).toBeInTheDocument();
    expect(screen.getByText(/Personalized weather/i)).toBeInTheDocument();
    expect(screen.getByText('Search for a city to see the weather')).toBeInTheDocument();
  });

  it('keeps <html lang> in sync with the active language', async () => {
    render(<App />);
    expect(document.documentElement.lang).toBe('en');

    await i18n.changeLanguage('de');
    expect(document.documentElement.lang).toBe('de');
  });

  it('switches the active language when the user picks a different option', async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(screen.getByRole('combobox')).toHaveValue('en');

    await user.selectOptions(screen.getByRole('combobox'), 'de');

    // German catalog isn't shipped yet, so visible strings still fall back
    // to the en bundle — but the active language switched and `<html lang>`
    // updated, which is the contract this test asserts. Per-locale strings
    // are verified once catalogs land in §10 step 10.
    await waitFor(() => {
      expect(i18n.language).toBe('de');
    });
    expect(document.documentElement.lang).toBe('de');
  });

  it('renders each picker option in its own script', () => {
    render(<App />);

    const select = screen.getByRole('combobox');
    const options = Array.from(select.querySelectorAll('option')).map((o) => ({
      value: o.value,
      label: o.textContent,
    }));

    expect(options.find((o) => o.value === 'de')?.label?.toLowerCase()).toContain('deutsch');
    expect(options.find((o) => o.value === 'pl')?.label?.toLowerCase()).toContain('polski');
    expect(options.find((o) => o.value === 'fi')?.label?.toLowerCase()).toContain('suomi');
  });

  it("persists the user's chosen language to localStorage", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.selectOptions(screen.getByRole('combobox'), 'sv');

    await waitFor(() => {
      expect(window.localStorage.getItem(STORAGE_KEY)).toBe('sv');
    });
  });
});
