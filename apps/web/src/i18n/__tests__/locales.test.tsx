/**
 * Locale rollout integration test (SPEC §5.8 + §10 step 10).
 *
 * Confirms every supported locale:
 *   - Has a JSON catalog living next to en/.
 *   - Mirrors the en key set exactly (no missing/extra keys).
 *   - Loads through i18next when activated and translates a probe key
 *     into something other than the English source.
 *
 * The catalog parity check is also covered by `scripts/i18n-check.mjs`,
 * but having the assertion in the test suite means a missed key is
 * caught by `pnpm test` even when CI doesn't run the script.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import enCommon from '../locales/en/common.json';
import { SUPPORTED_LOCALES } from '../supportedLocales';
import i18n from '../index';

const lazyCatalogs = import.meta.glob<{
  default: Record<string, unknown>;
}>('../locales/*/common.json');

function flatten(obj: unknown, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {};
  if (!obj || typeof obj !== 'object') return out;
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      Object.assign(out, flatten(v, path));
    } else if (typeof v === 'string') {
      out[path] = v;
    }
  }
  return out;
}

const enFlat = flatten(enCommon);
const enKeys = Object.keys(enFlat).sort();
const nonEnLocales = SUPPORTED_LOCALES.filter((l) => l !== 'en');

/**
 * i18next plural-suffix convention: `key_<category>`. Different locales
 * pick different CLDR categories (Polish has `_one|_few|_many|_other`,
 * English `_one|_other`), so for parity we compare *base* keys, not
 * literal keys. See `scripts/i18n-check.mjs` for the same logic.
 */
const PLURAL_SUFFIX_RE = /_(zero|one|two|few|many|other)$/;
function baseKeysOf(keys: string[]): string[] {
  const seen = new Set<string>();
  for (const k of keys) seen.add(k.replace(PLURAL_SUFFIX_RE, ''));
  return [...seen].sort();
}
const enBaseKeys = baseKeysOf(enKeys);

describe('locale catalogs', () => {
  beforeAll(async () => {
    await i18n.changeLanguage('en');
  });

  afterAll(async () => {
    await i18n.changeLanguage('en');
  });

  it.each(nonEnLocales)('%s catalog has the same base key set as en', async (lang) => {
    const path = `../locales/${lang}/common.json`;
    const importer = lazyCatalogs[path];
    expect(importer, `expected catalog ${path}`).toBeDefined();
    const mod = await importer!();
    const flat = flatten(mod.default);
    expect(baseKeysOf(Object.keys(flat))).toEqual(enBaseKeys);
  });

  it.each(nonEnLocales)('%s loads through i18next and translates probe keys', async (lang) => {
    // The dynamic catalog import inside the i18n side-effect is fire-and-
    // forget; for the test we wait for the bundle to materialize before
    // probing translations. After that, `t()` resolves through the active
    // language without falling back to en.
    if (!i18n.hasResourceBundle(lang, 'common')) {
      const path = `../locales/${lang}/common.json`;
      const importer = lazyCatalogs[path];
      expect(importer, `missing catalog at ${path}`).toBeDefined();
      const mod = await importer!();
      i18n.addResourceBundle(lang, 'common', mod.default, true, true);
    }
    await i18n.changeLanguage(lang);
    expect(i18n.language).toBe(lang);

    // app.skipToContent and empty.title are full natural-language strings
    // — they MUST differ from English in a real translation.
    const skipToContent = i18n.t('app.skipToContent');
    const emptyTitle = i18n.t('empty.title');
    const errorsRetry = i18n.t('errors.retry');

    expect(skipToContent).not.toBe(enFlat['app.skipToContent']);
    expect(emptyTitle).not.toBe(enFlat['empty.title']);
    expect(errorsRetry).not.toBe(enFlat['errors.retry']);

    // The brand stays "MyWeather" everywhere.
    expect(i18n.t('brand')).toBe('MyWeather');
  });
});
