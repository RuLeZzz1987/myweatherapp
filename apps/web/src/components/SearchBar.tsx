import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { useGeocode, GEOCODE_MIN_QUERY } from '../hooks/useGeocode';
import { formatCountry } from '../i18n/format';
import type { GeocodeResult } from '../lib/api/types';

/**
 * SearchBar — WAI-ARIA Authoring Practices 1.2 combobox.
 *
 * Roles & wiring (see SPEC.md §5.5):
 *   - The text input carries `role=combobox`, `aria-expanded`,
 *     `aria-controls=<listbox id>`, `aria-autocomplete=list`, and
 *     `aria-activedescendant=<active option id>` while the listbox is
 *     open.
 *   - The dropdown is a `role=listbox` sibling of the input (not a
 *     descendant), so `aria-activedescendant` is the canonical way to
 *     signal which option is "focused" while keyboard focus stays in
 *     the input.
 *   - Each option has `role=option`, a stable id, and `aria-selected`
 *     reflecting the active option.
 *
 * Keyboard model:
 *   - ArrowDown / ArrowUp: move active option, opening the listbox if
 *     closed and there are results.
 *   - Enter: select the active option (no-op if none active).
 *   - Escape: clear the input first, then close the listbox if already
 *     empty (matches the search-field convention in modern browsers).
 *
 * Country/admin1 labels go through `Intl.DisplayNames` so a `de` user
 * sees "Berlin, Deutschland" while an `nb` user sees "Berlin, Tyskland".
 *
 * The component is intentionally presentational — selection is reported
 * via `onSelect`; the parent (App, in §10 step 7) decides what to do
 * with the result (push city onto recent searches, navigate to the
 * weather hero, etc.).
 */

export interface SearchBarProps {
  onSelect: (result: GeocodeResult) => void;
  /**
   * Optional initial value — used by the parent when the URL already
   * carries a `name` for a deep-linked city.
   */
  initialValue?: string;
  /**
   * Auto-clear the input after a selection. Defaults to true; the
   * primary view in §10 step 7 will turn this off so the chosen city
   * stays visible in the field.
   */
  clearOnSelect?: boolean;
}

const DEBOUNCE_MS = 250;

