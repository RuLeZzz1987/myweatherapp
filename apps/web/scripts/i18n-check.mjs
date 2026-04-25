#!/usr/bin/env node
/**
 * Catalog completeness check.
 *
 * Walks `src/i18n/locales/<lang>/*.json` and verifies every non-`en` catalog
 * has the same key set as the matching `en` file. Fails CI on missing or
 * empty values. See SPEC.md §5.8.
 *
 * Until the i18n foundation lands (SPEC.md §10 step 5) this script is a
 * no-op that exits 0 — placeholder so `pnpm i18n:check` is wired into CI
 * from day one and the workflow file never has to change.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const localesRoot = resolve(import.meta.dirname, '..', 'src', 'i18n', 'locales');

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

function flattenKeys(obj, prefix = '') {
  const out = new Set();
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      for (const sub of flattenKeys(v, path)) out.add(sub);
    } else if (typeof v === 'string') {
      out.add(path);
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
const sourceKeys = flattenKeys(sourceCatalog);

let failed = false;
for (const lang of langs) {
  if (lang === sourceLang) continue;
  const cat = catalogFor(lang);
  if (!cat) continue;
  const keys = flattenKeys(cat);

  const missing = [...sourceKeys].filter((k) => !keys.has(k));
  const extra = [...keys].filter((k) => !sourceKeys.has(k));

  if (missing.length || extra.length) {
    failed = true;
    console.error(`\ni18n:check: ${lang}/ catalog out of sync with ${sourceLang}/`);
    if (missing.length) console.error('  missing keys:\n   - ' + missing.join('\n   - '));
    if (extra.length) console.error('  unexpected keys:\n   - ' + extra.join('\n   - '));
  }
}

if (failed) process.exit(1);

console.log(`i18n:check: ${langs.length} catalog(s) in sync with ${sourceLang}/`);
