import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useDebouncedValue } from "./use-debounced-value";

describe("[audit] useDebouncedValue", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns the initial value synchronously", () => {
    const { result } = renderHook(() => useDebouncedValue("a", 250));
    expect(result.current).toBe("a");
  });

  it("delays updates by delayMs", () => {
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 250), {
      initialProps: { value: "a" },
    });

    rerender({ value: "b" });
    expect(result.current).toBe("a");

    act(() => {
      vi.advanceTimersByTime(249);
    });
    expect(result.current).toBe("a");

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBe("b");
  });

  it("coalesces rapid changes — emits only the latest after the delay", () => {
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 250), {
      initialProps: { value: "" },
    });

    rerender({ value: "a" });
    act(() => {
      vi.advanceTimersByTime(50);
    });
    rerender({ value: "ab" });
    act(() => {
      vi.advanceTimersByTime(50);
    });
    rerender({ value: "abc" });
    act(() => {
      vi.advanceTimersByTime(50);
    });
    rerender({ value: "abcd" });

    expect(result.current).toBe("");

    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(result.current).toBe("abcd");
  });

  it("respects a changed delayMs", () => {
    const { result, rerender } = renderHook(({ value, delay }) => useDebouncedValue(value, delay), {
      initialProps: { value: "a", delay: 250 },
    });

    rerender({ value: "b", delay: 100 });
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(result.current).toBe("b");
  });

  it("clears its pending timer on unmount", () => {
    const { result, rerender, unmount } = renderHook(({ value }) => useDebouncedValue(value, 250), {
      initialProps: { value: "a" },
    });

    rerender({ value: "b" });
    unmount();

    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(result.current).toBe("a");
  });
});
