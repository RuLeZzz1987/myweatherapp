import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { formatTemperature, formatTime } from '../i18n/format';
import type { Units, WeatherDaily, WeatherHourly, WeatherResponse } from '../lib/api/types';
import { roundInt } from '../lib/units';
import { WeatherIllustration } from './WeatherIllustration';

/**
 * 24-hour strip — horizontally scrollable on mobile, single row on
 * desktop. Slicing is anchored to "now in the location's timezone"
 * so the user sees the next 24h regardless of where their browser
 * is physically located (e.g. browsing Tokyo's forecast from Berlin
 * still slices around Tokyo's clock time).
 *
 * Open-Meteo returns timestamps as naive ISO strings (`2026-04-25T12:00`)
 * that are *already in the location's timezone* (we set `timezone=auto`
 * upstream). We exploit that by computing now's wall-clock parts in
 * the same timezone and comparing strings directly — no `new Date()`
 * round-trip to UTC required.
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
    const reference = floorToHourInTimezone(
      now ?? new Date(),
      weather.location.timezone,
      weather.current.time,
    );
    const startIdx = weather.hourly.findIndex((h) => h.time >= reference);
    const safeStart = startIdx === -1 ? 0 : startIdx;
    return weather.hourly.slice(safeStart, safeStart + HOURS);
  }, [weather, now]);

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
        {slice.map((hour) => {
          const tempLabel = formatTemperature(hour.temperature, weather.units, locale);
          const timeLabel = formatTime(hour.time, locale, weather.location.timezone);
          const condition = t([`weather.code.${hour.weatherCode}`, 'weather.code.3']);
          // Determine day/night by checking the slot's wall-clock time
          // against the matching day's sunrise/sunset (also wall-clock
          // in location TZ), so icons flip at real solar boundaries
          // rather than at a fixed offset from `current.isDay`.
          const isDay = isDayForSlot(hour.time, weather.daily, weather.current.isDay);

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
              {hour.precipitationProbability != null && hour.precipitationProbability > 10 ? (
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

/**
 * Floor a JS `Date` to the start of its current hour, expressed as a
 * naive ISO string (`YYYY-MM-DDTHH:00`) in the given IANA timezone.
 * Falls back to the API's own `currentTime` (already in location TZ)
 * if `Intl.DateTimeFormat` can't honor the timezone.
 */
function floorToHourInTimezone(at: Date, timeZone: string, currentTime: string): string {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(at);
    const get = (type: Intl.DateTimeFormatPartTypes) =>
      parts.find((p) => p.type === type)?.value ?? '';
    const yyyy = get('year');
    const mm = get('month');
    const dd = get('day');
    const hh = get('hour');
    if (yyyy && mm && dd && hh) {
      // `hour: '2-digit'` with `hour12: false` returns "00".."23" in
      // every modern engine — but Safari historically emitted "24"
      // for midnight. Normalize that explicitly.
      const safeHour = hh === '24' ? '00' : hh;
      return `${yyyy}-${mm}-${dd}T${safeHour}:00`;
    }
  } catch {
    // fall through
  }
  return `${currentTime.slice(0, 13)}:00`;
}

/**
 * Decide whether `slotTime` falls between sunrise and sunset for its
 * calendar day. If we don't have daily coverage for that day (e.g.
 * far-future hours past the 7-day window), fall back to the
 * caller-provided current isDay hint.
 */
function isDayForSlot(slotTime: string, daily: WeatherDaily[], fallbackIsDay: boolean): boolean {
  const date = slotTime.slice(0, 10);
  const day = daily.find((d) => d.date === date);
  if (!day || !day.sunrise || !day.sunset) return fallbackIsDay;
  return slotTime >= day.sunrise && slotTime < day.sunset;
}
