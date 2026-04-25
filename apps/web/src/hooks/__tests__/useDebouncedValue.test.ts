import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useDebouncedValue } from '../useDebouncedValue';

describe('useDebouncedValue', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns the initial value synchronously on mount', () => {
    const { result } = renderHook(() => useDebouncedValue('hello', 250));
    expect(result.current).toBe('hello');
  });

  it('does not update before the delay elapses', () => {
    const { result, rerender } = renderHook(
      ({ value }: { value: string }) => useDebouncedValue(value, 250),
      { initialProps: { value: 'a' } },
    );

    rerender({ value: 'ab' });
    rerender({ value: 'abc' });
    act(() => {
      vi.advanceTimersByTime(249);
    });
    expect(result.current).toBe('a');
  });

  it('updates once after the delay elapses without further changes', () => {
    const { result, rerender } = renderHook(
      ({ value }: { value: string }) => useDebouncedValue(value, 250),
      { initialProps: { value: 'a' } },
    );

    rerender({ value: 'ab' });
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(result.current).toBe('ab');
  });

  it('only fires the trailing value when changes burst within the window', () => {
    const { result, rerender } = renderHook(
      ({ value }: { value: string }) => useDebouncedValue(value, 250),
      { initialProps: { value: 'a' } },
    );

    rerender({ value: 'ab' });
    act(() => {
      vi.advanceTimersByTime(100);
    });
    rerender({ value: 'abc' });
    act(() => {
      vi.advanceTimersByTime(100);
    });
    rerender({ value: 'abcd' });
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(result.current).toBe('abcd');
  });

  it('with delayMs=0, propagates changes after the next macrotask flush', () => {
    const { result, rerender } = renderHook(
      ({ value }: { value: string }) => useDebouncedValue(value, 0),
      { initialProps: { value: 'a' } },
    );

    rerender({ value: 'b' });
    act(() => {
      vi.advanceTimersByTime(0);
    });
    expect(result.current).toBe('b');
  });

  it('clears the pending timer on unmount', () => {
    const { rerender, unmount } = renderHook(
      ({ value }: { value: string }) => useDebouncedValue(value, 250),
      { initialProps: { value: 'a' } },
    );

    rerender({ value: 'b' });
    unmount();
    // Advancing past the delay should not throw or attempt to setState
    // on the unmounted component.
    expect(() => {
      vi.advanceTimersByTime(500);
    }).not.toThrow();
  });
});
