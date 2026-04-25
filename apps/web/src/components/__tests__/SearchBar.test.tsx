import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SearchBar } from '../SearchBar';
import i18n from '../../i18n';
import type { GeocodeResult } from '../../lib/api/types';
import { renderWithProviders } from '../../../test/render';

/**
 * Note: typing happens at user-event speed (~50ms/char) and the SearchBar
 * debounces 250ms before issuing the request. Since results render a
 * non-trivial time after the last keystroke, every assertion that touches
 * the listbox is wrapped in `waitFor`.
 */

describe('<SearchBar />', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
  });
  afterEach(async () => {
    await i18n.changeLanguage('en');
  });

  it('starts collapsed and exposes the combobox role', () => {
    renderWithProviders(<SearchBar onSelect={() => undefined} />);

    const input = screen.getByRole('combobox', { name: 'Search for a city' });
    expect(input).toHaveAttribute('aria-expanded', 'false');
    expect(input).toHaveAttribute('aria-autocomplete', 'list');
  });

  it('opens the listbox and shows results once typing settles', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SearchBar onSelect={() => undefined} />);

    const input = screen.getByRole('combobox', { name: 'Search for a city' });
    await user.type(input, 'osl');

    // Wait for the geocode round-trip + 250ms debounce to settle into a
    // real result (not the transient "Searching…" placeholder option).
    await waitFor(() => {
      const listbox = screen.getByRole('listbox');
      const options = within(listbox).getAllByRole('option');
      expect(options.some((o) => o.getAttribute('aria-disabled') !== 'true')).toBe(true);
    });

    expect(input).toHaveAttribute('aria-expanded', 'true');
    const listbox = screen.getByRole('listbox');
    const options = within(listbox)
      .getAllByRole('option')
      .filter((o) => o.getAttribute('aria-disabled') !== 'true');
    expect(options).toHaveLength(1);
    expect(options[0]).toHaveTextContent('Oslo');
    expect(options[0]).toHaveTextContent('Norway');
  });

  it('supports keyboard navigation: ArrowDown highlights, Enter selects', async () => {
    const onSelect = vi.fn<(r: GeocodeResult) => void>();
    const user = userEvent.setup();
    renderWithProviders(<SearchBar onSelect={onSelect} />);

    const input = screen.getByRole('combobox', { name: 'Search for a city' });
    await user.type(input, 'paris');

    // Wait until both real Paris options have rendered (filter out any
    // transient "Searching…" disabled option).
    await waitFor(() => {
      const real = within(screen.getByRole('listbox'))
        .getAllByRole('option')
        .filter((o) => o.getAttribute('aria-disabled') !== 'true');
      expect(real.length).toBe(2);
    });
    const realOptions = () =>
      within(screen.getByRole('listbox'))
        .getAllByRole('option')
        .filter((o) => o.getAttribute('aria-disabled') !== 'true');

    await user.keyboard('{ArrowDown}');
    expect(realOptions()[0]).toHaveAttribute('aria-selected', 'true');
    expect(input.getAttribute('aria-activedescendant')).toBe(realOptions()[0].id);

    await user.keyboard('{ArrowDown}');
    expect(realOptions()[1]).toHaveAttribute('aria-selected', 'true');

    await user.keyboard('{Enter}');
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect.mock.calls[0]?.[0]?.name).toBe('Paris');
  });

  it('clears the input on Escape, then collapses on a second Escape', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SearchBar onSelect={() => undefined} />);

    const input = screen.getByRole('combobox', { name: 'Search for a city' });
    await user.type(input, 'osl');

    await waitFor(() => {
      expect(input).toHaveAttribute('aria-expanded', 'true');
    });

    await user.keyboard('{Escape}');
    expect(input).toHaveValue('');

    await user.keyboard('{Escape}');
    expect(input).toHaveAttribute('aria-expanded', 'false');
  });

  it('selecting an option clears the input by default and reports the choice', async () => {
    const onSelect = vi.fn<(r: GeocodeResult) => void>();
    const user = userEvent.setup();
    renderWithProviders(<SearchBar onSelect={onSelect} />);

    const input = screen.getByRole('combobox', { name: 'Search for a city' });
    await user.type(input, 'ber');

    await waitFor(() => {
      const options = within(screen.getByRole('listbox'))
        .getAllByRole('option')
        .filter((o) => o.getAttribute('aria-disabled') !== 'true');
      expect(options).toHaveLength(1);
    });

    const option = within(screen.getByRole('listbox'))
      .getAllByRole('option')
      .filter((o) => o.getAttribute('aria-disabled') !== 'true')[0];
    await user.click(option);

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect.mock.calls[0]?.[0]?.name).toBe('Berlin');
    expect(input).toHaveValue('');
  });

  it('shows a "no matches" hint when the geocoder returns an empty list', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SearchBar onSelect={() => undefined} />);

    const input = screen.getByRole('combobox', { name: 'Search for a city' });
    await user.type(input, 'noresults');

    // The hint is rendered both inside the listbox and (for screen
    // readers) inside the polite live region — scope to the listbox so
    // the assertion is unambiguous.
    await waitFor(() => {
      const listbox = screen.getByRole('listbox');
      expect(within(listbox).getByText('No matches')).toBeInTheDocument();
    });
  });
});
