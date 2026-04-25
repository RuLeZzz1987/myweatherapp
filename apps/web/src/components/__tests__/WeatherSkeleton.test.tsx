import { screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { WeatherSkeleton } from '../WeatherSkeleton';
import i18n from '../../i18n';
import { renderWithProviders } from '../../../test/render';

describe('<WeatherSkeleton />', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
  });
  afterEach(async () => {
    await i18n.changeLanguage('en');
  });

  it('marks the wrapper as busy and announces a loading message', () => {
    renderWithProviders(<WeatherSkeleton cityLabel="Oslo, Norway" />);
    const region = screen.getByTestId('weather-skeleton');
    expect(region).toHaveAttribute('aria-busy', 'true');
    expect(region).toHaveTextContent(/Loading weather for Oslo/i);
  });

  it('falls back to the generic loading message when no city is given', () => {
    renderWithProviders(<WeatherSkeleton />);
    expect(screen.getByTestId('weather-skeleton')).toHaveTextContent(/Loading weather/i);
  });
});
