/**
 * Unit tests for `scripts/i18n-check.mjs`. We exercise the programmatic
 * `runI18nCheck` entry point against tmp-dir fixture catalogs so we can
 * cover failure paths (missing keys, extra keys, missing `_other` plural,
 * and the untranslated heuristic) without baking broken JSON into the
 * real `src/i18n/locales/` tree.
 */
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

// @ts-expect-error -- plain ESM script, no .d.ts.
import { runI18nCheck, baseKey, isPluralVariant, isFormatOnly, flatten } from '../../../scripts/i18n-check.mjs';

interface Logs {
  warn: string[];
  error: string[];
  info: string[];
}

function makeLog(): { log: { warn: (s: string) => void; error: (s: string) => void; info: (s: string) => void }; logs: Logs } {
  const logs: Logs = { warn: [], error: [], info: [] };
  return {
    logs,
    log: {
      warn: (s) => logs.warn.push(s),
      error: (s) => logs.error.push(s),
      info: (s) => logs.info.push(s),
    },
  };
}

function writeCatalog(root: string, lang: string, namespaces: Record<string, unknown>) {
  const dir = join(root, lang);
  mkdirSync(dir, { recursive: true });
  for (const [ns, body] of Object.entries(namespaces)) {
    writeFileSync(join(dir, `${ns}.json`), JSON.stringify(body, null, 2), 'utf8');
  }
}

describe('i18n-check pure helpers', () => {
  it('baseKey strips i18next plural suffixes', () => {
    expect(baseKey('resultsCount_one')).toBe('resultsCount');
    expect(baseKey('resultsCount_few')).toBe('resultsCount');
    expect(baseKey('resultsCount_many')).toBe('resultsCount');
    expect(baseKey('resultsCount_other')).toBe('resultsCount');
    expect(baseKey('resultsCount_zero')).toBe('resultsCount');
    expect(baseKey('resultsCount_two')).toBe('resultsCount');
    expect(baseKey('plain')).toBe('plain');
    // Doesn't strip arbitrary suffixes.
    expect(baseKey('settings_default')).toBe('settings_default');
  });

  it('isPluralVariant only matches CLDR categories', () => {
    expect(isPluralVariant('foo_one')).toBe(true);
    expect(isPluralVariant('foo_other')).toBe(true);
    expect(isPluralVariant('foo_random')).toBe(false);
    expect(isPluralVariant('foo')).toBe(false);
  });

  it('isFormatOnly skips strings that are pure placeholders / glyphs', () => {
    expect(isFormatOnly('{{value}} %')).toBe(true);
    expect(isFormatOnly('{{value}} hPa')).toBe(true);
    expect(isFormatOnly('°C')).toBe(true);
    expect(isFormatOnly('{{a}}: {{b}}, {{c}}')).toBe(true);
    expect(isFormatOnly('Conditions')).toBe(false);
    expect(isFormatOnly('{{value}} hPa with text')).toBe(false);
  });

  it('flatten produces dotted paths and ignores arrays', () => {
    const flat = flatten({
      a: { b: 'x', c: { d: 'y' } },
      e: 'z',
      // Arrays are intentionally not flattened.
      list: ['ignored'],
    });
    const map = flat as Map<string, string>;
    expect(map.get('a.b')).toBe('x');
    expect(map.get('a.c.d')).toBe('y');
    expect(map.get('e')).toBe('z');
    expect(map.has('list.0')).toBe(false);
  });
});

