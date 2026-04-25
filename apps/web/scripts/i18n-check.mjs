#!/usr/bin/env node
/**
 * Catalog completeness + untranslated-string heuristic.
 *
 * Walks `src/i18n/locales/<lang>/*.json` and verifies every non-`en` catalog:
 *   1. Has the same key set as the matching `en` file.
 *   2. Has no string that's byte-identical to `en` (likely untranslated)
 *      unless the key is on an explicit allow-list (proper nouns, glyph-only
 *      strings like "°C" / "°F").
 *
 * Untranslated keys are warnings by default and become errors in CI. See
 * SPEC.md §5.8 "Catalogs".
 *
 * Until the first non-`en` catalog lands in §10 step 10, this script just
 * logs the count and exits 0.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const localesRoot = resolve(import.meta.dirname, '..', 'src', 'i18n', 'locales');

/**
 * Keys whose values are EXPECTED to match English across locales. Anything
 * outside this list that matches `en` flags as a likely missed translation.
 */
const ALLOW_SAME_AS_SOURCE = new Set(['brand', 'header.unit.metric', 'header.unit.imperial']);

/**
 * If the en value is one of these "tokens", we assume it doesn't need
 * translating either way (e.g. brand mentions inside larger keys).
 */
const SHARED_TOKENS = new Set(['MyWeather', 'Open-Meteo', 'CLDR']);

const STRICT = process.argv.includes('--strict') || process.env.CI === 'true';

function safeReaddir(p) {
  try {
    return readdirSync(p);
  } catch {
    return null;
  }
}

const langs = safeReaddir(localesRoot);
if (!langs) {
  console.log('i18n:check: no catalogs yet (i18n foundation lands in §10 step 5) — skipping.');
  process.exit(0);
}

const sourceLang = 'en';
if (!langs.includes(sourceLang)) {
  console.error(`i18n:check: missing source catalog "${sourceLang}/" in ${localesRoot}`);
  process.exit(1);
}

function flatten(obj, prefix = '') {
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

function catalogFor(lang) {
  const dir = join(localesRoot, lang);
  if (!statSync(dir).isDirectory()) return null;
  const merged = {};
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.json'))) {
    const ns = file.replace(/\.json$/, '');
    merged[ns] = JSON.parse(readFileSync(join(dir, file), 'utf8'));
  }
  return merged;
}

const sourceCatalog = catalogFor(sourceLang);
const sourceFlat = flatten(sourceCatalog);

let errored = false;
let warned = false;
const otherLangs = langs.filter((l) => l !== sourceLang);

for (const lang of otherLangs) {
  const cat = catalogFor(lang);
  if (!cat) continue;
  const flat = flatten(cat);

  const missing = [...sourceFlat.keys()].filter((k) => !flat.has(k));
  const extra = [...flat.keys()].filter((k) => !sourceFlat.has(k));

  if (missing.length || extra.length) {
    errored = true;
    console.error(`\ni18n:check: ${lang}/ catalog out of sync with ${sourceLang}/`);
    if (missing.length) console.error('  missing keys:\n   - ' + missing.join('\n   - '));
    if (extra.length) console.error('  unexpected keys:\n   - ' + extra.join('\n   - '));
  }

  const untranslated = [];
  for (const [key, value] of flat) {
    const sourceValue = sourceFlat.get(key);
    if (sourceValue === undefined) continue;
    if (value !== sourceValue) continue;
    if (ALLOW_SAME_AS_SOURCE.has(key)) continue;
    if (SHARED_TOKENS.has(value)) continue;
    untranslated.push(`${key} = ${JSON.stringify(value)}`);
  }

  if (untranslated.length) {
    const tag = STRICT ? 'error' : 'warn';
    console[STRICT ? 'error' : 'warn'](
      `\ni18n:check: ${lang}/ has ${untranslated.length} key(s) identical to ${sourceLang}/ (likely untranslated):`,
    );
    for (const u of untranslated) console[STRICT ? 'error' : 'warn']('   - ' + u);
    if (STRICT) errored = true;
    else warned = true;
    void tag;
  }
}

if (errored) process.exit(1);

if (otherLangs.length === 0) {
  console.log(`i18n:check: 1 catalog (${sourceLang}/) — additional locales land in §10 step 10.`);
} else {
  console.log(
    `i18n:check: ${langs.length} catalog(s) in sync with ${sourceLang}/${warned ? ' (with warnings)' : ''}.`,
  );
}
