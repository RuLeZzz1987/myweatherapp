import { useTranslation } from 'react-i18next';

import { SUPPORTED_LOCALES, type SupportedLocale } from './i18n';
import { formatLanguage } from './i18n/format';

/**
 * Step 5 placeholder — proves the i18n foundation works end-to-end:
 *   - First paint is in the resolved locale (URL > localStorage > navigator)
 *   - Switching the picker re-renders strings without a reload, persists to
 *     localStorage, and updates `<html lang>`
 *   - Language option labels come from `Intl.DisplayNames` so each option
 *     shows in its own script ("Deutsch", "Polski", "Suomi", …)
 *
 * The wireframe-faithful UI lands in §10 step 7. This page is intentionally
 * sparse — only what's needed to demo i18n + smoke-test against the live API
 * proxy in dev.
 */
function App() {
  const { t, i18n } = useTranslation();
  const activeLang = i18n.resolvedLanguage ?? i18n.language;

  return (
    <main>
      <header>
        <h1>{t('brand')}</h1>
        <label>
          {t('header.languageLabel')}:{' '}
          <select
            value={activeLang}
            onChange={(e) => {
              void i18n.changeLanguage(e.target.value as SupportedLocale);
            }}
          >
            {SUPPORTED_LOCALES.map((code) => (
              <option key={code} value={code}>
                {formatLanguage(code, code)}
              </option>
            ))}
          </select>
        </label>
      </header>

      <section>
        <h2>{t('app.greeting')}</h2>
        <p>{t('app.tagline')}</p>
        <p>{t('empty.prompt')}</p>
      </section>

      <footer>
        <small>{t('footer.attribution')}</small>
      </footer>
    </main>
  );
}

export default App;
