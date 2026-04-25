import { useTranslation } from 'react-i18next';

import { SUPPORTED_LOCALES, type SupportedLocale } from './i18n';
import { formatLanguage } from './i18n/format';

/**
 * Step 5/6a placeholder — proves the i18n + Tailwind v4 foundation works
 * end-to-end:
 *   - First paint is in the resolved locale (URL > localStorage > navigator)
 *   - Switching the picker re-renders strings without a reload, persists to
 *     localStorage, and updates `<html lang>`
 *   - All visual styles come from Tailwind v4 utilities backed by the
 *     `@theme` tokens in `index.css`, so swapping a token (e.g. surface
 *     color) re-themes the whole UI
 *
 * The wireframe-faithful header (real combobox + units toggle + recent
 * searches strip + hero) lands in §10 step 6b/7. This page is intentionally
 * sparse — only what's needed to demo i18n and verify the styling pipeline
 * compiles + ships in the bundle.
 */
function App() {
  const { t, i18n } = useTranslation();
  const activeLang = i18n.resolvedLanguage ?? i18n.language;

  return (
    <main className="mx-auto flex min-h-svh max-w-3xl flex-col gap-12 px-6 py-10">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
        <h1 className="text-xl font-medium">{t('brand')}</h1>
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted">{t('header.languageLabel')}:</span>
          <select
            value={activeLang}
            onChange={(e) => {
              void i18n.changeLanguage(e.target.value as SupportedLocale);
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
      </header>

      <section className="flex flex-1 flex-col items-center justify-center text-center">
        <h2 className="text-2xl">{t('app.greeting')}</h2>
        <p className="mt-2 text-muted">{t('app.tagline')}</p>
        <p className="mt-8 text-muted">{t('empty.prompt')}</p>
      </section>

      <footer className="text-center text-xs text-muted">
        <small>{t('footer.attribution')}</small>
      </footer>
    </main>
  );
}

export default App;
