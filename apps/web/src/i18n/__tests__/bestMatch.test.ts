import { describe, expect, it } from 'vitest';

import { bestMatch, resolveInitialLocale } from '../bestMatch';

describe('bestMatch', () => {
  it('returns the exact tag when supported', () => {
    expect(bestMatch(['nb-NO'], ['nb-NO', 'nb', 'en'])).toBe('nb-NO');
  });

  it('falls back to the primary language when only the region differs', () => {
    expect(bestMatch(['fr-CA', 'es-MX'])).toBe('fr');
  });

  it('skips empty / null candidates', () => {
    expect(bestMatch([null, '', 'de-DE'])).toBe('de');
  });

  it('iterates candidates in priority order', () => {
    expect(bestMatch(['xx-YY', 'pl-PL', 'de-DE'])).toBe('pl');
  });

  it('falls back to en when nothing matches', () => {
    expect(bestMatch(['xx-YY', 'zz'])).toBe('en');
  });

  it('does not throw on malformed BCP-47 inputs', () => {
    expect(bestMatch(['not_a_locale', 'fi'])).toBe('fi');
  });

  it('handles uppercased / underscored navigator inputs', () => {
    expect(bestMatch(['NB_NO'])).toBe('nb');
  });

  it('falls back to en when given an empty list', () => {
    expect(bestMatch([])).toBe('en');
  });
});

describe('resolveInitialLocale', () => {
  function makeStorage(value: string | null) {
    return { getItem: () => value };
  }

  it('URL ?lang= overrides everything else', () => {
    expect(
      resolveInitialLocale({
        url: new URLSearchParams('?lang=de'),
        storage: makeStorage('fr'),
        navigator: { languages: ['it-IT'] },
      }),
    ).toBe('de');
  });

  it('rejects unsupported URL ?lang= and falls through', () => {
    expect(
      resolveInitialLocale({
        url: new URLSearchParams('?lang=xx'),
        navigator: { languages: ['nb-NO'] },
      }),
    ).toBe('nb');
  });

  it('uses localStorage when URL is absent', () => {
    expect(
      resolveInitialLocale({
        storage: makeStorage('sv'),
        navigator: { languages: ['it-IT'] },
      }),
    ).toBe('sv');
  });

  it('falls back to navigator.languages when URL + storage are empty', () => {
    expect(
      resolveInitialLocale({
        navigator: { languages: ['fi-FI', 'en'] },
      }),
    ).toBe('fi');
  });

  it('falls back to en when nothing is supplied', () => {
    expect(resolveInitialLocale({})).toBe('en');
  });

  it('honors a custom storage key', () => {
    expect(
      resolveInitialLocale({
        url: new URLSearchParams('?locale=pl'),
        navigator: { languages: ['en'] },
        key: 'locale',
      }),
    ).toBe('pl');
  });
});
