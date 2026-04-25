/**
 * Canonical list of locales the app ships translations for.
 *
 * English is the source-of-truth (its catalog is bundled inline so the SPA
 * renders synchronously); everything else lazy-loads on demand. See
 * SPEC.md §5.8 for the full rationale and language picker UX.
 *
 * Adding a new locale is intentionally a config + JSON drop:
 *   1. Add the BCP-47 primary tag to SUPPORTED_LOCALES below
 *   2. Drop a `locales/<tag>/common.json` mirroring `en/common.json`
 *   3. Run `pnpm i18n:check` to confirm parity
 *
 * RTL is out of scope (none of the supported tags are RTL).
 */

export const SUPPORTED_LOCALES = [
  'en',
  'nb',
  'de',
  'fr',
  'es',
  'it',
  'nl',
  'pl',
  'pt',
  'sv',
  'da',
  'fi',
] as const;

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: SupportedLocale = 'en';

/**
 * All currently-supported locales default to metric (per SPEC.md §5.8 table).
 * If/when we add `en-US` or other imperial-default locales, this becomes a
 * lookup map keyed by locale.
 */
export const DEFAULT_UNITS = 'metric' as const;

export function isSupportedLocale(code: string | null | undefined): code is SupportedLocale {
  if (!code) return false;
  return (SUPPORTED_LOCALES as readonly string[]).includes(code);
}
