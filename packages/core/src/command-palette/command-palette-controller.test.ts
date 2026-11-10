import { act, renderHook } from "@testing-library/react";
import type { ComponentType } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useCommandPaletteController } from "./command-palette-controller";
import { isDashboardPath, parseScope } from "./command-palette-utils";
import type { CommandPaletteScope } from "./types";

const sdkMock = vi.hoisted(() => ({
  useEntitySearchSearchEntities: vi.fn(),
}));

vi.mock("@loom-loyalty/sdk", () => sdkMock);

const testScopes: CommandPaletteScope[] = [
  { key: "CUSTOMER", label: "Customers", prefix: "customer", requiresPrefix: true },
  { key: "EVENT_RULE", label: "Event rules", prefix: "rule" },
  { key: "HUB_CONFIG", label: "Hub configs", prefix: "hub-config" },
];
const testLabels = { EVENT_RULE: "Event rules" };
const testIcons: Record<string, ComponentType<{ className?: string }>> = {};

function renderController() {
  return renderHook(() =>
    useCommandPaletteController({
      onSelect: vi.fn(),
      scopes: testScopes,
      entityTypeLabels: testLabels,
      entityTypeIcons: testIcons,
    })
  );
}

beforeEach(() => {
  vi.useFakeTimers();
  sdkMock.useEntitySearchSearchEntities.mockReturnValue({
    data: undefined,
    isError: false,
    isFetching: false,
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("parseScope", () => {
  it("returns no scope for plain text", () => {
    expect(parseScope("nathan", testScopes)).toEqual({ scope: null, rest: "nathan" });
  });

  it("activates the matching scope when the query starts with a known prefix", () => {
    expect(parseScope("customer:nathan", testScopes)).toEqual({
      scope: "CUSTOMER",
      rest: "nathan",
    });
    expect(parseScope("rule:tier", testScopes)).toEqual({ scope: "EVENT_RULE", rest: "tier" });
    expect(parseScope("hub-config:", testScopes)).toEqual({ scope: "HUB_CONFIG", rest: "" });
  });

  it("is case-insensitive on the prefix but preserves body case", () => {
    expect(parseScope("Customer:Nathan", testScopes)).toEqual({
      scope: "CUSTOMER",
      rest: "Nathan",
    });
  });

  it("ignores unknown prefixes — keeps them in `rest` so the server sees a literal", () => {
    expect(parseScope("xyz:foo", testScopes)).toEqual({ scope: null, rest: "xyz:foo" });
    expect(parseScope("https://example.com/foo", testScopes)).toEqual({
      scope: null,
      rest: "https://example.com/foo",
    });
  });

  it("ignores a leading colon (no prefix to extract)", () => {
    expect(parseScope(":oops", testScopes)).toEqual({ scope: null, rest: ":oops" });
  });

  it("strips a leading space before the prefix but does not touch interior whitespace", () => {
    expect(parseScope("  rule:event rule", testScopes)).toEqual({
      scope: "EVENT_RULE",
      rest: "event rule",
    });
  });
});

describe("useCommandPaletteController", () => {
  it("keeps search disabled when the post-prefix query is shorter than three characters", () => {
    const { result } = renderController();

    act(() => result.current.setQuery("rule:ab"));
    act(() => vi.advanceTimersByTime(250));

    expect(sdkMock.useEntitySearchSearchEntities).toHaveBeenLastCalledWith(
      { q: "rule:ab", page: 0, size: 10 },
      expect.objectContaining({ query: expect.objectContaining({ enabled: false }) })
    );
  });

  it("coalesces rapid query changes before enabling one search", () => {
    const { result } = renderController();
    sdkMock.useEntitySearchSearchEntities.mockClear();

    act(() => {
      result.current.setQuery("a");
      result.current.setQuery("ab");
      result.current.setQuery("abc");
    });
    act(() => {
      vi.advanceTimersByTime(249);
    });

    expect(
      sdkMock.useEntitySearchSearchEntities.mock.calls.filter(
        ([, options]) => options.query.enabled
      )
    ).toHaveLength(0);

    act(() => vi.advanceTimersByTime(1));

    const enabledCalls = sdkMock.useEntitySearchSearchEntities.mock.calls.filter(
      ([, options]) => options.query.enabled
    );
    expect(enabledCalls).toHaveLength(1);
    expect(enabledCalls[0]?.[0]).toEqual({ q: "abc", page: 0, size: 10 });
  });

  it.each([
    [{ status: 429 }, false, "rate-limited"],
    [{ status: 401 }, false, "error"],
    [{ status: 403 }, false, "error"],
    [undefined, true, "error"],
    [{ status: 400 }, false, null],
  ] as const)("maps search status %o and isError %s to %s", (data, isError, errorState) => {
    sdkMock.useEntitySearchSearchEntities.mockReturnValue({ data, isError, isFetching: false });

    const { result } = renderController();

    expect(result.current.errorState).toBe(errorState);
  });

  it("passes search results and spelling suggestions through", () => {
    const searchResult = {
      displayLabel: "Birthday reward",
      entityId: "rule_123",
      entityType: "EVENT_RULE",
      matchRanges: [],
      score: 1,
      snippetText: "Birthday",
      sourceUrl: "/event-rules/rule_123",
    };
    sdkMock.useEntitySearchSearchEntities.mockReturnValue({
      data: {
        status: 200,
        data: { content: [searchResult], didYouMean: "birthday", page: 0, size: 10, totalSize: 1 },
      },
      isError: false,
      isFetching: false,
    });

    const { result } = renderController();

    expect(result.current.results).toEqual([searchResult]);
    expect(result.current.didYouMean).toBe("birthday");
  });

  it("integrates injected scope prefixes with active scope and search", () => {
    const { result } = renderController();

    act(() => result.current.setQuery("rule:reward"));
    act(() => vi.advanceTimersByTime(250));

    expect(result.current.activeScope).toBe("EVENT_RULE");
    expect(result.current.effectiveQueryLength).toBe("reward".length);
    expect(sdkMock.useEntitySearchSearchEntities).toHaveBeenLastCalledWith(
      { q: "rule:reward", page: 0, size: 10 },
      expect.objectContaining({ query: expect.objectContaining({ enabled: true }) })
    );
  });
});

describe("isDashboardPath", () => {
  it("recognizes exact Dashboard paths and their nested routes", () => {
    expect(isDashboardPath("/")).toBe(true);
    expect(isDashboardPath("/analytics")).toBe(true);
    expect(isDashboardPath("/settings/api-keys")).toBe(true);
  });

  it("does not infer ownership from similarly named Hub routes", () => {
    expect(isDashboardPath("/settings-page")).toBe(false);
    expect(isDashboardPath("/programs")).toBe(false);
  });
});

describe("useCommandPaletteController — scope search row, recents and quick actions", () => {
  const customer = {
    displayLabel: "Marisol Vega",
    entityId: "cust_1",
    entityType: "CUSTOMER",
    matchRanges: [],
    score: 1,
    snippetText: "marisol@example.com",
    sourceUrl: "/customers/cust_1",
  };

  function renderWith(
    options: { recentItemsKey?: string | null; onSelect?: ReturnType<typeof vi.fn> } = {}
  ) {
    const onSelect = options.onSelect ?? vi.fn();
    const quickActions = [{ id: "audit", label: "Audit log", sourceUrl: "/audit-log" }];
    const hook = renderHook(
      ({ recentItemsKey }) =>
        useCommandPaletteController({
          onSelect,
          scopes: testScopes,
          entityTypeLabels: testLabels,
          entityTypeIcons: testIcons,
          recentItemsKey,
          quickActions,
        }),
      { initialProps: { recentItemsKey: options.recentItemsKey ?? null } }
    );
    return { ...hook, onSelect, quickActions };
  }

  afterEach(() => window.localStorage.clear());

  it("A3: activating the customer scope rewrites the query to customer:<body> and keeps it open", () => {
    const { result } = renderWith();
    act(() => result.current.setOpen(true));
    act(() => result.current.setQuery("Marisol"));
    act(() => result.current.onActiveScopeChange("CUSTOMER"));
    expect(result.current.query).toBe("customer:Marisol");
    expect(result.current.activeScope).toBe("CUSTOMER");
    expect(result.current.open).toBe(true);
  });

  it("D1/D2: remembers an opened result for this key and still calls the consumer", () => {
    const { result, onSelect } = renderWith({ recentItemsKey: "k1" });
    act(() => result.current.onSelect(customer));
    expect(onSelect).toHaveBeenCalledWith(customer);
    expect(result.current.recentItems.map((r) => r.entityId)).toEqual(["cust_1"]);
  });

  it("D2: switching key (another org environment) shows that key's list", () => {
    const { result, rerender } = renderWith({ recentItemsKey: "env_a" });
    act(() => result.current.onSelect(customer));
    rerender({ recentItemsKey: "env_b" });
    expect(result.current.recentItems).toEqual([]);
    rerender({ recentItemsKey: "env_a" });
    expect(result.current.recentItems.map((r) => r.entityId)).toEqual(["cust_1"]);
  });

  it("D2: with no key, nothing is remembered", () => {
    const { result } = renderWith({ recentItemsKey: null });
    act(() => result.current.onSelect(customer));
    expect(result.current.recentItems).toEqual([]);
  });

  it("D1: quick actions route through the consumer's onSelect and are not remembered", () => {
    const { result, onSelect, quickActions } = renderWith({ recentItemsKey: "k1" });
    expect(result.current.quickActions).toEqual(quickActions);
    act(() => result.current.onQuickActionSelect(quickActions[0]!));
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ sourceUrl: "/audit-log" }));
    expect(result.current.recentItems).toEqual([]);
  });
});
