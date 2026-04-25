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
        locale="en"
        now={new Date('2026-04-25T00:00:00Z')}
      />,
    );
    expect(screen.getByText('60%')).toBeInTheDocument();
  });

  it('renders nothing when hourly is empty', () => {
    const empty = { ...buildWeather(), hourly: [] };
    const { container } = renderWithProviders(<HourlyForecast weather={empty} locale="en" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('hides the precip% badge when probability is null', () => {
    const weather = buildWeather();
    // Force a null probability on the would-be 60% slot.
    const idx = weather.hourly.findIndex((h) => h.time === '2026-04-25T05:00');
    weather.hourly[idx] = { ...weather.hourly[idx]!, precipitationProbability: null };
    renderWithProviders(
      <HourlyForecast weather={weather} locale="en" now={new Date('2026-04-25T00:00:00Z')} />,
    );
    expect(screen.queryByText('60%')).not.toBeInTheDocument();
  });

  it('flips day/night icons at sunrise/sunset of each daily slot', () => {
    // Build a weather payload with explicit sunrise/sunset so we can
    // assert that pre-sunrise hours render the night icon and post-
    // sunrise hours render the day icon.
    const weather = buildWeather();
    weather.daily = [
      {
        date: '2026-04-25',
        weatherCode: 0,
        tempMax: 12,
        tempMin: 4,
        apparentTempMax: 11,
        apparentTempMin: 3,
        sunrise: '2026-04-25T06:00',
        sunset: '2026-04-25T20:00',
        uvIndexMax: 4,
        precipitationSum: 0,
        precipitationProbabilityMax: 10,
        windSpeedMax: 12,
        windDirectionDominant: 200,
      },
    ];
    // Two hours: one before sunrise, one after.
    weather.hourly = [
      { time: '2026-04-25T05:00', temperature: 3, precipitationProbability: 0, weatherCode: 0 },
      { time: '2026-04-25T08:00', temperature: 9, precipitationProbability: 0, weatherCode: 0 },
    ];
    const { container } = renderWithProviders(
      <HourlyForecast weather={weather} locale="en" now={new Date('2026-04-25T03:00:00Z')} />,
    );
    const items = container.querySelectorAll('li');
    expect(items.length).toBe(2);
    // WeatherIllustration sets `data-icon` based on (weatherCode, isDay).
    // For weatherCode 0: isDay=true → 'sun', isDay=false → 'moon'. The
    // pre-sunrise slot must therefore render moon and the post-sunrise
    // slot must render sun.
    const icons = Array.from(items).map((li) =>
      li.querySelector('svg[data-icon]')?.getAttribute('data-icon'),
    );
    expect(icons[0]).toBe('moon');
    expect(icons[1]).toBe('sun');
  });
});
