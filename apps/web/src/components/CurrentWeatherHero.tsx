import { useTranslation } from 'react-i18next';

import { formatRelativeTime, formatTemperature, formatTime } from '../i18n/format';
import type { Units, WeatherResponse } from '../lib/api/types';
import { ThemeBackdrop } from './ThemeBackdrop';
import { WeatherIllustration } from './WeatherIllustration';

/**
 * The wireframe's "screenshot moment" — city, condition, huge temp,
 * stylized illustration. The hero is intentionally narrow in scope:
 * it renders the *current* slice of {@link WeatherResponse} only.
 * Hourly / daily / secondary stats live in their own components.
 *
 * Units are owned by the consumer (`usePrefs`) and forwarded as a prop
 * because we may render the hero against a `useWeather` payload whose
 * `units` haven't caught up yet — TanStack Query keeps the previous
 * result around while a new one fetches. We re-format using the
 * authoritative units from the payload itself (`weather.units`) so
 * what's on screen is always self-consistent (e.g. the number reads
 * °C iff the value is in °C).
 */

export interface CurrentWeatherHeroProps {
  weather: WeatherResponse;
  /** Active locale — passed through `Intl.*` formatters. */
  locale: string;
  /**
   * Active units toggle. Used only to decide whether to surface a
   * "fetching new units" UI state (the hero itself reads the units
   * the payload was fetched with).
   */
  preferredUnits: Units;
  /** Optional `Date` override for relative-time tests. */
  now?: Date;
}

export function CurrentWeatherHero({
  weather,
  locale,
  preferredUnits,
  now,
}: CurrentWeatherHeroProps) {
  const { t } = useTranslation();

  const { current, location, daily, fetchedAt, source } = weather;
  const tempLabel = formatTemperature(current.temperature, weather.units, locale);
  const apparent = formatTemperature(current.apparentTemperature, weather.units, locale);
  // i18next: passing an array picks the first key that resolves — falls
  // back to "Overcast" so an unknown WMO code still renders something.
  const condition = t([`weather.code.${current.weatherCode}`, 'weather.code.3']);

  const sunrise = daily[0]?.sunrise ? formatTime(daily[0].sunrise, locale, location.timezone) : '';
  const sunset = daily[0]?.sunset ? formatTime(daily[0].sunset, locale, location.timezone) : '';
  const fetchedAgo = formatRelativeTime(fetchedAt, now ?? new Date(), locale);
  const unitsMismatch = weather.units !== preferredUnits;

  return (
    <ThemeBackdrop weatherCode={current.weatherCode} isDay={current.isDay} className="text-text">
      <article
        className="flex flex-col gap-6 px-6 py-10 sm:px-12 sm:py-16"
        aria-labelledby="hero-heading"
      >
        <header className="flex items-start justify-between gap-6">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted">
              {source === 'cache' || source === 'stale'
                ? t('hero.cached', { ago: fetchedAgo })
                : t('hero.asOf', { time: formatTime(current.time, locale, location.timezone) })}
            </p>
            <h2 id="hero-heading" className="mt-2 text-3xl font-light sm:text-4xl">
              {location.name}
            </h2>
            <p className="text-sm text-muted">{location.country}</p>
          </div>

          <WeatherIllustration
            weatherCode={current.weatherCode}
            isDay={current.isDay}
            size="6rem"
            className="text-text/80 sm:size-32"
          />
        </header>

        <div className="flex flex-col gap-1">
          <span className="sr-only">{t('hero.labelTemperature')}</span>
          <p
            className="font-light leading-none"
            style={{ fontSize: 'var(--text-hero, clamp(5rem, 12vw, 12rem))' }}
          >
            {tempLabel}
          </p>
          <p className="text-base text-muted">
            <span className="sr-only">{t('hero.labelCondition')}: </span>
            <span data-testid="hero-condition">{condition}</span>
            <span className="mx-2 text-muted/60" aria-hidden="true">
              ·
            </span>
            <span>{t('hero.feelsLike', { temp: apparent })}</span>
          </p>
        </div>

        <dl className="grid grid-cols-2 gap-4 text-sm sm:max-w-md">
          {sunrise ? (
            <div>
              <dt className="text-muted">{t('stats.sunrise')}</dt>
              <dd>{sunrise}</dd>
            </div>
          ) : null}
          {sunset ? (
            <div>
              <dt className="text-muted">{t('stats.sunset')}</dt>
              <dd>{sunset}</dd>
            </div>
          ) : null}
        </dl>

        {source === 'stale' ? (
          <p
            role="status"
            className="rounded-md border border-border bg-surface/70 px-3 py-2 text-xs text-muted"
          >
            {t('hero.stale')}
          </p>
        ) : null}

        {/* When the user toggles units, the previous payload sticks
            around (TanStack `placeholderData: keepPreviousData`) until
            the new one lands — `data-units-mismatch` lets E2E /
            integration tests assert the transitional state without
            adding a visible string. */}
        <span hidden data-units-mismatch={unitsMismatch} />
      </article>
    </ThemeBackdrop>
  );
}
