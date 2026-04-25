import { useTranslation } from 'react-i18next';

import { usePrefs } from '../store/prefs';

/**
 * Two-state toggle between °C and °F — see SPEC.md §5.2 step 7.
 *
 * Implemented as a `role=switch` button so screen readers announce it as
 * "Units, switch, off" / "Units, switch, on" rather than two competing
 * radio buttons. Visually we still render both glyphs side-by-side so the
 * user can see the alternative.
 *
 * The toggle is purely a `prefs` mutation; consumers re-render as soon as
 * the slice updates. The `°C` / `°F` glyphs come from the i18n catalog
 * (`header.unit.metric` / `header.unit.imperial`) — even though they're
 * universal, the catalog gives translators a hook for languages that
 * really do prefer a different convention later (none today).
 */
export function UnitsToggle() {
  const { t } = useTranslation();
  const units = usePrefs((s) => s.units);
  const toggle = usePrefs((s) => s.toggleUnits);
  const isImperial = units === 'imperial';

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isImperial}
      aria-label={t('header.unitsLabel')}
      onClick={toggle}
      className="inline-flex items-center gap-1 rounded-full border border-border bg-surface px-1 py-0.5 text-sm font-medium"
    >
      <span
        className={`rounded-full px-2 py-0.5 transition-colors ${
          isImperial ? 'text-muted' : 'bg-text text-bg'
        }`}
      >
        {t('header.unit.metric')}
      </span>
      <span
        className={`rounded-full px-2 py-0.5 transition-colors ${
          isImperial ? 'bg-text text-bg' : 'text-muted'
        }`}
      >
        {t('header.unit.imperial')}
      </span>
    </button>
  );
}
