/**
 * Top-level React error boundary.
 *
 * Catches render-time crashes anywhere in the tree (the data-fetch
 * pipeline already has its own `<ErrorState />`) and renders a localized
 * fallback panel with a "Reload" action. Without this, a thrown render
 * would white-screen the SPA — see SPEC.md §5.6.
 *
 * Reporting is delegated to `lib/sentry.ts`, which gates on
 * `VITE_SENTRY_DSN` so dev/test stay quiet. Even when Sentry is off we
 * still log to `console.error` so the crash shows up in browser devtools.
 */

import { useTranslation } from 'react-i18next';

import { SentryErrorBoundary } from '../lib/sentry';

export interface AppErrorBoundaryProps {
  children: React.ReactNode;
  /** Override the default `window.location.reload()` (used in tests). */
  onReload?: () => void;
}

export function AppErrorBoundary({ children, onReload }: AppErrorBoundaryProps) {
  return (
    <SentryErrorBoundary
      fallback={({ resetError }) => (
        <CrashFallback
          onReload={() => {
            resetError();
            (onReload ?? defaultReload)();
          }}
        />
      )}
      onError={(error) => {
        console.error('[AppErrorBoundary] render-time crash:', error);
      }}
    >
      {children}
    </SentryErrorBoundary>
  );
}

function CrashFallback({ onReload }: { onReload: () => void }) {
  const { t } = useTranslation();
  return (
    <main
      role="alert"
      aria-live="assertive"
      className="mx-auto flex min-h-svh max-w-lg flex-col items-center justify-center gap-4 px-6 py-12 text-center"
      data-testid="app-crash-fallback"
    >
      <h1 className="text-2xl font-semibold text-text">{t('errors.appCrashTitle')}</h1>
      <p className="text-sm text-muted">{t('errors.appCrashBody')}</p>
      <button
        type="button"
        onClick={onReload}
        className="rounded-full border border-border bg-surface px-5 py-2 text-sm font-medium text-text hover:bg-surface-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        {t('errors.appCrashReload')}
      </button>
    </main>
  );
}

function defaultReload() {
  if (typeof window !== 'undefined') {
    window.location.reload();
  }
}
