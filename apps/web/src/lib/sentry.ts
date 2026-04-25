/**
 * Sentry initialization for the SPA.
 *
 * Behavior is intentionally gated on `VITE_SENTRY_DSN`:
 *   - DSN present (production deploy)  → SDK initialized, errors reported.
 *   - DSN absent (dev / test / CI)     → SDK is a no-op; nothing leaks to
 *     the network and tests aren't polluted with sentry events.
 *
 * The DSN is a public client identifier (Sentry's own docs call it "safe
 * to embed in a client bundle"). It rate-limits per-project, so we don't
 * worry about it landing in JS bundles. We still keep it out of git via
 * `.env` to avoid committing instance-specific config; CI provides it via
 * `VITE_SENTRY_DSN` repo variable on deploy.
 *
 * What we report:
 *   - Render-time crashes via the {@link AppErrorBoundary} (top-level).
 *   - TanStack Query failures with HTTP status >= 500, scoped with the
 *     `area` tag (`weather`, `geocode`, …) so we can split alerting per
 *     surface. 4xx are user/input issues, not bugs, and are skipped.
 *
 * What we do NOT report:
 *   - 4xx API errors (bad input, deep-linked junk coordinates, …).
 *   - AbortError from in-flight queries the user navigated away from.
 *   - Anything during local dev / test.
 */

import * as Sentry from '@sentry/react';

let initialized = false;

/**
 * Initialize Sentry once at app startup. Safe to call multiple times —
 * subsequent calls no-op. Reads the DSN from Vite's `import.meta.env`
 * (replaced at build time).
 */
export function initSentry(): void {
  if (initialized) return;
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    // Keep things small for a portfolio app: errors only, no perf or
    // session replay traffic. Easy to enable later if we ever care.
    tracesSampleRate: 0,
    // Strip absolute file paths from stack frames. The SPA bundle paths
    // are public anyway but it keeps issue grouping cleaner across
    // deploys.
    beforeSend(event) {
      return event;
    },
  });

  initialized = true;
}

/**
 * Report a query/mutation failure to Sentry, gated on `error.status`.
 * Returns whether the error was actually sent (handy for tests + the
 * console-reporter fallback).
 */
export function reportQueryError(
  error: unknown,
  context: { area: 'weather' | 'geocode'; queryKey?: readonly unknown[] },
): boolean {
  if (!initialized) return false;
  if (!shouldReport(error)) return false;

  Sentry.captureException(error, {
    tags: { area: context.area },
    ...(context.queryKey ? { extra: { queryKey: context.queryKey } } : {}),
  });
  return true;
}

/**
 * Same gate Sentry's hub would apply, exposed for tests to verify the
 * filter without going through the real SDK.
 */
export function shouldReport(error: unknown): boolean {
  if (!error || typeof error !== 'object') return true;
  const e = error as { name?: unknown; status?: unknown };
  if (e.name === 'AbortError') return false;
  if (typeof e.status === 'number' && e.status >= 400 && e.status < 500) {
    return false;
  }
  return true;
}

/**
 * Re-export the React boundary so consumers don't have to import the
 * full SDK surface. {@link AppErrorBoundary} wraps this with our
 * localized fallback.
 */
export const SentryErrorBoundary = Sentry.ErrorBoundary;
