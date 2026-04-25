import { useTranslation } from 'react-i18next';

import { formatCountry, formatTemperature } from '../i18n/format';
import type { GeocodeResult, Units } from '../lib/api/types';
import { describeWmo } from '../lib/wmo';
import { WeatherIllustration } from './WeatherIllustration';

/**
 * Recent-searches strip — a row of cards across the bottom of the
 * landing view (SPEC.md §5.6, "Recent searches").
 *
 * Each card is a button that re-selects the corresponding city. Cards
 * surface a temperature + condition only when we have the data on
 * hand (i.e. it's been fetched at least once during this session) —
 * otherwise we render a placeholder so the strip layout stays stable
 * before the warm-up fetch completes.
 *
 * Selection rendering is keyed on the upstream id, mirroring how the
 * prefs store dedupes.
 */

export interface RecentCardSnapshot {
  geocode: GeocodeResult;
  /** Latest temperature seen for this city (in `units`). Optional. */
  temperature?: number;
  weatherCode?: number;
  isDay?: boolean;
}

export interface RecentSearchesProps {
  cards: RecentCardSnapshot[];
  units: Units;
  locale: string;
  activeId?: string | null;
  onSelect: (geocode: GeocodeResult) => void;
  onRemove: (id: string) => void;
}

export function RecentSearches({
  cards,
  units,
  locale,
  activeId,
  onSelect,
  onRemove,
}: RecentSearchesProps) {
  const { t } = useTranslation();
  if (cards.length === 0) return null;

  return (
    <section aria-labelledby="recents-heading" className="flex flex-col gap-3">
      <h2 id="recents-heading" className="text-sm font-medium text-muted">
        {t('recents.title')}
      </h2>

      <ul
        role="list"
        className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 sm:flex-wrap"
      >
        {cards.map(({ geocode, temperature, weatherCode, isDay = true }) => {
          const isActive = geocode.id === activeId;
          const tempLabel =
            typeof temperature === 'number' ? formatTemperature(temperature, units, locale) : null;
          const country = formatCountry(geocode.countryCode, locale);
          const palette = weatherCode != null ? describeWmo(weatherCode, isDay).palette : 'cloud';

          const accessibleLabel = t('recents.cardLabel', {
            city: geocode.name,
            temp: tempLabel ?? '—',
          });

          return (
            <li key={geocode.id} role="listitem" className="relative shrink-0 snap-start sm:shrink">
              <button
                type="button"
                aria-current={isActive ? 'true' : undefined}
                aria-label={accessibleLabel}
                onClick={() => {
                  onSelect(geocode);
                }}
                data-palette={palette}
                className={`flex w-44 flex-col items-start gap-2 rounded-2xl border px-4 py-3 text-left transition-colors ${
                  isActive
                    ? 'border-accent bg-surface-strong'
                    : 'border-border bg-surface hover:bg-surface-strong'
                }`}
              >
                <div className="flex w-full items-center justify-between text-sm">
                  <span className="font-medium">{geocode.name}</span>
                  {weatherCode != null ? (
                    <WeatherIllustration
                      weatherCode={weatherCode}
                      isDay={isDay}
                      size="1.5rem"
                      className="text-text/80"
                    />
                  ) : null}
                </div>
                <div className="flex w-full items-center justify-between text-xs text-muted">
                  <span>{country}</span>
                  {tempLabel ? <span className="text-text">{tempLabel}</span> : <span>—</span>}
                </div>
              </button>

              <button
                type="button"
                aria-label={t('recents.remove', { city: geocode.name })}
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(geocode.id);
                }}
                className="absolute right-1 top-1 rounded-full px-1.5 py-0.5 text-xs text-muted hover:bg-surface-strong hover:text-text"
              >
                <span aria-hidden="true">×</span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
