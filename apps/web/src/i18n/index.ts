/**
 * i18next init for the SPA. See SPEC.md §5.8.
 *
 * Boot sequence:
 *   1. Resolve the active locale via {@link resolveInitialLocale} so we can
 *      hand i18next a single `lng` it never has to second-guess.
 *   2. Initialize i18next with the English catalog inline (no network/IO),
 *      so first paint is synchronous and SSR-safe.
 *   3. After init, lazy-load the active non-English catalog if needed and
 *      keep `<html lang>` in sync with the resolved language.
 *
 * Re-exports the helper functions / constants that components use most so
 * the rest of the app doesn't have to know which file each lives in.
 */

import i18next from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';

import { bestMatch, resolveInitialLocale } from './bestMatch';
import enCommon from './locales/en/common.json';
import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  isSupportedLocale,
  type SupportedLocale,
} from './supportedLocales';

const NAMESPACE = 'common';
const STORAGE_KEY = 'lang';

// Catalogs other than `en` aren't bundled — Vite turns this into a dynamic
// chunk per language. The eager glob keeps imports static (so the bundler can
// see them) without forcing them into the entry chunk.
const lazyCatalogs = import.meta.glob('./locales/*/common.json');

async function loadCatalog(lang: string): Promise<void> {
  if (!isSupportedLocale(lang) || lang === DEFAULT_LOCALE) return;
  if (i18next.hasResourceBundle(lang, NAMESPACE)) return;

  const path = `./locales/${lang}/common.json`;
  const importer = lazyCatalogs[path];
  if (!importer) return;

  const mod = (await importer()) as { default: Record<string, unknown> };
  i18next.addResourceBundle(lang, NAMESPACE, mod.default, true, true);
}

/**
 * Switch the active UI language. Loads the matching catalog FIRST so
 * `t()` resolves against real translations on the first render after
 * the change rather than falling back to English while the dynamic
 * import is still in flight.
 *
 * Consumers (the language picker, deep-link sync, etc.) should call
 * this instead of `i18next.changeLanguage` directly.
 */
export async function setLanguage(lang: string): Promise<void> {
  if (!isSupportedLocale(lang)) return;
  await loadCatalog(lang);
  await i18next.changeLanguage(lang);
}

function syncHtmlLang(lang: string): void {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = lang;
}

const initialLocale: SupportedLocale =
  typeof window === 'undefined'
    ? DEFAULT_LOCALE
    : resolveInitialLocale({
        url: new URLSearchParams(window.location.search),
        storage: window.localStorage,
        navigator: window.navigator,
        key: STORAGE_KEY,
      });

void i18next
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    lng: initialLocale,
    fallbackLng: DEFAULT_LOCALE,
    supportedLngs: SUPPORTED_LOCALES as unknown as string[],
    nonExplicitSupportedLngs: true,
    load: 'languageOnly',
    ns: [NAMESPACE],
    defaultNS: NAMESPACE,
    resources: { en: { common: enCommon } },
    detection: {
      // We've already resolved the initial locale ourselves, but keep the
      // detector wired so the picker can persist user choices to localStorage
      // automatically.
      order: ['querystring', 'localStorage', 'navigator'],
      lookupQuerystring: STORAGE_KEY,
      lookupLocalStorage: STORAGE_KEY,
      caches: ['localStorage'],
    },
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
    returnNull: false,
  });

i18next.on('languageChanged', (lng) => {
  void loadCatalog(lng);
  syncHtmlLang(lng);
});

void loadCatalog(initialLocale);
syncHtmlLang(initialLocale);

export default i18next;

export {
  bestMatch,
  resolveInitialLocale,
  SUPPORTED_LOCALES,
  DEFAULT_LOCALE,
  isSupportedLocale,
  STORAGE_KEY,
};
export type { SupportedLocale };
