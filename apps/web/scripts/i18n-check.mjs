#!/usr/bin/env node
/**
 * Catalog completeness + untranslated-string heuristic.
 *
 * Walks `src/i18n/locales/<lang>/*.json` and verifies every non-`en` catalog:
 *   1. Has the same *base* key set as the matching `en` file (plural
 *      variants like `key_one`/`key_few` collapse to the same base key
 *      so different locales can pick different CLDR categories).
 *   2. If a base key has plural variants in a locale, that locale also
 *      includes the required `_other` fallback i18next demands.
 *   3. Has no string that's byte-identical to `en` (likely untranslated)
 *      unless the key is on an explicit allow-list (proper nouns, glyph-only
 *      strings like "°C" / "°F").
 *
 * Untranslated keys are warnings by default and become errors in CI.
 *
 * The check core is exported as `runI18nCheck({ root, strict, log })` so
 * it can be unit-tested against fixture catalogs without spawning a child
 * process. The CLI invocation at the bottom of this file is a thin shim
 * around it. See `scripts/__tests__/i18n-check.test.mjs`.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

/**
 * Keys whose values are EXPECTED to match English across locales. Anything
 * outside this list that matches `en` flags as a likely missed translation.
 *
 * Mostly formatting / glyph keys (unit symbols, compass cardinals that
 * happen to share letters across locales, and the Open-Meteo attribution
 * URL).
 */
const ALLOW_SAME_AS_SOURCE = new Set([
  // The brand key is a JSON file under `common/`, so flattened it's
  // `common.brand`. The bare `brand` form has no flattened analogue —
  // dropping it.
  'common.brand',
  // Cognates that legitimately match across languages. Annotate each
  // entry with the locale(s) it covers so the next reader (and the
  // next round of locale rollout) doesn't have to re-discover it.
  'common.stats.wind', // de "Wind", nl "Wind"
  'common.stats.title', // fr "Conditions"
  // Unit symbols are language-agnostic by convention — every locale
  // uses the SI (or US imperial) glyph as-is.
  'common.header.unit.metric', // unit glyph
  'common.header.unit.imperial', // unit glyph
  'common.stats.unit.kmh', // unit glyph
  'common.stats.unit.mph', // unit glyph
  'common.stats.unit.mm', // unit glyph
  // 8-point compass cardinals: every supported locale (en/de/nl/sv/no/
  // fi/da) uses the same "N/NE/E/SE/S/SW/W/NW" letter glyphs in their
  // weather UIs. fr/es/it/pt/pl don't translate these either.
  'common.stats.windDir.N',
  'common.stats.windDir.NE',
  'common.stats.windDir.E',
  'common.stats.windDir.SE',
  'common.stats.windDir.S',
  'common.stats.windDir.SW',
  'common.stats.windDir.W',
  'common.stats.windDir.NW',
  // External URL — same regardless of locale.
  'common.footer.attributionLink',
  'footer.attributionLink',
]);

/**
 * If the en value is one of these "tokens", we assume it doesn't need
 * translating either way (e.g. brand mentions inside larger keys).
 */
const SHARED_TOKENS = new Set(['MyWeather', 'Open-Meteo', 'CLDR']);

/**
 * Strings made up entirely of formatting tokens / punctuation /
 * interpolation slots are language-agnostic by definition. We strip
 * `{{placeholder}}` segments and a small set of unit glyphs (hPa, mph,
 * mm, km/h, °C, °F) before checking — anything left without a Unicode
 * letter is considered a format string and skipped by the heuristic.
 */
const PLACEHOLDER_RE = /\{\{[^}]+\}\}/g;
const UNIT_GLYPHS_RE = /(hPa|mph|km\/h|km\/u|km\/t|mm|°C|°F|po|pol|tum|cale|tuumaa)/gi;

export function isFormatOnly(value) {
  const stripped = value.replace(PLACEHOLDER_RE, '').replace(UNIT_GLYPHS_RE, '');
  return !/\p{L}/u.test(stripped);
}

/**
 * i18next plural-suffix convention: `key_<category>` where category is a
 * CLDR plural form. Different locales need different categories (Polish
 * has `_one|_few|_many|_other`, English `_one|_other`, Japanese only
 * `_other`). For parity we compare *base* keys — each locale must have
 * at least one variant per base key, and none beyond what `en/` defines.
 *
 * https://www.i18next.com/translation-function/plurals
 */
const PLURAL_SUFFIX_RE = /_(zero|one|two|few|many|other)$/;
export function baseKey(k) {
  return k.replace(PLURAL_SUFFIX_RE, '');
}
export function isPluralVariant(k) {
  return PLURAL_SUFFIX_RE.test(k);
}

export function flatten(obj, prefix = '') {
  const out = new Map();
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      for (const [sub, val] of flatten(v, path)) out.set(sub, val);
    } else if (typeof v === 'string') {
      out.set(path, v);
    }
  }
  return out;
}

export function basesFrom(flat) {
  const bases = new Map();
  for (const k of flat.keys()) {
    const b = baseKey(k);
    if (!bases.has(b)) bases.set(b, []);
    bases.get(b).push(k);
  }
  return bases;
}

function safeReaddir(p) {
  try {
    return readdirSync(p);
  } catch {
    return null;
  }
}

