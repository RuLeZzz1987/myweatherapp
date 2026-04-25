import { useTranslation } from 'react-i18next';

import { formatTemperature, formatWeekday } from '../i18n/format';
import type { WeatherResponse } from '../lib/api/types';
import { WeatherIllustration } from './WeatherIllustration';

/**
 * 7-day strip — vertical list on mobile, condensed on desktop. Uses
 * `Intl.DateTimeFormat({ weekday: 'short' })` so non-English locales
 * get the right abbreviation out of the box.
 *
 * Numeric values come pre-converted from the worker (it forwards the
 * active `units` to Open-Meteo upstream), so this component reads
 * `weather.units` for formatting and doesn't take a separate `units`
 * prop.
 */

export interface DailyForecastProps {
  weather: WeatherResponse;
  locale: string;
}

export function DailyForecast({ weather, locale }: DailyForecastProps) {
  const { t } = useTranslation();
  if (weather.daily.length === 0) return null;

  return (
    <section aria-labelledby="daily-heading" className="flex flex-col gap-3">
      <h2 id="daily-heading" className="text-sm font-medium text-muted">
        {t('forecast.dailyTitle')}
      </h2>

      <ul role="list" className="flex flex-col rounded-2xl border border-border bg-surface">
        {weather.daily.map((day, idx) => {
          const high = formatTemperature(day.tempMax, weather.units, locale);
          const low = formatTemperature(day.tempMin, weather.units, locale);
          const weekday = formatWeekday(day.date, locale, weather.location.timezone);
          const condition = t([`weather.code.${day.weatherCode}`, 'weather.code.3']);

          return (
            <li
              key={day.date}
              className={`flex items-center justify-between gap-4 px-4 py-3 ${
                idx === 0 ? '' : 'border-t border-border'
              }`}
              aria-label={t('forecast.dayLabel', {
                day: weekday,
                high,
                low,
                condition,
              })}
            >
              <span className="w-12 text-sm font-medium capitalize">{weekday}</span>
              <WeatherIllustration
                weatherCode={day.weatherCode}
                isDay
                size="1.75rem"
                className="text-text/80"
              />
              <span className="flex-1 text-sm text-muted">{condition}</span>
              <span className="text-sm tabular-nums text-muted">{low}</span>
              <span className="text-sm tabular-nums">{high}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
