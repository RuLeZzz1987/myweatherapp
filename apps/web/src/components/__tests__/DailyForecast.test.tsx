import { screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { DailyForecast } from '../DailyForecast';
import i18n from '../../i18n';
import type { WeatherResponse } from '../../lib/api/types';
import { renderWithProviders } from '../../../test/render';

function buildWeather(): WeatherResponse {
  return {
    location: {
      name: 'Oslo',
      country: 'Norway',
      latitude: 59.9139,
      longitude: 10.7522,
      timezone: 'Europe/Oslo',
    },
    units: 'metric',
    current: {
      time: '2026-04-25T12:00',
      temperature: 8,
      apparentTemperature: 6,
      humidity: 60,
      windSpeed: 12,
      windDirection: 90,
      precipitation: 0,
      cloudCover: 70,
      pressureMsl: 1015,
      weatherCode: 3,
      isDay: true,
    },
    hourly: [],
    daily: Array.from({ length: 7 }).map((_, i) => ({
      date: `2026-04-${String(25 + i).padStart(2, '0')}`,
      weatherCode: 3,
      tempMax: 12 + i,
      tempMin: 4 + i,
      apparentTempMax: 11,
      apparentTempMin: 3,
      sunrise: `2026-04-${String(25 + i).padStart(2, '0')}T05:30`,
      sunset: `2026-04-${String(25 + i).padStart(2, '0')}T20:45`,
      uvIndexMax: 4,
      precipitationSum: 0,
      precipitationProbabilityMax: 20,
      windSpeedMax: 18,
      windDirectionDominant: 90,
    })),
    fetchedAt: '2026-04-25T11:55:00Z',
    source: 'upstream',
    attribution: 'Open-Meteo',
  };
}

describe('<DailyForecast />', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
  });
  afterEach(async () => {
    await i18n.changeLanguage('en');
  });

  it('renders the section header and 7 rows', () => {
    renderWithProviders(<DailyForecast weather={buildWeather()} units="metric" locale="en" />);
    expect(screen.getByText('Next 7 days')).toBeInTheDocument();
    const list = screen.getByRole('list');
    expect(list.querySelectorAll('li')).toHaveLength(7);
  });

  it('renders weekday + condition + low/high per row', () => {
    renderWithProviders(<DailyForecast weather={buildWeather()} units="metric" locale="en" />);
    // Each row's aria-label encodes "{day}: high {high}, low {low}, {condition}"
    const rows = screen.getAllByRole('listitem');
    rows.forEach((row) => {
      expect(row.getAttribute('aria-label') ?? '').toMatch(/high.*low.*Overcast/);
    });
  });

  it('renders nothing when daily is empty', () => {
    const empty = { ...buildWeather(), daily: [] };
    const { container } = renderWithProviders(
      <DailyForecast weather={empty} units="metric" locale="en" />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
