import { useTranslation } from 'react-i18next';

interface OfflineBannerProps {
  online: boolean;
}

/**
 * Persistent advisory shown above the main content when the browser
 * thinks it's offline. We don't disable any UI — the cached weather
 * payloads are still useful and stale-data hints already live in
 * the hero — we just announce the connectivity change once via
 * `role="status"` so it isn't noisy on every render.
 */
export function OfflineBanner({ online }: OfflineBannerProps) {
  const { t } = useTranslation();

  if (online) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="rounded-2xl border border-amber-300/40 bg-amber-50 px-4 py-2 text-sm text-amber-900"
      data-testid="offline-banner"
    >
      {t('states.offline')}
    </div>
  );
}
