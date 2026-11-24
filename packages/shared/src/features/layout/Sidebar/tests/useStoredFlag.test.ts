import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useStoredFlag } from '../useStoredFlag';

const KEY = 'alfheim_test_sidebar_collapsed';

afterEach(() => {
  localStorage.clear();
});

describe('useStoredFlag', () => {
  it('returns the fallback when nothing is stored', () => {
    const { result } = renderHook(() => useStoredFlag(KEY));
    expect(result.current[0]).toBe(false);

    const withFallback = renderHook(() => useStoredFlag(KEY, true));
    expect(withFallback.result.current[0]).toBe(true);
  });

  it('reads the stored value', () => {
    localStorage.setItem(KEY, 'true');
    const { result } = renderHook(() => useStoredFlag(KEY));
    expect(result.current[0]).toBe(true);
  });

  it('persists updates and notifies every reader of the key', () => {
    const first = renderHook(() => useStoredFlag(KEY));
    const second = renderHook(() => useStoredFlag(KEY));

    act(() => first.result.current[1](true));

    expect(localStorage.getItem(KEY)).toBe('true');
    expect(first.result.current[0]).toBe(true);
    expect(second.result.current[0]).toBe(true);
  });

  it('follows changes made in another tab', () => {
    const { result } = renderHook(() => useStoredFlag(KEY));

    act(() => {
      localStorage.setItem(KEY, 'true');
      window.dispatchEvent(new StorageEvent('storage', { key: KEY, newValue: 'true' }));
    });

    expect(result.current[0]).toBe(true);
  });
});