function catalogFor(root, lang) {
  const dir = join(root, lang);
  // statSync throws ENOENT if the entry has gone away between the
  // outer readdir() and us getting here — rare but not impossible in
  // CI sandboxes that mutate the tree concurrently. Treat any stat
  // failure (or non-directory entry such as a stray .DS_Store file)
  // as "not a locale" rather than crashing the whole check.
  let stat;
  try {
    stat = statSync(dir);
  } catch {
    return null;
  }
  if (!stat.isDirectory()) return null;
  const entries = safeReaddir(dir) ?? [];
  const merged = {};
  for (const file of entries.filter((f) => f.endsWith('.json'))) {
    const ns = file.replace(/\.json$/, '');
    merged[ns] = JSON.parse(readFileSync(join(dir, file), 'utf8'));
  }
  return merged;
}

/**
 * Programmatic check entry point. Returns a structured result so callers
 * (and tests) can introspect the outcome without parsing console output.
 *
 * @param {object} opts
 * @param {string} opts.root           Path to `locales/` directory.
 * @param {boolean} [opts.strict]      Treat untranslated heuristic hits as errors.
 * @param {{warn: (s: string) => void, error: (s: string) => void, info: (s: string) => void}} [opts.log]
 * @returns {{
 *   ok: boolean;
 *   skipped?: boolean;
 *   missingSource?: boolean;
 *   sourceLang: string;
 *   langs: string[];
 *   issuesByLang: Record<string, {
 *     missing: string[];
 *     extra: string[];
 *     missingOther: string[];
 *     untranslated: string[];
 *   }>;
 *   warned: boolean;
 *   errored: boolean;
 * }}
 */
export function runI18nCheck({ root, strict = false, log = silentLog() }) {
  const langs = safeReaddir(root);
  if (!langs) {
    log.info('i18n:check: no catalogs yet — skipping.');
    return {
      ok: true,
      skipped: true,
      sourceLang: 'en',
      langs: [],
      issuesByLang: {},
      warned: false,
      errored: false,
    };
  }

  const sourceLang = 'en';
  if (!langs.includes(sourceLang)) {
    log.error(`i18n:check: missing source catalog "${sourceLang}/" in ${root}`);
    return {
      ok: false,
      missingSource: true,
      sourceLang,
      langs,
      issuesByLang: {},
      warned: false,
      errored: true,
    };
  }

  const sourceCatalog = catalogFor(root, sourceLang);
  const sourceFlat = flatten(sourceCatalog);
  const sourceBases = basesFrom(sourceFlat);

  let errored = false;
  let warned = false;
  const issuesByLang = {};
  const otherLangs = langs.filter((l) => l !== sourceLang);

  for (const lang of otherLangs) {
    const cat = catalogFor(root, lang);
    if (!cat) continue;
    const flat = flatten(cat);
    const bases = basesFrom(flat);

    const missing = [...sourceBases.keys()].filter((b) => !bases.has(b));
    const extra = [...bases.keys()].filter((b) => !sourceBases.has(b));

    const missingOther = [];
    for (const [base, keys] of bases) {
      if (!keys.some(isPluralVariant)) continue;
      if (!keys.includes(`${base}_other`)) missingOther.push(base);
    }

    if (missing.length || extra.length || missingOther.length) {
      errored = true;
      log.error(`\ni18n:check: ${lang}/ catalog out of sync with ${sourceLang}/`);
      if (missing.length) log.error('  missing keys:\n   - ' + missing.join('\n   - '));
      if (extra.length) log.error('  unexpected keys:\n   - ' + extra.join('\n   - '));
      if (missingOther.length)
        log.error(
          '  plural keys missing required `_other` fallback:\n   - ' + missingOther.join('\n   - '),
        );
    }

    const untranslated = [];
    for (const [key, value] of flat) {
      const sourceValue = sourceFlat.get(key);
      if (sourceValue === undefined) continue;
      if (value !== sourceValue) continue;
      if (ALLOW_SAME_AS_SOURCE.has(key)) continue;
      if (SHARED_TOKENS.has(value)) continue;
      if (isFormatOnly(value)) continue;
      untranslated.push(`${key} = ${JSON.stringify(value)}`);
    }

    if (untranslated.length) {
      const sink = strict ? log.error : log.warn;
      sink(
        `\ni18n:check: ${lang}/ has ${untranslated.length} key(s) identical to ${sourceLang}/ (likely untranslated):`,
      );
      for (const u of untranslated) sink('   - ' + u);
      if (strict) errored = true;
      else warned = true;
    }

    issuesByLang[lang] = { missing, extra, missingOther, untranslated };
  }

  if (otherLangs.length === 0) {
    log.info(`i18n:check: 1 catalog (${sourceLang}/).`);
  } else {
    log.info(
      `i18n:check: ${langs.length} catalog(s) in sync with ${sourceLang}/${warned ? ' (with warnings)' : ''}.`,
    );
  }

  return {
    ok: !errored,
    sourceLang,
    langs,
    issuesByLang,
    warned,
    errored,
  };
}

function silentLog() {
  return { warn() {}, error() {}, info() {} };
}

function consoleLog() {
  return {
    warn: (s) => console.warn(s),
    error: (s) => console.error(s),
    info: (s) => console.log(s),
  };
}

// CLI entry point. Skip when imported (e.g., by tests) so we don't run
// `process.exit` on import; only execute when this is the main module.
const isMain =
  typeof process !== 'undefined' &&
  process.argv[1] &&
  resolveScriptPath() === resolve(process.argv[1]);

function resolveScriptPath() {
  // import.meta.url is a file:// URL; strip the prefix portably.
  return resolve(new URL(import.meta.url).pathname);
}

if (isMain) {
  const localesRoot = resolve(import.meta.dirname, '..', 'src', 'i18n', 'locales');
  const strict = process.argv.includes('--strict') || process.env.CI === 'true';
  const result = runI18nCheck({ root: localesRoot, strict, log: consoleLog() });
  if (!result.ok) process.exit(1);
}
