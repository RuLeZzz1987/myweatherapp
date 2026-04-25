import { useTranslation } from 'react-i18next';

/**
 * The first-paint shell when no city is selected. SPEC §5.6 calls this
 * out as the "find the weather" prompt that lives where the hero will
 * eventually render.
 *
 * Pulled into its own component to keep `App.tsx` focused on routing
 * the data states (idle / loading / error / ready).
 */
export function EmptyState() {
  const { t } = useTranslation();
  return (
    <section
      aria-labelledby="empty-state-title"
      className="flex flex-col items-center gap-3 rounded-3xl border border-border bg-surface px-6 py-20 text-center"
      data-testid="empty-state"
    >
      <h2 id="empty-state-title" className="text-2xl font-light">
        {t('empty.title')}
      </h2>
      <p className="max-w-md text-muted">{t('empty.prompt')}</p>
    </section>
  );
}
