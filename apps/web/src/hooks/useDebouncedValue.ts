import { useEffect, useState } from 'react';

/**
 * Debounce a value by `delayMs`. Returns the latest value the caller has
 * passed in, after no further changes for `delayMs`.
 *
 * Used by the search combobox (SPEC §5.2 step 3): the user's keystroke
 * stream feeds straight into a TanStack Query `useGeocode` query, but we
 * delay it 250ms so we only call the geocoder when the user pauses typing.
 *
 * Implementation notes:
 *   - The first render returns the initial value synchronously, so a
 *     consumer can safely use it as a query key without an extra "loading"
 *     branch on mount.
 *   - The pending timer is cleared on unmount and on every value change,
 *     so a flurry of changes only ever fires the trailing one.
 *   - `delayMs` is read from props each effect run; changing the delay
 *     restarts the timer with the new duration.
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState<T>(value);

  useEffect(() => {
    // Always schedule via a timer (even at 0ms) so we never call setState
    // synchronously inside the effect body — cleaner re-render semantics
    // and keeps the lint rule honest.
    const id = setTimeout(
      () => {
        setDebounced(value);
      },
      Math.max(0, delayMs),
    );
    return () => {
      clearTimeout(id);
    };
  }, [value, delayMs]);

  return debounced;
}
