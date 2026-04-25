import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AppHeader } from '../AppHeader';
import i18n from '../../i18n';
import type { GeocodeResult } from '../../lib/api/types';
import { PREFS_STORAGE_KEY, usePrefs } from '../../store/prefs';
import { renderWithProviders } from '../../../test/render';

describe('<AppHeader />', () => {
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

  it('renders the brand and all three header controls', () => {
    renderWithProviders(<AppHeader onCitySelect={() => undefined} />);

    expect(screen.getByRole('heading', { level: 1, name: 'MyWeather' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Search for a city' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Language' })).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Units' })).toBeInTheDocument();
  });

  it('forwards a SearchBar selection up via onCitySelect', async () => {
    const onCitySelect = vi.fn<(r: GeocodeResult) => void>();
    const user = userEvent.setup();
    renderWithProviders(<AppHeader onCitySelect={onCitySelect} />);

    await user.type(screen.getByRole('combobox', { name: 'Search for a city' }), 'osl');

    await waitFor(() => {
      const real = within(screen.getByRole('listbox'))
        .getAllByRole('option')
        .filter((o) => o.getAttribute('aria-disabled') !== 'true');
      expect(real.length).toBeGreaterThan(0);
    });

    const realOptions = within(screen.getByRole('listbox'))
      .getAllByRole('option')
      .filter((o) => o.getAttribute('aria-disabled') !== 'true');
    await user.click(realOptions[0]);

    expect(onCitySelect).toHaveBeenCalledTimes(1);
    expect(onCitySelect.mock.calls[0]?.[0]?.name).toBe('Oslo');
  });
});
