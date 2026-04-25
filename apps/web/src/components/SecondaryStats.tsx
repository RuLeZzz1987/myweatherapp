import { useTranslation } from 'react-i18next';

import { formatTemperature, formatTime } from '../i18n/format';
import type { Units, WeatherDaily, WeatherResponse } from '../lib/api/types';
import { compassPoint, precipUnit, roundInt, speedUnit } from '../lib/units';

/**
 * SPEC §5.6 "Beyond the wireframe" — humidity, wind, pressure, cloud
 * cover, UV index, sunrise/sunset, precipitation. Not every signal
 * Open-Meteo exposes is meaningful for a generalist user; we surface
 * the subset that matches the SPEC's wireframe-adjacent layout.
 *
 * Sunrise/sunset/UV come from `daily[0]` because Open-Meteo's free
 * tier doesn't expose them on `current` (SPEC §6 explicitly calls
 * this out). If `daily[0]` is absent (truncated payload) we just
 * skip those rows.
 */

export interface SecondaryStatsProps {
  weather: WeatherResponse;
  units: Units;
  locale: string;
}

interface StatRow {
  key: string;
  label: string;
  value: string;
}

export function SecondaryStats({ weather, units, locale }: SecondaryStatsProps) {
  const { t } = useTranslation();
  const today: WeatherDaily | undefined = weather.daily[0];
  const speedUnitLabel = t(`stats.unit.${speedUnit(units)}`);
  const precipUnitLabel = t(`stats.unit.${precipUnit(units)}`);
  const compass = compassPoint(weather.current.windDirection);
  const compassLabel = t(`stats.windDir.${compass}`);

  const rows: StatRow[] = [
    {
      key: 'humidity',
      label: t('stats.humidity'),
      value: t('stats.humidityValue', { value: roundInt(weather.current.humidity) }),
    },
    {
      key: 'wind',
      label: t('stats.wind'),
      value: t('stats.windValue', {
        speed: roundInt(weather.current.windSpeed),
        unit: speedUnitLabel,
        direction: compassLabel,
      }),
    },
    {
      key: 'pressure',
      label: t('stats.pressure'),
      value: t('stats.pressureValue', { value: roundInt(weather.current.pressureMsl) }),
    },
    {
      key: 'cloudCover',
      label: t('stats.cloudCover'),
      value: t('stats.cloudCoverValue', { value: roundInt(weather.current.cloudCover) }),
    },
    {
      key: 'precipitation',
      label: t('stats.precipitation'),
      value: t('stats.precipitationValue', {
        value: weather.current.precipitation.toFixed(1),
        unit: precipUnitLabel,
      }),
    },
  ];

  if (typeof weather.current.precipitationProbability === 'number') {
    rows.push({
      key: 'precipProb',
      label: t('stats.precipitationProbability'),
      value: t('stats.precipitationProbabilityValue', {
        value: roundInt(weather.current.precipitationProbability),
      }),
    });
  }

  if (today) {
    rows.push({
      key: 'uv',
      label: t('stats.uvIndex'),
      // Open-Meteo returns null near the poles in winter / when the
      // model has no UV signal — render an em-dash rather than a
      // misleading "0".
      value: today.uvIndexMax == null ? '—' : roundInt(today.uvIndexMax).toString(),
    });
    rows.push({
      key: 'sunrise',
      label: t('stats.sunrise'),
      value: formatTime(today.sunrise, locale, weather.location.timezone),
    });
    rows.push({
      key: 'sunset',
      label: t('stats.sunset'),
      value: formatTime(today.sunset, locale, weather.location.timezone),
    });
  }

  // Show feels-like as the very first row even though it's a hero
  // copy too — the stats grid is usable on its own (e.g. screen
  // reader walks the dl directly) and "Feels like" is the most
  // user-meaningful number after current temp. We use the dedicated
  // `stats.feelsLike` key (a noun phrase) instead of `stats.title`,
  // which is the section heading — otherwise screen readers would
  // announce "Conditions — Conditions: 15°C".
  rows.unshift({
    key: 'feelsLike',
    label: t('stats.feelsLike'),
    value: formatTemperature(weather.current.apparentTemperature, weather.units, locale),
  });

  return (
    <section
      aria-labelledby="stats-heading"
      className="rounded-2xl border border-border bg-surface p-4 sm:p-6"
    >
      <h2 id="stats-heading" className="mb-4 text-sm font-medium text-muted">
        {t('stats.title')}
      </h2>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
        {rows.map((row) => (
          <div key={row.key} className="flex flex-col">
            <dt className="text-xs uppercase tracking-wide text-muted">{row.label}</dt>
            <dd className="mt-0.5 text-base">{row.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
