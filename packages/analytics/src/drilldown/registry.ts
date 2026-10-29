/**
 * Analytics drill-down — per-pipe registry
 *
 * Each entry answers two questions for one chart: "what SQL reproduces this
 * whole result?" and "what SQL returns the rows behind the datum I clicked?".
 *
 * The SQL here targets the TinyBird datasources Spindle exposes, not the `api_*`
 * pipes the charts themselves call. A pipe result and its datasource-level
 * reconstruction are close but not identical — pipes apply organization scoping
 * and their own dedup rules — so every generated query carries a leading comment
 * saying which chart it came from and over what range. That comment is the
 * contract with the user: this is the query *behind* the chart, offered as a
 * starting point to edit, not a byte-exact replay. This drift risk is tracked
 * in https://github.com/loom-loyalty/loom-loyalty/issues/936.
 */
import { PIPES } from "../pipes";
import type { Granularity } from "../types";
import { sqlDateTimeRange, sqlString } from "./sql";
import type { DrilldownContext, DrilldownDatum, DrilldownSpec } from "./types";

/** ClickHouse bucketing function for each granularity the controls offer. */
function bucket(column: string, granularity: Granularity | undefined): string {
  switch (granularity) {
    case "hourly":
      return `toStartOfHour(${column})`;
    case "weekly":
      return `toStartOfWeek(${column})`;
    case "monthly":
      return `toStartOfMonth(${column})`;
    default:
      return `toStartOfDay(${column})`;
  }
}

/**
 * The consolidated `mv_*` views are ReplacingMergeTree-backed and hold more than
 * one row per entity until a merge collapses them. The datasource contract is
 * explicit that `FINAL` is not the way to read them — it throws `ILLEGAL_FINAL`
 * when the query is wrapped — so deduplication goes through
 * `argMax(col, modified_datetime)` grouped by the entity key, with the
 * soft-delete/cancelled flag applied in the OUTER query once one row per entity
 * survives. Applying that flag inside the subquery would filter pre-dedup rows
 * and resurrect entities whose latest state is deleted.
 */
function dedupe(source: string, key: string, columns: string[]): string {
  const projected = [key, ...columns].map((column) =>
    column === key ? `    ${column}` : `    argMax(${column}, modified_datetime) AS ${column}`
  );
  return [
    "",
    "  SELECT",
    projected.join(",\n"),
    `  FROM ${source}`,
    `  GROUP BY organization_environment_id, ${key}`,
    "",
  ].join("\n");
}

/** One row per customer, latest state, with `deleted` for the outer filter. */
function dedupedCustomers(columns: string[]): string {
  return dedupe("mv_customers", "customer_id", [...columns, "deleted"]);
}

/** One row per event record, latest state, with `cancelled` for the outer filter. */
function dedupedEvents(columns: string[]): string {
  return dedupe("mv_events", "event_record_id", [...columns, "cancelled"]);
}

/**
 * Leading provenance comment. Without it a user who opens Spindle from a chart
 * has no way to tell a drill-down query apart from something they wrote, and no
 * record of which date range got baked into the literals below.
 */
function header(title: string, context: DrilldownContext, datum?: DrilldownDatum): string {
  const scope = datum ? ` — ${datum.label}` : "";
  return [
    `-- ${title}${scope}`,
    `-- ${context.startDate} to ${context.endDate} (inclusive)`,
    "-- Drilled in from Analytics. Edit freely.",
  ].join("\n");
}

/** Row limit for item-level drills, which return raw rows rather than aggregates. */
const ITEM_ROW_LIMIT = 500;