describe('runI18nCheck', () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'i18n-check-'));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('passes for a single en/ catalog', () => {
    writeCatalog(root, 'en', {
      common: { brand: 'MyWeather', search: { noResults: 'No results' } },
    });
    const { log, logs } = makeLog();
    const result = runI18nCheck({ root, strict: true, log });
    expect(result.ok).toBe(true);
    expect(result.errored).toBe(false);
    expect(logs.error).toHaveLength(0);
  });

  it('passes when a non-en catalog has the same base keys but different plural categories', () => {
    writeCatalog(root, 'en', {
      common: { search: { resultsCount_one: '1 result', resultsCount_other: '{{count}} results' } },
    });
    // Polish needs `_few`/`_many` per CLDR; should NOT trip the parity check.
    writeCatalog(root, 'pl', {
      common: {
        search: {
          resultsCount_one: '1 wynik',
          resultsCount_few: '{{count}} wyniki',
          resultsCount_many: '{{count}} wyników',
          resultsCount_other: '{{count}} wyniku',
        },
      },
    });
    const { log } = makeLog();
    const result = runI18nCheck({ root, strict: true, log });
    expect(result.ok).toBe(true);
    expect(result.issuesByLang.pl?.missing).toEqual([]);
    expect(result.issuesByLang.pl?.extra).toEqual([]);
  });

  it('fails when a non-en catalog has plural variants without the required _other fallback', () => {
    writeCatalog(root, 'en', {
      common: { search: { resultsCount_one: '1', resultsCount_other: '{{count}}' } },
    });
    writeCatalog(root, 'de', {
      common: {
        search: {
          // German has _one and _other normally; here we forget _other to
          // simulate a regression. i18next would silently fall back to
          // English at runtime — we want the gate to catch it pre-merge.
          resultsCount_one: '1 Ergebnis',
        },
      },
    });
    const { log, logs } = makeLog();
    const result = runI18nCheck({ root, strict: true, log });
    expect(result.ok).toBe(false);
    expect(result.issuesByLang.de?.missingOther).toContain('common.search.resultsCount');
    expect(logs.error.some((m) => m.includes('missing required `_other`'))).toBe(true);
  });

  it('fails on missing or extra base keys', () => {
    writeCatalog(root, 'en', {
      common: { greeting: 'Hello', farewell: 'Bye' },
    });
    writeCatalog(root, 'fr', {
      // missing `farewell`, adds `unknown`
      common: { greeting: 'Bonjour', unknown: 'Inconnu' },
    });
    const { log } = makeLog();
    const result = runI18nCheck({ root, strict: true, log });
    expect(result.ok).toBe(false);
    expect(result.issuesByLang.fr?.missing).toContain('common.farewell');
    expect(result.issuesByLang.fr?.extra).toContain('common.unknown');
  });

  it('flags untranslated values as warnings by default and errors in strict mode', () => {
    writeCatalog(root, 'en', {
      common: { greeting: 'Hello' },
    });
    writeCatalog(root, 'es', {
      // Missed translation: same byte-for-byte as en.
      common: { greeting: 'Hello' },
    });

    const lenient = makeLog();
    const lenientResult = runI18nCheck({ root, strict: false, log: lenient.log });
    expect(lenientResult.ok).toBe(true); // warnings don't break parity
    expect(lenientResult.warned).toBe(true);
    expect(lenient.logs.warn.length).toBeGreaterThan(0);

    const strict = makeLog();
    const strictResult = runI18nCheck({ root, strict: true, log: strict.log });
    expect(strictResult.ok).toBe(false);
    expect(strictResult.errored).toBe(true);
  });

  it('does not flag format-only strings, allow-listed keys, or shared tokens as untranslated', () => {
    writeCatalog(root, 'en', {
      common: {
        brand: 'MyWeather',
        stats: { humidityValue: '{{value}} %', windDir: { N: 'N' } },
      },
    });
    writeCatalog(root, 'sv', {
      common: {
        // Allow-listed shared token (brand).
        brand: 'MyWeather',
        // Format-only (placeholder + unit glyph).
        stats: { humidityValue: '{{value}} %', windDir: { N: 'N' } },
      },
    });
    const { log } = makeLog();
    const result = runI18nCheck({ root, strict: true, log });
    expect(result.ok).toBe(true);
    expect(result.issuesByLang.sv?.untranslated).toEqual([]);
  });

  it('reports a missing source catalog clearly', () => {
    writeCatalog(root, 'fr', { common: { greeting: 'Bonjour' } });
    const { log, logs } = makeLog();
    const result = runI18nCheck({ root, strict: true, log });
    expect(result.ok).toBe(false);
    expect(result.missingSource).toBe(true);
    expect(logs.error.some((m) => m.includes('missing source catalog'))).toBe(true);
  });

  it('skips gracefully when the locales root does not exist', () => {
    const missing = join(root, 'does-not-exist');
    const { log, logs } = makeLog();
    const result = runI18nCheck({ root: missing, strict: true, log });
    expect(result.ok).toBe(true);
    expect(result.skipped).toBe(true);
    expect(logs.info.some((m) => m.includes('no catalogs'))).toBe(true);
  });
});
