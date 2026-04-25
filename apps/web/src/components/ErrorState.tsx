import { useTranslation } from 'react-i18next';

import { ApiError } from '../lib/api/client';

interface ErrorStateProps {
  error: unknown;
  online: boolean;
  onRetry: () => void;
  cityLabel?: string;
}

/**
 * Render path for a failed weather fetch. Speaks the same translation
 * keys as the live region so screen-reader users get the same context
 * the visual layer does.
 *
 * If the browser thinks it's offline we additionally surface the
 * `errors.offlineHint` copy — the underlying API error is usually a
 * generic `Failed to fetch` and isn't useful to the user.
 *
 * `data-testid` is attached so integration tests can target this
 * region without hunting for the localized copy.
 */
export function ErrorState({ error, online, onRetry, cityLabel }: ErrorStateProps) {
  const { t } = useTranslation();
  const liveMessage = cityLabel
    ? t('liveRegion.error', { city: cityLabel })
    : t('errors.fetchFailed');

  const detail = formatErrorDetail(error);

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="flex flex-col items-start gap-3 rounded-3xl border border-rose-300/50 bg-rose-50 px-6 py-8 text-rose-900"
      data-testid="error-state"
    >
      <p className="sr-only">{liveMessage}</p>
      <h2 className="text-xl font-semibold">{t('errors.fetchFailed')}</h2>
      {detail ? <p className="text-sm text-rose-800/80">{detail}</p> : null}
      {!online ? <p className="text-sm text-rose-800/80">{t('errors.offlineHint')}</p> : null}
      <button
        type="button"
        onClick={onRetry}
        className="rounded-full border border-rose-400/50 bg-white px-4 py-1.5 text-sm font-medium text-rose-900 hover:bg-rose-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-500"
      >
        {t('errors.retry')}
      </button>
    </div>
  );
}

function formatErrorDetail(error: unknown): string | null {
  if (error instanceof ApiError) {
    return `${error.status} · ${error.message}`;
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return null;
}
