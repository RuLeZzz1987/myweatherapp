import { screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { CurrentWeatherHero } from '../CurrentWeatherHero';
import i18n from '../../i18n';
import type { WeatherResponse } from '../../lib/api/types';
import { renderWithProviders } from '../../../test/render';

function buildWeather(overrides: Partial<WeatherResponse> = {}): WeatherResponse {
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
      windDirection: 220,
      precipitation: 0,
      precipitationProbability: 10,
      cloudCover: 70,
      pressureMsl: 1015,
      weatherCode: 3,
      isDay: true,
    },
    hourly: [],
    daily: [
      {
        date: '2026-04-25',
        weatherCode: 3,
        tempMax: 12,
        tempMin: 4,
        apparentTempMax: 11,
        apparentTempMin: 3,
        sunrise: '2026-04-25T05:30',
        sunset: '2026-04-25T20:45',
        uvIndexMax: 4,
        precipitationSum: 0,
        precipitationProbabilityMax: 20,
        windSpeedMax: 18,
        windDirectionDominant: 220,
      },
    ],
    fetchedAt: '2026-04-25T11:55:00Z',
    source: 'upstream',
    attribution: 'Open-Meteo',
    ...overrides,
  };
}

describe('<CurrentWeatherHero />', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
  });
  afterEach(async () => {
    await i18n.changeLanguage('en');
  });

  it('renders city, country, condition, and a temperature with unit suffix', () => {
    const weather = buildWeather();
    renderWithProviders(
      <CurrentWeatherHero weather={weather} locale="en" preferredUnits="metric" />,
    );

    expect(screen.getByRole('heading', { level: 2, name: 'Oslo' })).toBeInTheDocument();
    expect(screen.getByText('Norway')).toBeInTheDocument();
    expect(screen.getByTestId('hero-condition')).toHaveTextContent('Overcast');
    // Numeric temp + °C suffix (Intl may or may not insert NBSP).
    const heroText =
      screen.getByRole('heading', { level: 2 }).closest('article')?.textContent ?? '';
    expect(heroText).toMatch(/8\s*°C/);
    expect(screen.getByText(/Feels like/)).toBeInTheDocument();
  });

  it('renders Fahrenheit when units = imperial', () => {
    const weather = buildWeather({
      units: 'imperial',
      current: { ...buildWeather().current, temperature: 46 },
    });
    renderWithProviders(
      <CurrentWeatherHero weather={weather} locale="en" preferredUnits="imperial" />,
    );
    const heroText =
      screen.getByRole('heading', { level: 2 }).closest('article')?.textContent ?? '';
    expect(heroText).toMatch(/46\s*°F/);
  });

  it('renders the localized condition (German)', async () => {
    await i18n.changeLanguage('en');
    // Temporarily inject a German translation through i18next without
    // shipping a full catalog (the catalog rollout lands in §10 step 10).
    i18n.addResource('de', 'common', 'weather.code.3', 'Bedeckt');
    await i18n.changeLanguage('de');
    const weather = buildWeather();
    renderWithProviders(
      <CurrentWeatherHero weather={weather} locale="de" preferredUnits="metric" />,
    );
    expect(screen.getByTestId('hero-condition')).toHaveTextContent('Bedeckt');
  });

  it('shows a stale-data hint when source is "stale"', () => {
    const weather = buildWeather({ source: 'stale' });
    renderWithProviders(
      <CurrentWeatherHero weather={weather} locale="en" preferredUnits="metric" />,
    );
    expect(screen.getByRole('status')).toHaveTextContent(/cached data/i);
  });

  it('renders sunrise and sunset times from daily[0]', () => {
    const weather = buildWeather();
    renderWithProviders(
      <CurrentWeatherHero weather={weather} locale="en" preferredUnits="metric" />,
    );
    expect(screen.getByText('Sunrise')).toBeInTheDocument();
    expect(screen.getByText('Sunset')).toBeInTheDocument();
  });
});
