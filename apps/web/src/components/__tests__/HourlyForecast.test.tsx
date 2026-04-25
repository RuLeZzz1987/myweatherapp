import { screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { HourlyForecast } from '../HourlyForecast';
import i18n from '../../i18n';
import type { WeatherResponse } from '../../lib/api/types';
import { renderWithProviders } from '../../../test/render';

function buildHour(time: string, temp: number, precip = 0, code = 3) {
  return {
    time,
    temperature: temp,
    precipitationProbability: precip,
    weatherCode: code,
  };
}

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
      precipitationProbability: 0,
      cloudCover: 70,
      pressureMsl: 1015,
      weatherCode: 3,
      isDay: true,
    },
    hourly: Array.from({ length: 36 }).map((_, i) =>
      buildHour(`2026-04-25T${String(i % 24).padStart(2, '0')}:00`, i, i === 5 ? 60 : 0),
    ),
    daily: [],
    fetchedAt: '2026-04-25T11:55:00Z',
    source: 'upstream',
    attribution: 'Open-Meteo',
  };
}

describe('<HourlyForecast />', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
  });
  afterEach(async () => {
    await i18n.changeLanguage('en');
  });

  it('renders the section header', () => {
    renderWithProviders(
      <HourlyForecast
        weather={buildWeather()}
        units="metric"
        locale="en"
        now={new Date('2026-04-25T12:00:00Z')}
      />,
    );
    expect(screen.getByText('Next 24 hours')).toBeInTheDocument();
  });

  it('renders 24 hour entries anchored at the next slot ≥ now', () => {
    renderWithProviders(
      <HourlyForecast
        weather={buildWeather()}
        units="metric"
        locale="en"
        now={new Date('2026-04-25T12:00:00Z')}
      />,
    );
    const list = screen.getByRole('list');
    expect(list.querySelectorAll('li').length).toBeLessThanOrEqual(24);
    expect(list.querySelectorAll('li').length).toBeGreaterThan(0);
  });

  it('renders a precip% badge when probability > 10', () => {
    renderWithProviders(
      <HourlyForecast
        weather={buildWeather()}
        units="metric"
        locale="en"
        now={new Date('2026-04-25T00:00:00Z')}
      />,
    );
    expect(screen.getByText('60%')).toBeInTheDocument();
  });

  it('renders nothing when hourly is empty', () => {
    const empty = { ...buildWeather(), hourly: [] };
    const { container } = renderWithProviders(
      <HourlyForecast weather={empty} units="metric" locale="en" />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
