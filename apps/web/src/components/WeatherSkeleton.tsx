import { useTranslation } from 'react-i18next';

interface WeatherSkeletonProps {
  cityLabel?: string;
}

/**
 * Loading placeholder shown while the first weather fetch is in flight
 * (or while a refetch is replacing data). Mirrors the rough layout of
 * the hero + secondary stats so the page doesn't jump when data lands.
 *
 * `aria-busy` lets assistive tech know the region is updating and the
 * `role="status"` paragraph announces a localized "loading…" message
 * so screen-reader users aren't left guessing.
 */
export function WeatherSkeleton({ cityLabel }: WeatherSkeletonProps) {
  const { t } = useTranslation();
  const message = cityLabel ? t('liveRegion.loading', { city: cityLabel }) : t('hero.loading');

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="flex flex-col gap-6"
      data-testid="weather-skeleton"
    >
      <p className="sr-only">{message}</p>
      <div className="flex flex-col gap-4 rounded-3xl border border-border bg-surface p-8">
        <div className="h-5 w-40 animate-pulse rounded-full bg-surface-strong" />
        <div className="h-16 w-32 animate-pulse rounded-2xl bg-surface-strong" />
        <div className="h-4 w-56 animate-pulse rounded-full bg-surface-strong" />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-2xl border border-border bg-surface" />
        ))}
      </div>
      <div className="flex gap-3 overflow-x-auto">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="h-28 w-20 flex-shrink-0 animate-pulse rounded-2xl border border-border bg-surface"
          />
        ))}
      </div>
    </div>
  );
}
