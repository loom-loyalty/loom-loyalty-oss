import { describe, expect, it } from "vitest";

import { PIPES } from "../../pipes";
import type { DatasourceSchema } from "../../types";
import { DRILLDOWN_SPECS, getDrilldownSpec } from "../registry";
import { resolveDrilldown, schemaSatisfies, supportsItemDrilldown } from "../resolve";
import type { DrilldownContext, DrilldownSpec, DrilldownTarget } from "../types";

const CONTEXT: DrilldownContext = {
  startDate: "2026-07-27",
  endDate: "2026-08-26",
  granularity: "daily",
};

/** A schema carrying every datasource + column the registry declares. */
const FULL_SCHEMA: DatasourceSchema[] = (() => {
  const byName = new Map<string, Set<string>>();
  for (const spec of DRILLDOWN_SPECS) {
    for (const requirement of spec.requires) {
      const columns = byName.get(requirement.datasource) ?? new Set<string>();
      for (const column of requirement.columns) columns.add(column);
      byName.set(requirement.datasource, columns);
    }
  }
  // Columns the SQL selects but does not gate on; present so the queries below
  // are realistic against a real schema.
  const extras: Record<string, string[]> = {
    mv_customers: ["external_id", "first_name", "last_name"],
    customer_tier_issued: ["tier_rank"],
    coupon_issued: ["discount_type"],
    mv_events: ["entity_type", "entity_id", "status", "description"],
  };
  for (const [name, columns] of Object.entries(extras)) {
    const set = byName.get(name);
    if (set) for (const column of columns) set.add(column);
  }
  return [...byName].map(([name, columns]) => ({
    name,
    description: name,
    columns: [...columns].map((column) => ({ name: column, type: "String" })),
  }));
})();

const target = (
  overrides: Partial<DrilldownTarget> & Pick<DrilldownTarget, "pipe">
): DrilldownTarget => ({
  level: "chart",
  title: "",
  context: CONTEXT,
  ...overrides,
});

describe("schemaSatisfies", () => {
  it("accepts a schema carrying every declared datasource and column", () => {
    const spec = getDrilldownSpec(PIPES.TIERS_TOTAL)!;
    expect(schemaSatisfies(spec, FULL_SCHEMA)).toBe(true);
  });

  it("rejects a schema missing the datasource entirely", () => {
    const spec = getDrilldownSpec(PIPES.TIERS_TOTAL)!;
    expect(schemaSatisfies(spec, [])).toBe(false);
  });

  it("rejects a datasource that exists but lacks a column the SQL references", () => {
    const spec = getDrilldownSpec(PIPES.TIERS_TOTAL)!;
    const narrowed: DatasourceSchema[] = [
      {
        name: "customer_tier_issued",
        description: "",
        columns: [{ name: "tier_code", type: "String" }],
      },
    ];
    expect(schemaSatisfies(spec, narrowed)).toBe(false);
  });

  it("is trivially satisfied by a spec that declares no requirements", () => {
    // Synthetic rather than a real spec: every registered spec now declares
    // requirements, but an ask-only spec may legitimately declare none.
    const spec: DrilldownSpec = {
      pipe: "api_synthetic",
      title: "Synthetic",
      requires: [],
      buildAsk: () => "anything",
    };
    expect(schemaSatisfies(spec, [])).toBe(true);
  });
});

