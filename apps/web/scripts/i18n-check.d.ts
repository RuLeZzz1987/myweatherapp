/**
 * Ambient declarations for `scripts/i18n-check.mjs`. The script is plain
 * ESM (no TS), but we import it from the test suite, so a tiny shim
 * keeps the typecheck honest without forcing the script into a TS build.
 */
declare module '*/i18n-check.mjs' {
  export interface I18nCheckLog {
    warn: (message: string) => void;
    error: (message: string) => void;
    info: (message: string) => void;
  }

  export interface I18nCheckIssues {
    missing: string[];
    extra: string[];
    missingOther: string[];
    untranslated: string[];
  }

  export interface I18nCheckOptions {
    root: string;
    strict?: boolean;
    log?: I18nCheckLog;
  }

  export interface I18nCheckResult {
    ok: boolean;
    warned: boolean;
    errored: boolean;
    skipped?: boolean;
    missingSource?: boolean;
    issuesByLang: Record<string, I18nCheckIssues | undefined>;
  }

  export function runI18nCheck(options: I18nCheckOptions): I18nCheckResult;
  export function baseKey(key: string): string;
  export function isPluralVariant(key: string): boolean;
  export function isFormatOnly(value: string): boolean;
  export function flatten(obj: unknown, prefix?: string): Map<string, string>;
}
