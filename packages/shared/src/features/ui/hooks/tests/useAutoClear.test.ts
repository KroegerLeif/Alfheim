import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAutoClear } from '../useAutoClear';

describe('useAutoClear', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('clears a set value after the delay', () => {
    const clear = vi.fn();
    renderHook(() => useAutoClear('saved', clear, 1000));

    vi.advanceTimersByTime(999);
    expect(clear).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(clear).toHaveBeenCalledTimes(1);
  });

  it.each([null, undefined, false, ''])('starts no timer for the unset value %s', (value) => {
    const clear = vi.fn();
    renderHook(() => useAutoClear(value, clear, 10));

    vi.advanceTimersByTime(100);
    expect(clear).not.toHaveBeenCalled();
  });

  it('never calls clear after unmount (#647)', () => {
    const clear = vi.fn();
    const { unmount } = renderHook(() => useAutoClear(true, clear, 1000));

    unmount();
    vi.advanceTimersByTime(5000);
    expect(clear).not.toHaveBeenCalled();
  });

  it('restarts the timer when the value changes', () => {
    const clear = vi.fn();
    const { rerender } = renderHook(({ value }) => useAutoClear(value, clear, 1000), {
      initialProps: { value: 'token' as string | null },
    });

    vi.advanceTimersByTime(800);
    rerender({ value: 'link' });
    vi.advanceTimersByTime(800);
    expect(clear).not.toHaveBeenCalled();
    vi.advanceTimersByTime(200);
    expect(clear).toHaveBeenCalledTimes(1);
  });

  it('cancels the timer when the value is cleared early', () => {
    const clear = vi.fn();
    const { rerender } = renderHook(({ value }) => useAutoClear(value, clear, 1000), {
      initialProps: { value: true },
    });

    rerender({ value: false });
    vi.advanceTimersByTime(5000);
    expect(clear).not.toHaveBeenCalled();
  });

  it('runs the latest clear callback', () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = renderHook(({ clear }) => useAutoClear(true, clear, 1000), {
      initialProps: { clear: first },
    });

    rerender({ clear: second });
    vi.advanceTimersByTime(1000);
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });
});
