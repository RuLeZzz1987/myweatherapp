import { useId } from 'react';
import { useTranslation } from 'react-i18next';

import { formatLanguage } from '../i18n/format';
import { SUPPORTED_LOCALES, isSupportedLocale, type SupportedLocale } from '../i18n';
import { usePrefs } from '../store/prefs';

/**
 * Language picker — accessible native `<select>`, see SPEC.md §5.5 + §5.8.
 *
 * On change we do two things:
 *   1. `i18n.changeLanguage(...)` — flips the active language so every
 *      `useTranslation()` consumer re-renders.
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
  const activeLang =
    (i18n.resolvedLanguage as SupportedLocale | undefined) ?? (i18n.language as SupportedLocale);

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
          void i18n.changeLanguage(next);
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
