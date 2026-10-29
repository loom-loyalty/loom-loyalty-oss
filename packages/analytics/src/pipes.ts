export const PIPES = {
  DASHBOARD_SUMMARY: "api_dashboard_summary",
  CURRENCY_TOTALS: "api_currency_totals",
  CURRENCY_TREND: "api_currency_trend",
  CUSTOMERS_TOTAL: "api_customers_total",
  CUSTOMERS_TREND: "api_customers_trend",
  CUSTOMERS_BY_STATUS: "api_customers_by_status",
  TIERS_TOTAL: "api_tiers_total",
  TIERS_TREND: "api_tiers_trend",
  PROGRAMS_ENROLLMENT: "api_programs_enrollment",
  CURRENCY_BY_DESCRIPTION: "api_currency_by_description",
  BADGES_ISSUED: "api_badges_issued",
  COUPONS_SUMMARY: "api_coupons_summary",
  COUPONS_BY_OFFER: "api_coupons_by_offer",
  OFFER_SUMMARY: "api_offer_summary",
  TARGETS_SUMMARY: "api_targets_summary",
  TARGETS_BY_TYPE: "api_targets_by_type",
  TOP_CUSTOMERS_BY_CURRENCY: "api_top_customers_by_currency",
  CUSTOMER_ACTIVITY: "api_customer_activity",
  EVENT_VOLUME: "api_event_volume",
  CUSTOMER_FUNNEL: "api_customer_funnel",
  CUSTOMER_FUNNEL_MEMBERS: "api_customer_funnel_members",
  CUSTOMER_REVENUE_DECILE: "api_customer_revenue_decile",
} as const;

export type PipeName = (typeof PIPES)[keyof typeof PIPES];

export const STANDARD_PIPES: PipeName[] = [
  PIPES.DASHBOARD_SUMMARY,
  PIPES.CURRENCY_TOTALS,
  PIPES.CURRENCY_TREND,
  PIPES.CUSTOMERS_TOTAL,
  PIPES.CUSTOMERS_TREND,
  PIPES.CUSTOMERS_BY_STATUS,
  PIPES.TIERS_TOTAL,
  PIPES.TIERS_TREND,
  PIPES.PROGRAMS_ENROLLMENT,
];

export const PREMIUM_PIPES: PipeName[] = [
  PIPES.CURRENCY_BY_DESCRIPTION,
  PIPES.BADGES_ISSUED,
  PIPES.COUPONS_SUMMARY,
  PIPES.COUPONS_BY_OFFER,
  PIPES.OFFER_SUMMARY,
  PIPES.TARGETS_SUMMARY,
  PIPES.TARGETS_BY_TYPE,
  PIPES.TOP_CUSTOMERS_BY_CURRENCY,
  PIPES.CUSTOMER_ACTIVITY,
  PIPES.EVENT_VOLUME,
  PIPES.CUSTOMER_FUNNEL,
  PIPES.CUSTOMER_FUNNEL_MEMBERS,
  PIPES.CUSTOMER_REVENUE_DECILE,
];

export const ALL_PIPES: PipeName[] = [...STANDARD_PIPES, ...PREMIUM_PIPES];

export interface PipeParams {
  [PIPES.DASHBOARD_SUMMARY]: {
    start_date?: string;
    end_date?: string;
    tz?: string;
    period?: string;
  };
  [PIPES.CURRENCY_TOTALS]: {
    start_date?: string;
    end_date?: string;
    tz?: string;
    period?: string;
    currency_code?: string;
  };
  [PIPES.CURRENCY_TREND]: {
    start_date?: string;
    end_date?: string;
    tz?: string;
    period?: string;
    granularity?: string;
    currency_code?: string;
  };
  [PIPES.CUSTOMERS_TOTAL]: {
    start_date?: string;
    end_date?: string;
    tz?: string;
    period?: string;
  };
  [PIPES.CUSTOMERS_TREND]: {
    start_date?: string;
    end_date?: string;
    tz?: string;
    period?: string;
    granularity?: string;
  };
  [PIPES.CUSTOMERS_BY_STATUS]: {
    start_date?: string;
    end_date?: string;
    tz?: string;
  };
  [PIPES.TIERS_TOTAL]: {
    start_date?: string;
    end_date?: string;
    tz?: string;
  };
  [PIPES.TIERS_TREND]: {
    start_date?: string;
    end_date?: string;
    tz?: string;
    period?: string;
    granularity?: string;
  };
  [PIPES.PROGRAMS_ENROLLMENT]: {
    start_date?: string;
    end_date?: string;
    tz?: string;
  };
  [PIPES.CURRENCY_BY_DESCRIPTION]: {
    start_date?: string;
    end_date?: string;
    tz?: string;
    period?: string;
    currency_code?: string;
  };
  [PIPES.BADGES_ISSUED]: {
    start_date?: string;
    end_date?: string;
    tz?: string;
    period?: string;
  };
  [PIPES.COUPONS_SUMMARY]: {
    start_date?: string;
    end_date?: string;
    tz?: string;
    period?: string;
  };
  [PIPES.COUPONS_BY_OFFER]: {
    start_date?: string;
    end_date?: string;
    tz?: string;
    period?: string;
    limit?: number;
  };
  [PIPES.OFFER_SUMMARY]: {
    start_date?: string;
    end_date?: string;
    tz?: string;
    period?: string;
    limit?: number;
  };
  [PIPES.TARGETS_SUMMARY]: {
    start_date?: string;
    end_date?: string;
    tz?: string;
    period?: string;
  };
  [PIPES.TARGETS_BY_TYPE]: {
    start_date?: string;
    end_date?: string;
    tz?: string;
    period?: string;
  };
  [PIPES.TOP_CUSTOMERS_BY_CURRENCY]: {
    start_date?: string;
    end_date?: string;
    tz?: string;
    limit?: number;
    currency_code?: string;
  };
  [PIPES.CUSTOMER_ACTIVITY]: {
    start_date?: string;
    end_date?: string;
    tz?: string;
    event_type_code?: string;
    entity_type?: string;
    status?: string;
    limit?: number;
    offset?: number;
  };
  [PIPES.EVENT_VOLUME]: {
    start_date?: string;
    end_date?: string;
    tz?: string;
    granularity?: string;
    event_type_code?: string;
  };
  // NOTE: api_customer_funnel + api_customer_funnel_members + api_customer_revenue_decile
  // do NOT accept tz. `period`/`start_date`/`end_date` are evaluated in UTC at the pipe.
  // For funnel, the date range filters by customer `created_datetime` (cohort by acquisition),
  // not activity — the FE must label its date control as "Cohort filter" (see plan §Cohort filter).
  [PIPES.CUSTOMER_FUNNEL]: {
    period?: "7d" | "30d" | "90d" | "1y";
    start_date?: string;
    end_date?: string;
  };
  [PIPES.CUSTOMER_FUNNEL_MEMBERS]: {
    period?: "7d" | "30d" | "90d" | "1y";
    start_date?: string;
    end_date?: string;
    // PENDING backend pipe-param work:
    //   stage_order?: number;
    //   limit?: number;
    //   offset?: number;
  };
  [PIPES.CUSTOMER_REVENUE_DECILE]: {
    metric_role?: "REVENUE" | "COST" | "MARGIN";
    scope?: "all" | "earning";
    period?: "7d" | "30d" | "90d" | "1y";
    start_date?: string;
    end_date?: string;
  };
}
