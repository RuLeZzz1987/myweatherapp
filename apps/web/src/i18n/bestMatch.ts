/**
 * Locale resolution helpers for SPEC.md §5.8.2.
 *
 * Pure functions, no i18next coupling — so they're trivially unit-testable
 * and reusable for SSR (e.g. Worker-side accept-language parsing) later.
 */

import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  isSupportedLocale,
  type SupportedLocale,
} from './supportedLocales';

/**
 * Pick the closest supported locale for a list of BCP-47 candidates.
 *
 * For each candidate we try, in order:
 *   1. Exact match (e.g. `nb-NO` if we ever ship a region-specific catalog)
 *   2. Primary language match (`fr-CA` → `fr`)
 *
 * If nothing matches we fall back to {@link DEFAULT_LOCALE}.
 *
 * Uses `Intl.Locale` to parse, with a defensive lowercase/split fallback for
 * malformed inputs so we never throw on unexpected `navigator.languages` data.
 */
export function bestMatch(
  candidates: readonly (string | null | undefined)[],
  supported: readonly string[] = SUPPORTED_LOCALES,
): SupportedLocale {
  for (const raw of candidates) {
    if (!raw) continue;

    if (supported.includes(raw)) {
      return raw as SupportedLocale;
    }

    let primary: string | null;
    try {
      primary = new Intl.Locale(raw).language;
    } catch {
      primary = raw.toLowerCase().split(/[-_]/)[0] ?? null;
    }

    if (primary && supported.includes(primary)) {
      return primary as SupportedLocale;
    }
  }

  return DEFAULT_LOCALE;
}

/**
 * Browser-shaped subset of `Storage`. We only need `getItem` for resolution;
 * writes are i18next's job (via the language detector's `caches`).
 */
export interface ReadableStorage {
  getItem(key: string): string | null;
}

/**
 * Browser-shaped subset of `navigator` we care about.
 */
export interface NavigatorLanguages {
  languages: readonly string[];
}

export interface ResolveInitialLocaleArgs {
  url?: URLSearchParams | null;
  storage?: ReadableStorage | null;
  navigator?: NavigatorLanguages | null;
  /** Defaults to `'lang'` for both URL param and localStorage key. */
  key?: string;
}

/**
 * Resolve the active locale at app boot, honoring the priority chain in
 * SPEC.md §5.8.2:
 *
 *   1. `?lang=<bcp47>` URL param (sharing override)
 *   2. `localStorage.lang`     (manual override persisted from the picker)
 *   3. `navigator.languages`   (browser default, via {@link bestMatch})
 *   4. `'en'`                  (fallback)
 *
 * Unsupported values at any layer are skipped, not silently downgraded — so a
 * stale `?lang=xx` never wedges the user out of a working language.
 */
export function resolveInitialLocale({
  url,
  storage,
  navigator: nav,
  key = 'lang',
}: ResolveInitialLocaleArgs): SupportedLocale {
  const fromUrl = url?.get(key) ?? null;
  if (isSupportedLocale(fromUrl)) return fromUrl;

  const fromStorage = storage?.getItem(key) ?? null;
  if (isSupportedLocale(fromStorage)) return fromStorage;

  const fromNav = nav?.languages ?? [];
  return bestMatch(fromNav);
}