export const DRILLDOWN_SPECS: DrilldownSpec[] = [
  // ─── Customers by Status ──────────────────────────────
  {
    pipe: PIPES.CUSTOMERS_BY_STATUS,
    title: "Customers by Status",
    dimensionLabel: "status",
    requires: [
      {
        datasource: "mv_customers",
        columns: [
          "customer_id",
          "status_code",
          "enrollment_datetime",
          "deleted",
          "modified_datetime",
        ],
      },
    ],
    buildSql: (ctx) =>
      [
        header("Customers by Status", ctx),
        "SELECT",
        "  status_code,",
        "  COUNT(*) AS customer_count",
        `FROM (${dedupedCustomers(["status_code", "enrollment_datetime"])})`,
        "WHERE deleted = 0",
        `  AND ${sqlDateTimeRange("enrollment_datetime", ctx.startDate, ctx.endDate)}`,
        "GROUP BY status_code",
        "ORDER BY customer_count DESC",
      ].join("\n"),
    buildItemSql: (ctx, datum) =>
      [
        header("Customers by Status", ctx, datum),
        "SELECT",
        "  customer_id,",
        "  external_id,",
        "  first_name,",
        "  last_name,",
        "  status_code,",
        "  enrollment_datetime",
        `FROM (${dedupedCustomers(["external_id", "first_name", "last_name", "status_code", "enrollment_datetime"])})`,
        "WHERE deleted = 0",
        `  AND status_code = ${sqlString(datum.value)}`,
        `  AND ${sqlDateTimeRange("enrollment_datetime", ctx.startDate, ctx.endDate)}`,
        "ORDER BY enrollment_datetime DESC",
        `LIMIT ${String(ITEM_ROW_LIMIT)}`,
      ].join("\n"),
    buildAsk: (ctx, datum) =>
      datum
        ? `List the customers whose status is ${datum.label}, who enrolled between ${ctx.startDate} and ${ctx.endDate}.`
        : `How many customers are in each status, for customers who enrolled between ${ctx.startDate} and ${ctx.endDate}?`,
  },

  // ─── Tier Distribution ────────────────────────────────
  {
    pipe: PIPES.TIERS_TOTAL,
    title: "Tier Distribution",
    dimensionLabel: "tier",
    requires: [
      {
        datasource: "customer_tier_issued",
        columns: ["customer_entity_id", "tier_code", "tier_name", "event_datetime", "cancelled"],
      },
    ],
    buildSql: (ctx) =>
      [
        header("Tier Distribution", ctx),
        "SELECT",
        "  tier_code,",
        "  tier_name,",
        "  uniqExact(customer_entity_id) AS customer_count",
        "FROM customer_tier_issued",
        "WHERE cancelled = 0",
        `  AND ${sqlDateTimeRange("event_datetime", ctx.startDate, ctx.endDate)}`,
        "GROUP BY tier_code, tier_name",
        "ORDER BY customer_count DESC",
      ].join("\n"),
    buildItemSql: (ctx, datum) =>
      [
        header("Tier Distribution", ctx, datum),
        "SELECT",
        "  customer_entity_id,",
        "  tier_code,",
        "  tier_name,",
        "  tier_rank,",
        "  event_datetime AS assigned_at",
        "FROM customer_tier_issued",
        "WHERE cancelled = 0",
        `  AND tier_code = ${sqlString(datum.value)}`,
        `  AND ${sqlDateTimeRange("event_datetime", ctx.startDate, ctx.endDate)}`,
        "ORDER BY event_datetime DESC",
        `LIMIT ${String(ITEM_ROW_LIMIT)}`,
      ].join("\n"),
    buildAsk: (ctx, datum) =>
      datum
        ? `List the customers assigned to the ${datum.label} tier between ${ctx.startDate} and ${ctx.endDate}.`
        : `How many customers are in each tier between ${ctx.startDate} and ${ctx.endDate}?`,
  },

  // ─── Top Offers ───────────────────────────────────────
  {
    pipe: PIPES.OFFER_SUMMARY,
    title: "Top Offers",
    dimensionLabel: "offer",
    requires: [
      {
        datasource: "coupon_issued",
        columns: [
          "customer_entity_id",
          "offer_code",
          "offer_name",
          "discount_value",
          "event_datetime",
          "cancelled",
        ],
      },
    ],
    buildSql: (ctx) =>
      [
        header("Top Offers", ctx),
        "SELECT",
        "  offer_code,",
        "  offer_name,",
        "  COUNT(*) AS coupons_issued,",
        "  uniqExact(customer_entity_id) AS unique_recipients,",
        "  SUM(discount_value) AS total_discount_value",
        "FROM coupon_issued",
        "WHERE cancelled = 0",
        `  AND ${sqlDateTimeRange("event_datetime", ctx.startDate, ctx.endDate)}`,
        "GROUP BY offer_code, offer_name",
        "ORDER BY coupons_issued DESC",
        "LIMIT 50",
      ].join("\n"),
    buildItemSql: (ctx, datum) =>
      [
        header("Top Offers", ctx, datum),
        "SELECT",
        "  event_datetime,",
        "  customer_entity_id,",
        "  offer_code,",
        "  offer_name,",
        "  discount_type,",
        "  discount_value",
        "FROM coupon_issued",
        "WHERE cancelled = 0",
        `  AND offer_code = ${sqlString(datum.value)}`,
        `  AND ${sqlDateTimeRange("event_datetime", ctx.startDate, ctx.endDate)}`,
        "ORDER BY event_datetime DESC",
        `LIMIT ${String(ITEM_ROW_LIMIT)}`,
      ].join("\n"),
    buildAsk: (ctx, datum) =>
      datum
        ? `List every coupon issued for the offer ${datum.label} between ${ctx.startDate} and ${ctx.endDate}, with the customer and discount value.`
        : `Which offers issued the most coupons between ${ctx.startDate} and ${ctx.endDate}?`,
  },

  // ─── Event Volume ─────────────────────────────────────
  {
    pipe: PIPES.EVENT_VOLUME,
    title: "Event Volume",
    dimensionLabel: "event type",
    requires: [
      {
        datasource: "mv_events",
        columns: [
          "event_record_id",
          "source_event_datetime",
          "event_type_code",
          "cancelled",
          "modified_datetime",
        ],
      },
    ],
    buildSql: (ctx) =>
      [
        header("Event Volume", ctx),
        "SELECT",
        `  ${bucket("source_event_datetime", ctx.granularity)} AS period,`,
        "  event_type_code,",
        "  COUNT(*) AS event_count",
        `FROM (${dedupedEvents(["source_event_datetime", "event_type_code"])})`,
        "WHERE cancelled = 0",
        `  AND ${sqlDateTimeRange("source_event_datetime", ctx.startDate, ctx.endDate)}`,
        "GROUP BY period, event_type_code",
        "ORDER BY period ASC, event_count DESC",
      ].join("\n"),
    buildItemSql: (ctx, datum) =>
      [
        header("Event Volume", ctx, datum),
        "SELECT",
        "  source_event_datetime,",
        "  event_type_code,",
        "  entity_type,",
        "  entity_id,",
        "  status,",
        "  description",
        `FROM (${dedupedEvents(["source_event_datetime", "event_type_code", "entity_type", "entity_id", "status", "description"])})`,
        "WHERE cancelled = 0",
        `  AND event_type_code = ${sqlString(datum.value)}`,
        `  AND ${sqlDateTimeRange("source_event_datetime", ctx.startDate, ctx.endDate)}`,
        "ORDER BY source_event_datetime DESC",
        `LIMIT ${String(ITEM_ROW_LIMIT)}`,
      ].join("\n"),
    buildAsk: (ctx, datum) =>
      datum
        ? `List the ${datum.label} events between ${ctx.startDate} and ${ctx.endDate}.`
        : `Show event volume by event type between ${ctx.startDate} and ${ctx.endDate}.`,
  },

  // ─── Currency Trend ───────────────────────────────────
  {
    pipe: PIPES.CURRENCY_TREND,
    title: "Currency Trend",
    requires: [
      {
        datasource: "mv_currency_issued_summary",
        columns: ["event_datetime", "customer_entity_id", "total_credit", "total_debit"],
      },
    ],
    // Column names stay as the datasource spells them (`credit`/`debit`) rather
    // than the chart's issued/redeemed labels. The mapping between the two is a
    // pipe-side concern, and asserting it here would put a guess in the user's
    // editor dressed as fact.
    buildSql: (ctx) =>
      [
        header("Currency Trend", ctx),
        "SELECT",
        `  ${bucket("event_datetime", ctx.granularity)} AS period,`,
        "  SUM(total_credit) AS credit_total,",
        "  SUM(total_debit) AS debit_total,",
        "  SUM(total_credit) - SUM(total_debit) AS net_change,",
        "  uniqExact(customer_entity_id) AS unique_customers",
        "FROM mv_currency_issued_summary",
        `WHERE ${sqlDateTimeRange("event_datetime", ctx.startDate, ctx.endDate)}`,
        "GROUP BY period",
        "ORDER BY period ASC",
      ].join("\n"),
    buildAsk: (ctx) =>
      `Show currency credited and debited per ${ctx.granularity ?? "day"} between ${ctx.startDate} and ${ctx.endDate}.`,
  },

  // ─── Recent Activity ──────────────────────────────────
  {
    pipe: PIPES.CUSTOMER_ACTIVITY,
    title: "Recent Activity",
    requires: [
      {
        datasource: "mv_events",
        columns: [
          "event_record_id",
          "source_event_datetime",
          "event_type_code",
          "entity_type",
          "status",
          "cancelled",
          "modified_datetime",
        ],
      },
    ],
    buildSql: (ctx) =>
      [
        header("Recent Activity", ctx),
        "SELECT",
        "  source_event_datetime,",
        "  event_type_code,",
        "  entity_type,",
        "  entity_id,",
        "  status,",
        "  description",
        `FROM (${dedupedEvents(["source_event_datetime", "event_type_code", "entity_type", "entity_id", "status", "description"])})`,
        "WHERE cancelled = 0",
        `  AND ${sqlDateTimeRange("source_event_datetime", ctx.startDate, ctx.endDate)}`,
        "ORDER BY source_event_datetime DESC",
        `LIMIT ${String(ITEM_ROW_LIMIT)}`,
      ].join("\n"),
    buildAsk: (ctx) =>
      `Show the most recent customer activity between ${ctx.startDate} and ${ctx.endDate}.`,
  },

  // ─── Program Enrollment ───────────────────────────────
  // `customer_program_created` is append-only (one row per enrollment event), so
  // unlike the mv_* views it needs no argMax dedup pass.
  {
    pipe: PIPES.PROGRAMS_ENROLLMENT,
    title: "Program Enrollment",
    dimensionLabel: "program",
    requires: [
      {
        datasource: "customer_program_created",
        columns: [
          "customer_id",
          "program_code",
          "enrollment_datetime",
          "customer_program_status_code",
        ],
      },
    ],
    buildSql: (ctx) =>
      [
        header("Program Enrollment", ctx),
        "SELECT",
        "  program_code,",
        "  COUNT(*) AS total_enrollments,",
        "  uniqExact(customer_id) AS unique_customers",
        "FROM customer_program_created",
        `WHERE ${sqlDateTimeRange("enrollment_datetime", ctx.startDate, ctx.endDate)}`,
        "GROUP BY program_code",
        "ORDER BY total_enrollments DESC",
      ].join("\n"),
    buildItemSql: (ctx, datum) =>
      [
        header("Program Enrollment", ctx, datum),
        "SELECT",
        "  enrollment_datetime,",
        "  customer_id,",
        "  program_code,",
        "  program_account_external_id,",
        "  customer_program_status_code",
        "FROM customer_program_created",
        `WHERE program_code = ${sqlString(datum.value)}`,
        `  AND ${sqlDateTimeRange("enrollment_datetime", ctx.startDate, ctx.endDate)}`,
        "ORDER BY enrollment_datetime DESC",
        `LIMIT ${String(ITEM_ROW_LIMIT)}`,
      ].join("\n"),
    buildAsk: (ctx, datum) =>
      datum
        ? `How many customers enrolled in the ${datum.label} program between ${ctx.startDate} and ${ctx.endDate}, and who are they?`
        : `How many enrollments does each program have between ${ctx.startDate} and ${ctx.endDate}?`,
  },
];

const SPEC_BY_PIPE = new Map(DRILLDOWN_SPECS.map((spec) => [spec.pipe, spec]));

export function getDrilldownSpec(pipe: string): DrilldownSpec | undefined {
  return SPEC_BY_PIPE.get(pipe);
}
