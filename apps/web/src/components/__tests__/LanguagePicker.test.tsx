import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { LanguagePicker } from '../LanguagePicker';
import i18n from '../../i18n';
import { PREFS_STORAGE_KEY, usePrefs } from '../../store/prefs';
import { renderWithProviders } from '../../../test/render';

describe('<LanguagePicker />', () => {
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

  it("reflects the current i18n language in the select's value", () => {
    renderWithProviders(<LanguagePicker />);

    expect(screen.getByRole('combobox', { name: 'Language' })).toHaveValue('en');
  });

  it('updates i18n + prefs when the user picks a new locale', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LanguagePicker />);

    await user.selectOptions(screen.getByRole('combobox', { name: 'Language' }), 'fr');

    await waitFor(() => {
      expect(i18n.language).toBe('fr');
    });
    expect(usePrefs.getState().languageOverride).toBe('fr');
  });

  it('renders one option per supported locale', () => {
    renderWithProviders(<LanguagePicker />);

    const select = screen.getByRole('combobox', { name: 'Language' });
    const options = Array.from(select.querySelectorAll('option'));
    expect(options.length).toBe(12);
  });
});
