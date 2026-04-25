import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { formatTemperature, formatTime } from '../i18n/format';
import type { Units, WeatherHourly, WeatherResponse } from '../lib/api/types';
import { roundInt } from '../lib/units';
import { WeatherIllustration } from './WeatherIllustration';

/**
 * 24-hour strip — horizontally scrollable on mobile, single row on
 * desktop. Slicing is anchored to "now" rather than 00:00 of the
 * forecast day so the user sees the next 24h, not 1 AM yesterday.
 *
 * Times come back from Open-Meteo without an explicit timezone
 * suffix (`2026-04-25T12:00`); we rely on `Intl.DateTimeFormat`'s
 * `timeZone` parameter and the location timezone to render local
 * clock-time regardless of where the visitor is.
 */

export interface HourlyForecastProps {
  weather: WeatherResponse;
  units: Units;
  locale: string;
  /** Override "now" (testing). */
  now?: Date;
}

const HOURS = 24;

export function HourlyForecast({ weather, units, locale, now }: HourlyForecastProps) {
  const { t } = useTranslation();
  // The temperature numbers are already in `units` because the worker
  // refetches with the right `temperature_unit`. We accept the prop
  // for symmetry with the other forecast components.
  void units;

  const slice = useMemo<WeatherHourly[]>(() => {
    if (weather.hourly.length === 0) return [];
    const reference = (now ?? new Date()).getTime();
    // Open-Meteo timestamps are UTC-naive but "in the location's
    // timezone". For slicing purposes we just compare against the
    // payload's clock time — the user-facing label is rendered with
    // `formatTime`, which does the locale conversion separately.
    const startIdx = weather.hourly.findIndex((h) => new Date(h.time).getTime() >= reference);
    const safeStart = startIdx === -1 ? 0 : startIdx;
    return weather.hourly.slice(safeStart, safeStart + HOURS);
  }, [weather.hourly, now]);

  if (slice.length === 0) return null;

  return (
    <section aria-labelledby="hourly-heading" className="flex flex-col gap-3">
      <h2 id="hourly-heading" className="text-sm font-medium text-muted">
        {t('forecast.hourlyTitle')}
      </h2>
      <ul
        role="list"
        className="flex snap-x gap-3 overflow-x-auto rounded-2xl border border-border bg-surface p-3"
      >
        {slice.map((hour, idx) => {
          const tempLabel = formatTemperature(hour.temperature, weather.units, locale);
          const timeLabel = formatTime(hour.time, locale, weather.location.timezone);
          const condition = t([`weather.code.${hour.weatherCode}`, 'weather.code.3']);
          // Day/night hint: copy from the daily array if it covers
          // this hour; otherwise pivot off the current isDay flag for
          // hours within ~12h, defaulting to true.
          const isDay = idx < 12 ? weather.current.isDay : !weather.current.isDay;

          return (
            <li
              key={hour.time}
              className="flex w-20 shrink-0 snap-start flex-col items-center gap-1 text-center"
            >
              <span className="text-xs text-muted">{timeLabel}</span>
              <WeatherIllustration
                weatherCode={hour.weatherCode}
                isDay={isDay}
                size="2rem"
                className="text-text/80"
              />
              <span
                className="text-sm"
                aria-label={t('forecast.hourLabel', {
                  time: timeLabel,
                  temp: tempLabel,
                  condition,
                })}
              >
                {tempLabel}
              </span>
              {hour.precipitationProbability > 10 ? (
                <span className="text-[10px] text-muted">
                  {roundInt(hour.precipitationProbability)}%
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