export function SearchBar({ onSelect, initialValue = '', clearOnSelect = true }: SearchBarProps) {
  const { t, i18n } = useTranslation();
  const activeLocale = i18n.resolvedLanguage ?? i18n.language;
  const listboxId = useId();
  const inputId = useId();
  const optionPrefix = useId();

  const [value, setValue] = useState(initialValue);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const debouncedValue = useDebouncedValue(value, DEBOUNCE_MS);
  const { data, isLoading, isError } = useGeocode(debouncedValue, {
    language: activeLocale,
  });
  const results = useMemo<GeocodeResult[]>(() => data?.results ?? [], [data]);

  const trimmedLength = debouncedValue.trim().length;
  const tooShort = trimmedLength < GEOCODE_MIN_QUERY;
  const hasNoMatches = !tooShort && !isLoading && !isError && results.length === 0;

  // Close the listbox when the user clicks elsewhere.
  useEffect(() => {
    if (!isOpen) return;
    function onPointerDown(e: PointerEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [isOpen]);

  // Pin activeIndex inside bounds during render — avoids an effect that
  // would call setState reactively (React docs: "you might not need an
  // effect" / lint rule `react-hooks/set-state-in-effect`). When results
  // shrink or empty out, the reader sees a clamped index without a tear.
  const effectiveActiveIndex =
    results.length === 0 ? -1 : Math.min(activeIndex, results.length - 1);

  function commitSelection(result: GeocodeResult) {
    onSelect(result);
    setIsOpen(false);
    setActiveIndex(-1);
    if (clearOnSelect) setValue('');
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (results.length === 0) return;
      setIsOpen(true);
      setActiveIndex((i) => {
        const cur = i < 0 ? -1 : Math.min(i, results.length - 1);
        return (cur + 1) % results.length;
      });
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (results.length === 0) return;
      setIsOpen(true);
      setActiveIndex((i) => {
        const cur = i < 0 ? -1 : Math.min(i, results.length - 1);
        return cur <= 0 ? results.length - 1 : cur - 1;
      });
      return;
    }
    if (e.key === 'Enter') {
      if (isOpen && effectiveActiveIndex >= 0 && results[effectiveActiveIndex]) {
        e.preventDefault();
        commitSelection(results[effectiveActiveIndex]);
      }
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      if (value.length > 0) {
        setValue('');
      } else {
        setIsOpen(false);
      }
    }
  }

  const showListbox =
    isOpen && (results.length > 0 || hasNoMatches || isError || (isLoading && !tooShort));
  const activeOptionId =
    effectiveActiveIndex >= 0 && results[effectiveActiveIndex]
      ? `${optionPrefix}-${results[effectiveActiveIndex].id}`
      : undefined;

  function describeResult(r: GeocodeResult): string {
    const country = formatCountry(r.countryCode, activeLocale);
    if (r.admin1) {
      return t('search.resultLocationWithRegion', {
        name: r.name,
        admin1: r.admin1,
        country,
      });
    }
    return t('search.resultLocation', { name: r.name, country });
  }

  return (
    <div ref={containerRef} className="relative w-full max-w-sm">
      <label htmlFor={inputId} className="sr-only">
        {t('header.searchLabel')}
      </label>
      <input
        id={inputId}
        type="text"
        role="combobox"
        autoComplete="off"
        spellCheck={false}
        aria-expanded={showListbox}
        aria-controls={listboxId}
        aria-autocomplete="list"
        {...(activeOptionId ? { 'aria-activedescendant': activeOptionId } : {})}
        placeholder={t('header.searchPlaceholder')}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setIsOpen(true);
          setActiveIndex(-1);
        }}
        onFocus={() => {
          if (results.length > 0) setIsOpen(true);
        }}
        onKeyDown={handleKeyDown}
        className="w-full rounded-md border border-border bg-surface px-3 py-2 text-text placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
      />

      <ul
        id={listboxId}
        role="listbox"
        hidden={!showListbox}
        className="absolute left-0 right-0 z-10 mt-1 max-h-72 overflow-auto rounded-md border border-border bg-bg shadow-lg"
      >
        {results.map((r, idx) => {
          const isActive = idx === effectiveActiveIndex;
          return (
            <li
              key={r.id}
              id={`${optionPrefix}-${r.id}`}
              role="option"
              aria-selected={isActive}
              onMouseDown={(e) => {
                // Prevent the input's blur so we keep focus through the
                // selection — important for screen reader announcements.
                e.preventDefault();
              }}
              onClick={() => {
                commitSelection(r);
              }}
              className={`cursor-pointer px-3 py-2 text-sm ${
                isActive ? 'bg-surface-strong text-text' : 'text-text hover:bg-surface'
              }`}
            >
              {describeResult(r)}
            </li>
          );
        })}

        {hasNoMatches && (
          <li role="option" aria-disabled="true" className="px-3 py-2 text-sm text-muted">
            {t('search.noResults')}
          </li>
        )}
        {isError && (
          <li role="option" aria-disabled="true" className="px-3 py-2 text-sm text-muted">
            {t('search.error')}
          </li>
        )}
        {isLoading && !tooShort && results.length === 0 && (
          <li role="option" aria-disabled="true" className="px-3 py-2 text-sm text-muted">
            {t('search.loading')}
          </li>
        )}
      </ul>

      {/* Off-screen polite live region. WAI-ARIA Authoring Practices
          1.2 says comboboxes should announce result COUNT, not the
          first option's content (the active option is already exposed
          via aria-activedescendant). This satisfies WCAG 2.1 SC 4.1.3
          "Status Messages". We rely on i18next CLDR plurals for the
          count copy. */}
      <span className="sr-only" role="status" aria-live="polite">
        {searchStatusMessage()}
      </span>
    </div>
  );

  function searchStatusMessage(): string {
    if (!showListbox) return '';
    if (isError) return t('search.error');
    if (isLoading && !tooShort) return t('search.loading');
    if (tooShort) return '';
    if (results.length === 0) return t('search.noResults');
    return t('search.resultsCount', { count: results.length });
  }
}
