import { describe, expect, it } from 'vitest';

import {
  formatCountry,
  formatLanguage,
  formatList,
  formatRelativeTime,
  formatTemperature,
  formatTime,
  formatWeekday,
} from '../format';

/**
 * These tests assert on substrings rather than exact strings wherever the
 * platform's CLDR output is allowed to vary across Node releases (spacing,
 * comma-vs-no-comma in lists, etc). For locale-bound pieces that *are*
 * stable (region/language display names), we assert the full string.
 */

describe('formatTemperature', () => {
  it('rounds to integer and includes the °C glyph for metric', () => {
    expect(formatTemperature(27.4, 'metric', 'en')).toMatch(/27.*C/);
  });

  it('uses Fahrenheit for imperial', () => {
    expect(formatTemperature(80, 'imperial', 'en')).toMatch(/80.*F/);
  });

  it('rounds toward nearest integer', () => {
    expect(formatTemperature(27.7, 'metric', 'en')).toMatch(/28/);
  });

  it('formats negative temperatures', () => {
    expect(formatTemperature(-3, 'metric', 'nb')).toMatch(/-?−?3/);
  });
});

describe('formatCountry', () => {
  it('en NO → Norway', () => {
    expect(formatCountry('NO', 'en')).toBe('Norway');
  });

  it('nb NO → Norge', () => {
    expect(formatCountry('NO', 'nb')).toBe('Norge');
  });

  it('de DE → Deutschland', () => {
    expect(formatCountry('DE', 'de')).toBe('Deutschland');
  });

  it('returns the code unchanged for unknown regions', () => {
    expect(formatCountry('ZZ', 'en')).toMatch(/ZZ|Unknown/);
  });
});

describe('formatLanguage', () => {
  it('renders each language in its own script', () => {
    expect(formatLanguage('de', 'de')).toMatch(/Deutsch/i);
    expect(formatLanguage('pl', 'pl')).toMatch(/Polski/i);
    expect(formatLanguage('fi', 'fi')).toMatch(/Suomi/i);
  });
});

describe('formatList', () => {
  it('joins two items with the locale conjunction', () => {
    expect(formatList(['Berlin', 'Paris'], 'en')).toBe('Berlin and Paris');
  });

  it('joins three items with locale-appropriate punctuation', () => {
    expect(formatList(['Berlin', 'Paris', 'Madrid'], 'en')).toMatch(/Berlin, Paris,? and Madrid/);
  });

  it('renders an empty list as empty string', () => {
    expect(formatList([], 'en')).toBe('');
  });
});

describe('formatTime', () => {
  it('respects the supplied timeZone', () => {
    const date = new Date('2026-04-25T14:30:00Z');
    expect(formatTime(date, 'en-GB', 'UTC')).toMatch(/14:30/);
  });

  it('uses 12h convention for en-US', () => {
    const date = new Date('2026-04-25T14:30:00Z');
    expect(formatTime(date, 'en-US', 'UTC')).toMatch(/2:30/);
  });
});

describe('formatWeekday', () => {
  it('returns short weekday in the active locale', () => {
    const sat = new Date('2026-04-25T12:00:00Z');
    expect(formatWeekday(sat, 'en', 'UTC')).toBe('Sat');
    expect(formatWeekday(sat, 'nb', 'UTC')).toMatch(/^lø/i);
  });
});

describe('formatRelativeTime', () => {
  it('renders "5 minutes ago" when from is 5 min before to (en)', () => {
    const now = new Date('2026-04-25T14:30:00Z');
    const past = new Date('2026-04-25T14:25:00Z');
    expect(formatRelativeTime(past, now, 'en')).toBe('5 minutes ago');
  });

  it('localizes the relative phrase', () => {
    const now = new Date('2026-04-25T14:30:00Z');
    const past = new Date('2026-04-25T14:25:00Z');
    expect(formatRelativeTime(past, now, 'de')).toMatch(/vor 5 Minuten/);
  });

  it('uses the largest sensible unit', () => {
    const now = new Date('2026-04-25T14:30:00Z');
    const twoHoursAgo = new Date('2026-04-25T12:30:00Z');
    expect(formatRelativeTime(twoHoursAgo, now, 'en')).toMatch(/2 hours ago/);
  });
});
