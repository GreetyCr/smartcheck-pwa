import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { useNow } from "@/hooks/useNow";

describe("useNow", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-04T12:00:00.000Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  test("avanza solo, sin que nadie provoque un render", () => {
    const { result } = renderHook(() => useNow(30_000));
    const start = result.current;

    act(() => {
      vi.advanceTimersByTime(30_000);
    });
    expect(result.current).toBe(start + 30_000);

    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(result.current).toBe(start + 90_000);
  });

  test("con intervalo <= 0 se queda quieto, y al desmontar no deja timers", () => {
    const { result, unmount } = renderHook(() => useNow(0));
    const start = result.current;

    act(() => {
      vi.advanceTimersByTime(120_000);
    });
    expect(result.current).toBe(start);

    const { unmount: unmountTicking } = renderHook(() => useNow(30_000));
    expect(vi.getTimerCount()).toBe(1);
    unmountTicking();
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
