import { useTranslation } from 'react-i18next';

interface LiveRegionProps {
  cityLabel: string | null;
  status: 'idle' | 'loading' | 'success' | 'error';
}

/**
 * Politely-announced status region for weather queries. We keep it
 * outside the visual flow (sr-only) and emit one of three localized
 * strings depending on the query state. Empty between announcements
 * so screen readers don't keep replaying the last message.
 *
 * **Re-announcing identical messages**: React only sees a new mount
 * when its identity changes, so when the *content* of two consecutive
 * announcements would be the same string (e.g. two successful
 * refetches of "Weather for Oslo updated"), screen readers may not
 * replay it. The parent should pass a `key` whose value changes on
 * each fresh announcement to force a remount, e.g.:
 *
 *     <LiveRegion
 *       key={`${status}:${dataUpdatedAt}`}
 *       cityLabel={…}
 *       status={…}
 *     />
 *
 * Setting `key` on the parent's JSX (rather than internally on what
 * this component returns) is the canonical React API — it survives
 * `React.memo` wrapping and StrictMode re-renders. See the React
 * docs on "Resetting state with a key".
 */
export function LiveRegion({ cityLabel, status }: LiveRegionProps) {
  const { t } = useTranslation();
  const message = computeMessage({ cityLabel, status, t });

  return (
    <p
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="sr-only"
      data-testid="live-region"
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
