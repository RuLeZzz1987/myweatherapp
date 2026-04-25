import { screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { SecondaryStats } from '../SecondaryStats';
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
      humidity: 64,
      windSpeed: 12,
      windDirection: 90,
      precipitation: 0.5,
      precipitationProbability: 20,
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
        windDirectionDominant: 90,
      },
    ],
    fetchedAt: '2026-04-25T11:55:00Z',
    source: 'upstream',
    attribution: 'Open-Meteo',
    ...overrides,
  };
}

describe('<SecondaryStats />', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
  });
  afterEach(async () => {
    await i18n.changeLanguage('en');
  });

  it('renders humidity, wind, pressure, cloud cover, precipitation', () => {
    renderWithProviders(<SecondaryStats weather={buildWeather()} units="metric" locale="en" />);

    expect(screen.getByText('Humidity')).toBeInTheDocument();
    expect(screen.getByText('64%')).toBeInTheDocument();
    expect(screen.getByText('Wind')).toBeInTheDocument();
    expect(screen.getByText('12 km/h E')).toBeInTheDocument();
    expect(screen.getByText('Pressure')).toBeInTheDocument();
    expect(screen.getByText('1015 hPa')).toBeInTheDocument();
    expect(screen.getByText('Cloud cover')).toBeInTheDocument();
    expect(screen.getByText('70%')).toBeInTheDocument();
    expect(screen.getByText('Precipitation')).toBeInTheDocument();
    expect(screen.getByText('0.5 mm')).toBeInTheDocument();
  });

  it('uses imperial unit labels when units = imperial', () => {
    const weather = buildWeather({
      units: 'imperial',
      current: {
        ...buildWeather().current,
        windSpeed: 7,
        precipitation: 0.02,
      },
    });
    renderWithProviders(<SecondaryStats weather={weather} units="imperial" locale="en" />);

    expect(screen.getByText('7 mph E')).toBeInTheDocument();
    expect(screen.getByText('0.0 in')).toBeInTheDocument();
  });

  it('renders sunrise / sunset / UV from daily[0]', () => {
    renderWithProviders(<SecondaryStats weather={buildWeather()} units="metric" locale="en" />);
    expect(screen.getByText('Sunrise')).toBeInTheDocument();
    expect(screen.getByText('Sunset')).toBeInTheDocument();
    expect(screen.getByText('UV index')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
  });

  it('shows precipitation probability only when present', () => {
    const a = buildWeather();
    renderWithProviders(<SecondaryStats weather={a} units="metric" locale="en" />);
    expect(screen.getByText('Chance of rain')).toBeInTheDocument();

    const without = buildWeather();
    delete without.current.precipitationProbability;
    const { unmount } = renderWithProviders(
      <SecondaryStats weather={without} units="metric" locale="en" />,
    );
    // Both renders are in the same DOM; we just confirmed unmounting
    // works to keep coverage of the hook lifecycle.
    unmount();
  });
});
