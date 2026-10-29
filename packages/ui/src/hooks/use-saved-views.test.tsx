import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useSavedViews } from "./use-saved-views";

const SCOPE = "org-foo:env-bar:programs";
const STORAGE_KEY = `loom-hub-saved-views:${SCOPE}`;

describe("useSavedViews", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("saves a view and lights it as active when the current search matches", () => {
    const { result, rerender } = renderHook(
      ({ currentSearch }: { currentSearch: Record<string, unknown> }) =>
        useSavedViews({ scope: SCOPE, currentSearch, onApply: vi.fn() }),
      { initialProps: { currentSearch: { type: "COUPON" } } }
    );

    expect(result.current.views).toHaveLength(0);

    act(() => result.current.saveCurrentAs("Coupons"));

    expect(result.current.views.map((v) => v.name)).toEqual(["Coupons"]);
    expect(result.current.activeViewId).toBe(result.current.views[0]?.id);

    rerender({ currentSearch: { type: "EXTERNAL" } });
    expect(result.current.activeViewId).toBeNull();
  });

  it("applyView calls onApply with the saved search snapshot", () => {
    const onApply = vi.fn();
    const { result } = renderHook(() =>
      useSavedViews({ scope: SCOPE, currentSearch: { type: "COUPON" }, onApply })
    );

    act(() => result.current.saveCurrentAs("Coupons"));
    const id = result.current.views[0]?.id ?? "";
    act(() => result.current.applyView(id));

    expect(onApply).toHaveBeenCalledWith({ type: "COUPON" });
  });

  it("deletes a view", () => {
    const { result } = renderHook(() =>
      useSavedViews({ scope: SCOPE, currentSearch: {}, onApply: vi.fn() })
    );

    act(() => result.current.saveCurrentAs("A"));
    const id = result.current.views[0]?.id ?? "";
    act(() => result.current.deleteView(id));

    expect(result.current.views).toHaveLength(0);
  });

  it("ignores empty names", () => {
    const { result } = renderHook(() =>
      useSavedViews({ scope: SCOPE, currentSearch: { type: "COUPON" }, onApply: vi.fn() })
    );

    act(() => result.current.saveCurrentAs("   "));
    expect(result.current.views).toHaveLength(0);
  });

  it("is a no-op when scope is null (pre-auth)", () => {
    const { result } = renderHook(() =>
      useSavedViews({ scope: null, currentSearch: { type: "COUPON" }, onApply: vi.fn() })
    );

    act(() => result.current.saveCurrentAs("X"));
    expect(result.current.views).toHaveLength(0);
  });

  it("persists at the expected localStorage key", () => {
    const { result } = renderHook(() =>
      useSavedViews({ scope: SCOPE, currentSearch: { type: "COUPON" }, onApply: vi.fn() })
    );

    act(() => result.current.saveCurrentAs("Coupons"));

    const raw = window.localStorage.getItem(STORAGE_KEY);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw ?? "{}") as {
      version: number;
      views: Array<{ name: string; search: Record<string, unknown> }>;
    };
    expect(parsed.version).toBe(1);
    expect(parsed.views).toHaveLength(1);
    expect(parsed.views[0]?.name).toBe("Coupons");
    expect(parsed.views[0]?.search).toEqual({ type: "COUPON" });
  });

  it("a second hook instance with the same scope reads the saved view back", () => {
    const { result: first } = renderHook(() =>
      useSavedViews({ scope: SCOPE, currentSearch: { type: "COUPON" }, onApply: vi.fn() })
    );
    act(() => first.current.saveCurrentAs("Coupons"));

    const { result: second } = renderHook(() =>
      useSavedViews({ scope: SCOPE, currentSearch: {}, onApply: vi.fn() })
    );

    expect(second.current.views.map((v) => v.name)).toEqual(["Coupons"]);
  });

  it("scopes views per scope string (different scope sees no views)", () => {
    const { result: programs } = renderHook(() =>
      useSavedViews({ scope: SCOPE, currentSearch: {}, onApply: vi.fn() })
    );
    const { result: tiers } = renderHook(() =>
      useSavedViews({
        scope: "org-foo:env-bar:tiers",
        currentSearch: {},
        onApply: vi.fn(),
      })
    );

    act(() => programs.current.saveCurrentAs("Program view"));

    expect(programs.current.views).toHaveLength(1);
    expect(tiers.current.views).toHaveLength(0);
  });
});
