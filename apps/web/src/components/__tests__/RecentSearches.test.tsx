import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RecentSearches, type RecentCardSnapshot } from '../RecentSearches';
import i18n from '../../i18n';
import { renderWithProviders } from '../../../test/render';

const oslo = {
  id: 'osl',
  name: 'Oslo',
  country: 'Norway',
  countryCode: 'NO',
  latitude: 59.9139,
  longitude: 10.7522,
  timezone: 'Europe/Oslo',
};
const berlin = {
  id: 'ber',
  name: 'Berlin',
  country: 'Germany',
  countryCode: 'DE',
  latitude: 52.52,
  longitude: 13.405,
  timezone: 'Europe/Berlin',
};

describe('<RecentSearches />', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
  });
  afterEach(async () => {
    await i18n.changeLanguage('en');
  });

  it('renders nothing when there are no cards', () => {
    const { container } = renderWithProviders(
      <RecentSearches
        cards={[]}
        units="metric"
        locale="en"
        onSelect={() => {}}
        onRemove={() => {}}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders a card per snapshot with localized country', () => {
    const cards: RecentCardSnapshot[] = [
      { geocode: oslo, temperature: 8, weatherCode: 3, isDay: true },
      { geocode: berlin, temperature: 12, weatherCode: 1, isDay: true },
    ];
    renderWithProviders(
      <RecentSearches
        cards={cards}
        units="metric"
        locale="en"
        onSelect={() => {}}
        onRemove={() => {}}
      />,
    );
    expect(screen.getByText('Recent searches')).toBeInTheDocument();
    expect(screen.getByText('Oslo')).toBeInTheDocument();
    expect(screen.getByText('Berlin')).toBeInTheDocument();
    expect(screen.getByText('Norway')).toBeInTheDocument();
    expect(screen.getByText('Germany')).toBeInTheDocument();
  });

  it('marks the active card with aria-current', () => {
    const cards: RecentCardSnapshot[] = [
      { geocode: oslo, temperature: 8 },
      { geocode: berlin, temperature: 12 },
    ];
    renderWithProviders(
      <RecentSearches
        cards={cards}
        units="metric"
        locale="en"
        activeId="ber"
        onSelect={() => {}}
        onRemove={() => {}}
      />,
    );
    const cardButtons = screen.getAllByRole('button', { name: /Show weather/ });
    const active = cardButtons.find((b) => b.getAttribute('aria-current') === 'true');
    expect(active).toBeTruthy();
    expect(active).toHaveTextContent('Berlin');
  });

  it('fires onSelect with the geocode on click', async () => {
    const onSelect = vi.fn();
    const cards: RecentCardSnapshot[] = [{ geocode: oslo, temperature: 8 }];
    renderWithProviders(
      <RecentSearches
        cards={cards}
        units="metric"
        locale="en"
        onSelect={onSelect}
        onRemove={() => {}}
      />,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /Show weather for Oslo/i }));
    expect(onSelect).toHaveBeenCalledWith(oslo);
  });

  it('fires onRemove with the id when × is clicked, without bubbling onSelect', async () => {
    const onSelect = vi.fn();
    const onRemove = vi.fn();
    const cards: RecentCardSnapshot[] = [{ geocode: oslo, temperature: 8 }];
    renderWithProviders(
      <RecentSearches
        cards={cards}
        units="metric"
        locale="en"
        onSelect={onSelect}
        onRemove={onRemove}
      />,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /Remove Oslo/i }));
    expect(onRemove).toHaveBeenCalledWith('osl');
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('renders the temperature in the active unit', () => {
    const cards: RecentCardSnapshot[] = [{ geocode: oslo, temperature: 46 }];
    renderWithProviders(
      <RecentSearches
        cards={cards}
        units="imperial"
        locale="en"
        onSelect={() => {}}
        onRemove={() => {}}
      />,
    );
    const card = screen.getByRole('button', { name: /Show weather for Oslo/i });
    // °F suffix is locale-dependent (some Intl impls insert U+00A0); match
    // the digits + degree mark + F regardless of separator.
    expect(card.textContent ?? '').toMatch(/46\s*°F/);
  });
});
