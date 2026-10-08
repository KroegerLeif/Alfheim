import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useRestTimer } from "../hooks/useRestTimer";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useRestTimer", () => {
  it("counts down from a wall-clock deadline and reports completion once", () => {
    const onComplete = vi.fn();
    const { result } = renderHook(() => useRestTimer(onComplete));

    act(() => result.current.start(3));
    expect(result.current.secondsRemaining).toBe(3);
    expect(result.current.isRunning).toBe(true);

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(result.current.secondsRemaining).toBe(1);

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current.secondsRemaining).toBeNull();
    expect(result.current.isRunning).toBe(false);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("stays correct after the tab was throttled for a long time", () => {
    const { result } = renderHook(() => useRestTimer());
    act(() => result.current.start(90));

    act(() => {
      vi.setSystemTime(Date.now() + 60_000);
      vi.advanceTimersByTime(250);
    });

    expect(result.current.secondsRemaining).toBe(30);
  });

  it("can be skipped", () => {
    const onComplete = vi.fn();
    const { result } = renderHook(() => useRestTimer(onComplete));
    act(() => result.current.start(30));

    act(() => result.current.skip());

    expect(result.current.isRunning).toBe(false);
    expect(result.current.secondsRemaining).toBeNull();
    expect(onComplete).not.toHaveBeenCalled();
  });

  it("ignores a zero or negative duration", () => {
    const { result } = renderHook(() => useRestTimer());

    act(() => result.current.start(0));
    expect(result.current.isRunning).toBe(false);

    act(() => result.current.start(-5));
    expect(result.current.isRunning).toBe(false);
  });
});
