import "@testing-library/jest-dom/vitest";

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { usePersistedCollapse } from "./use-persisted-collapse";

beforeEach(() => window.localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe("usePersistedCollapse", () => {
  it("starts from the default, toggles, and remembers under the key", () => {
    const { result, unmount } = renderHook(() => usePersistedCollapse("k", false));
    expect(result.current[0]).toBe(false);
    act(() => result.current[1]());
    expect(result.current[0]).toBe(true);
    expect(window.localStorage.getItem("k")).toBe("true");
    unmount();

    const again = renderHook(() => usePersistedCollapse("k", false));
    expect(again.result.current[0]).toBe(true);
  });

  it("reads the new key when the key changes instead of writing the old value over it", () => {
    window.localStorage.setItem("a", "true");
    window.localStorage.setItem("b", "false");
    const { result, rerender } = renderHook(({ key }) => usePersistedCollapse(key, false), {
      initialProps: { key: "a" },
    });
    expect(result.current[0]).toBe(true);
    rerender({ key: "b" });
    expect(result.current[0]).toBe(false);
    expect(window.localStorage.getItem("b")).toBe("false");
  });

  it("keeps working for the session when storage throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("denied");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("denied");
    });
    const { result } = renderHook(() => usePersistedCollapse("k", false));
    expect(result.current[0]).toBe(false);
    act(() => result.current[1]());
    expect(result.current[0]).toBe(true);
  });

  it("holds state without a key", () => {
    const { result } = renderHook(() => usePersistedCollapse(undefined, true));
    expect(result.current[0]).toBe(true);
    act(() => result.current[1]());
    expect(result.current[0]).toBe(false);
  });
});
