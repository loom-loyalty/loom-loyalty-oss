import { describe, expect, it } from "vitest";

import { PIPES } from "../../pipes";
import { buildDrilldownPath, parseDrilldownSearch, toDrilldownSearch } from "../params";
import type { DrilldownTarget } from "../types";

const CHART_TARGET: DrilldownTarget = {
  pipe: PIPES.TIERS_TOTAL,
  level: "chart",
  title: "",
  context: { startDate: "2026-07-27", endDate: "2026-08-26", granularity: "daily" },
};

const ITEM_TARGET: DrilldownTarget = {
  ...CHART_TARGET,
  level: "item",
  datum: { value: "GOLD", label: "Gold" },
};

describe("toDrilldownSearch", () => {
  it("omits optional params that are not set", () => {
    const search = toDrilldownSearch({
      ...CHART_TARGET,
      context: { startDate: "2026-07-27", endDate: "2026-08-26" },
    });
    expect(search).toEqual({
      pipe: PIPES.TIERS_TOTAL,
      level: "chart",
      start: "2026-07-27",
      end: "2026-08-26",
    });
  });

  it("carries the datum's value and label separately", () => {
    const search = toDrilldownSearch(ITEM_TARGET);
    expect(search.value).toBe("GOLD");
    expect(search.label).toBe("Gold");
  });
});

describe("buildDrilldownPath", () => {
  it("encodes params onto the given path", () => {
    const path = buildDrilldownPath("/analytics/explorer", ITEM_TARGET);
    expect(path.startsWith("/analytics/explorer?")).toBe(true);
    const params = new URLSearchParams(path.split("?")[1]);
    expect(params.get("pipe")).toBe(PIPES.TIERS_TOTAL);
    expect(params.get("level")).toBe("item");
    expect(params.get("value")).toBe("GOLD");
  });

  it("escapes a label containing characters that would break the query string", () => {
    const path = buildDrilldownPath("/analytics/explorer", {
      ...ITEM_TARGET,
      datum: { value: "A&B", label: "Buy 1, Get 1 — Mother's Day" },
    });
    const params = new URLSearchParams(path.split("?")[1]);
    expect(params.get("value")).toBe("A&B");
    expect(params.get("label")).toBe("Buy 1, Get 1 — Mother's Day");
  });
});

describe("parseDrilldownSearch", () => {
  it("round-trips a target through serialization", () => {
    const parsed = parseDrilldownSearch(toDrilldownSearch(ITEM_TARGET));
    expect(parsed).toEqual({ ...ITEM_TARGET, title: "" });
  });

  it("returns null when the required params are absent", () => {
    expect(parseDrilldownSearch({})).toBeNull();
    expect(parseDrilldownSearch({ pipe: PIPES.TIERS_TOTAL })).toBeNull();
  });

  it("rejects a malformed date rather than passing it to the SQL builders", () => {
    expect(
      parseDrilldownSearch({
        pipe: PIPES.TIERS_TOTAL,
        start: "yesterday",
        end: "2026-08-26",
      })
    ).toBeNull();
  });

  it("rejects an item target with nothing to filter on", () => {
    // Widening it to the whole chart would answer a broader question than the
    // link promised, so it is refused outright.
    expect(
      parseDrilldownSearch({
        pipe: PIPES.TIERS_TOTAL,
        level: "item",
        start: "2026-07-27",
        end: "2026-08-26",
      })
    ).toBeNull();
  });

  it("drops an unrecognized granularity instead of trusting it", () => {
    const parsed = parseDrilldownSearch({
      pipe: PIPES.EVENT_VOLUME,
      start: "2026-07-27",
      end: "2026-08-26",
      granularity: "fortnightly",
    });
    expect(parsed?.context.granularity).toBeUndefined();
  });

  it("treats an unknown level as a chart-level drill", () => {
    const parsed = parseDrilldownSearch({
      pipe: PIPES.TIERS_TOTAL,
      level: "sideways",
      start: "2026-07-27",
      end: "2026-08-26",
    });
    expect(parsed?.level).toBe("chart");
  });

  it("falls back to the value when no label was carried", () => {
    const parsed = parseDrilldownSearch({
      pipe: PIPES.TIERS_TOTAL,
      level: "item",
      value: "GOLD",
      start: "2026-07-27",
      end: "2026-08-26",
    });
    expect(parsed?.datum).toEqual({ value: "GOLD", label: "GOLD" });
  });
});
