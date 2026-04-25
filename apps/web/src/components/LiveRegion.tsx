import { useTranslation } from 'react-i18next';

interface LiveRegionProps {
  cityLabel: string | null;
  status: 'idle' | 'loading' | 'success' | 'error';
  /**
   * Increment whenever a fresh weather payload arrives so the live
   * region re-announces "Weather for X updated" — even if the
   * computed message string would be identical to the previous one.
   * Used as part of the React `key` so the region remounts and
   * screen readers replay it. TanStack Query's `dataUpdatedAt`
   * works well as the source.
   */
  tick: number;
}

/**
 * Politely-announced status region for weather queries. We keep it
 * outside the visual flow (sr-only) and emit one of three localized
 * strings depending on the query state. Empty between announcements
 * so screen readers don't keep replaying the last message.
 *
 * `key` carries the tick so a successful refetch re-mounts the
 * region and assistive tech replays the announcement.
 */
export function LiveRegion({ cityLabel, status, tick }: LiveRegionProps) {
  const { t } = useTranslation();
  const message = computeMessage({ cityLabel, status, t });

  return (
    <p
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="sr-only"
      data-testid="live-region"
      key={`${status}:${tick}`}
    >
      {message}
    </p>
  );
}

function computeMessage({
  cityLabel,
  status,
  t,
}: {
  cityLabel: string | null;
  status: LiveRegionProps['status'];
  t: (key: string, opts?: Record<string, unknown>) => string;
}): string {
  if (status === 'idle' || !cityLabel) return '';
  if (status === 'loading') return t('liveRegion.loading', { city: cityLabel });
  if (status === 'error') return t('liveRegion.error', { city: cityLabel });
  return t('liveRegion.updated', { city: cityLabel });
}
