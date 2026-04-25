/**
 * Boot-time language resolution test.
 *
 * Regression for: when the persisted locale is non-English, the
 * LanguagePicker dropdown was reading `i18n.resolvedLanguage === 'en'`
 * on first paint because only the en bundle is registered at init time
 * (the others are dynamic imports). The fix re-emits `changeLanguage`
 * after the initial catalog finishes loading so the resolved-language
 * pin moves off `en`.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('i18n boot path', () => {
  beforeEach(() => {
    vi.resetModules();
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it('resolves to the persisted non-English locale after boot, not en', async () => {
    window.localStorage.setItem('lang', 'pl');

    const i18nModule = await import('../index');
    const i18n = i18nModule.default;

    // The catalog loads asynchronously; wait for the post-init
    // changeLanguage round-trip to complete.
    await vi.waitFor(() => {
      expect(i18n.hasResourceBundle('pl', 'common')).toBe(true);
      expect(i18n.resolvedLanguage).toBe('pl');
    });
    expect(i18n.language).toBe('pl');
  });

  it('keeps resolvedLanguage = en when the persisted locale is en', async () => {
    window.localStorage.setItem('lang', 'en');

    const i18nModule = await import('../index');
    const i18n = i18nModule.default;

    await vi.waitFor(() => {
      expect(i18n.language).toBe('en');
    });
    expect(i18n.resolvedLanguage).toBe('en');
  });
});