describe("resolveDrilldown", () => {
  it("returns null for a pipe with no registered drill-down", () => {
    expect(resolveDrilldown(target({ pipe: "api_not_registered" }), FULL_SCHEMA)).toBeNull();
  });

  it("builds chart-level SQL with the active date range baked in", () => {
    const handoff = resolveDrilldown(target({ pipe: PIPES.TIERS_TOTAL }), FULL_SCHEMA);
    expect(handoff?.sql).toContain("FROM customer_tier_issued");
    expect(handoff?.sql).toContain("toDate('2026-07-27')");
    expect(handoff?.sql).toContain("toDate('2026-08-26')");
    expect(handoff?.ask).toBeUndefined();
  });

  it("narrows to the clicked item and titles the hand-off with its label", () => {
    const handoff = resolveDrilldown(
      target({
        pipe: PIPES.OFFER_SUMMARY,
        level: "item",
        datum: { value: "SUMMER25", label: "Summer Sale 25%" },
      }),
      FULL_SCHEMA
    );
    expect(handoff?.sql).toContain("offer_code = 'SUMMER25'");
    expect(handoff?.title).toBe("Top Offers — Summer Sale 25%");
  });

  it("escapes an item value carrying an apostrophe", () => {
    const handoff = resolveDrilldown(
      target({
        pipe: PIPES.OFFER_SUMMARY,
        level: "item",
        datum: { value: "MOTHERS'DAY", label: "Mother's Day" },
      }),
      FULL_SCHEMA
    );
    expect(handoff?.sql).toContain("offer_code = 'MOTHERS\\'DAY'");
  });

  it("degrades to a question when the live schema lacks the datasource", () => {
    const handoff = resolveDrilldown(target({ pipe: PIPES.TIERS_TOTAL }), []);
    expect(handoff?.sql).toBeUndefined();
    expect(handoff?.ask).toMatch(/each tier/);
    expect(handoff?.ask).toContain("2026-08-26");
  });

  it("builds program-enrollment SQL against the append-only enrollment events", () => {
    const handoff = resolveDrilldown(target({ pipe: PIPES.PROGRAMS_ENROLLMENT }), FULL_SCHEMA);
    expect(handoff?.sql).toContain("FROM customer_program_created");
    expect(handoff?.ask).toBeUndefined();
  });

  it("asks about the clicked item rather than widening to the whole chart", () => {
    // Currency Trend has no item-level SQL. An item target must not silently
    // fall back to the chart-level query, which would answer a different question.
    const handoff = resolveDrilldown(
      target({
        pipe: PIPES.CURRENCY_TREND,
        level: "item",
        datum: { value: "2026-08-01", label: "Aug 1" },
      }),
      FULL_SCHEMA
    );
    expect(handoff?.sql).toBeUndefined();
    expect(handoff?.ask).toBeDefined();
  });

  it("buckets the time axis by the active granularity", () => {
    const hourly = resolveDrilldown(
      target({ pipe: PIPES.EVENT_VOLUME, context: { ...CONTEXT, granularity: "hourly" } }),
      FULL_SCHEMA
    );
    const monthly = resolveDrilldown(
      target({ pipe: PIPES.EVENT_VOLUME, context: { ...CONTEXT, granularity: "monthly" } }),
      FULL_SCHEMA
    );
    expect(hourly?.sql).toContain("toStartOfHour(source_event_datetime)");
    expect(monthly?.sql).toContain("toStartOfMonth(source_event_datetime)");
  });

  it("never emits FINAL, which the datasource contract rejects with ILLEGAL_FINAL", () => {
    // The mv_* views are ReplacingMergeTree-backed and the platform's datasource
    // contract states plainly that FINAL throws ILLEGAL_FINAL when the query is
    // wrapped. Drill-down SQL auto-runs, so a FINAL that slipped back in would
    // surface as an immediate error the user cannot act on.
    for (const spec of DRILLDOWN_SPECS) {
      const chart = resolveDrilldown(target({ pipe: spec.pipe }), FULL_SCHEMA);
      const item = resolveDrilldown(
        target({ pipe: spec.pipe, level: "item", datum: { value: "X", label: "X" } }),
        FULL_SCHEMA
      );
      for (const sql of [chart?.sql, item?.sql]) {
        if (sql) expect(sql).not.toMatch(/\bFINAL\b/);
      }
    }
  });

  it("deduplicates the mv_* views with argMax and filters the flag outside it", () => {
    const handoff = resolveDrilldown(target({ pipe: PIPES.CUSTOMERS_BY_STATUS }), FULL_SCHEMA);
    const sql = handoff?.sql ?? "";
    expect(sql).toContain("argMax(status_code, modified_datetime)");
    expect(sql).toContain("GROUP BY organization_environment_id, customer_id");
    // `deleted` is filtered AFTER the dedup subquery — inside it, the filter
    // would run against pre-dedup rows and resurrect deleted customers.
    const subqueryEnd = sql.indexOf(")");
    expect(sql.indexOf("WHERE deleted = 0")).toBeGreaterThan(subqueryEnd);
  });

  it("stamps every generated query with its chart and range", () => {
    for (const spec of DRILLDOWN_SPECS) {
      const handoff = resolveDrilldown(target({ pipe: spec.pipe }), FULL_SCHEMA);
      if (!handoff?.sql) continue;
      expect(handoff.sql.startsWith(`-- ${spec.title}`)).toBe(true);
      expect(handoff.sql).toContain("2026-07-27 to 2026-08-26");
    }
  });
});

describe("supportsItemDrilldown", () => {
  it("is true for the charts whose marks represent one dimension value", () => {
    expect(supportsItemDrilldown(PIPES.OFFER_SUMMARY)).toBe(true);
    expect(supportsItemDrilldown(PIPES.TIERS_TOTAL)).toBe(true);
    expect(supportsItemDrilldown(PIPES.CUSTOMERS_BY_STATUS)).toBe(true);
  });

  it("is false for a trend, whose marks are periods rather than categories", () => {
    expect(supportsItemDrilldown(PIPES.CURRENCY_TREND)).toBe(false);
  });

  it("is false for an unregistered pipe", () => {
    expect(supportsItemDrilldown("api_not_registered")).toBe(false);
  });
});
