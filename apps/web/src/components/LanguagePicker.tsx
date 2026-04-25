import { useId } from 'react';
import { useTranslation } from 'react-i18next';

import { formatLanguage } from '../i18n/format';
import { SUPPORTED_LOCALES, isSupportedLocale, setLanguage, type SupportedLocale } from '../i18n';
import { usePrefs } from '../store/prefs';

/**
 * Language picker — accessible native `<select>`, see SPEC.md §5.5 + §5.8.
 *
 * On change we do two things:
 *   1. `setLanguage(...)` — loads the matching catalog (if it isn't
 *      bundled yet) and flips the active language so every
 *      `useTranslation()` consumer re-renders against the real strings.
 *   2. `prefs.setLanguageOverride(...)` — records that the user *chose*
 *      this language (vs the browser auto-detecting it). This distinction
 *      will matter when we wire the share-this-view feature in §10 step 7
 *      (we only embed `?lang=` in shared URLs when the user has set an
 *      explicit override).
 *
 * Each option's label uses `Intl.DisplayNames(code, { type: 'language' })`
 * — the option's own locale — so users see their own language in their
 * own script (Deutsch, Polski, Suomi, …) rather than English names.
 */
export function LanguagePicker() {
  const { t, i18n } = useTranslation();
  const setOverride = usePrefs((s) => s.setLanguageOverride);
  const labelId = useId();
  // Prefer `language` (the user's chosen/active locale) over
  // `resolvedLanguage` (the closest locale with a loaded resource bundle).
  // For the dropdown UX, what matters is what the user picked — and on a
  // cold reload `resolvedLanguage` lags briefly while the catalog imports.
  const activeLang =
    (i18n.language as SupportedLocale | undefined) ?? (i18n.resolvedLanguage as SupportedLocale);

  return (
    <label className="flex items-center gap-2 text-sm">
      <span id={labelId} className="text-muted">
        {t('header.languageLabel')}
      </span>
      <select
        aria-labelledby={labelId}
        value={activeLang}
        onChange={(e) => {
          const next = e.target.value;
          if (!isSupportedLocale(next)) return;
          // setLanguage loads the catalog first so the very next render
          // resolves t() against the real translations, not the en
          // fallback.
          void setLanguage(next);
          setOverride(next);
        }}
        className="rounded-md border border-border bg-surface px-2 py-1 font-sans text-text"
      >
        {SUPPORTED_LOCALES.map((code) => (
          <option key={code} value={code}>
            {formatLanguage(code, code)}
          </option>
        ))}
      </select>
    </label>
  );
}
