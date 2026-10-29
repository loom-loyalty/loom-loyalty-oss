/** Standard TinyBird API response envelope */
export interface TinybirdResponse<T> {
  data: T[];
  rows: number;
  rows_before_limit_at_least: number;
  meta: Array<{ name: string; type: string }>;
  statistics: {
    elapsed: number;
    rows_read: number;
    bytes_read: number;
  };
}

/** Base parameters shared by all pipes */
export interface TinybirdBaseParams {
  start_date?: string;
  end_date?: string;
  tz?: string;
}

// ─── Datasource Schema (Spindle SQL Workbench) ─────────

/** Column definition within a TinyBird datasource */
export interface DatasourceColumn {
  name: string;
  type: string;
}

/** Datasource schema returned by the token endpoint */
export interface DatasourceSchema {
  name: string;
  description: string;
  columns: DatasourceColumn[];
}

/** Saved query stored in localStorage */
export interface SavedQuery {
  id: string;
  name: string;
  sql: string;
  createdAt: string;
  updatedAt: string;
  favorite: boolean;
}

// ─── Spindle AI Query Assistant (translate contract) ─────

/**
 * Direction/intent discriminator for `POST /api/ai/spindle/translate`.
 * - `nl_to_sql` — English → SQL (may abstain with a clarifying question).
 * - `sql_to_nl` — SQL → plain-English explanation (never returns SQL).
 * - `fix` — repair SQL against a prior TinyBird execution error.
 */
export type SpindleTranslateMode = "nl_to_sql" | "sql_to_nl" | "fix";

/** One client-held NL → SQL conversational turn. */
export interface SpindleTurn {
  prompt: string;
  sql: string | null;
}

/**
 * Request body for `POST /api/ai/spindle/translate`. The endpoint is
 * schema-stateless: the client sends the active datasource schema (names +
 * columns + types) it already holds from `useTinybird()` so the model can
 * ground its SQL. `schema` follows sample-vs-real mode coherently because it
 * is just the page's `activeDatasources`.
 */
export interface SpindleTranslateRequest {
  mode: SpindleTranslateMode;
  /** Natural-language ask. Required for `nl_to_sql`. */
  prompt?: string;
  /** SQL to explain (`sql_to_nl`) or repair (`fix`); for `nl_to_sql`, current editor SQL grounding when refining. */
  sql?: string;
  /** The TinyBird execution error to repair against. Required for `fix`. */
  previousError?: string;
  /** Prior client-held conversational turns. Used only for `nl_to_sql` refinement. */
  turns?: SpindleTurn[];
  /** Active datasource schema used to ground generation. */
  schema: DatasourceSchema[];
}

/**
 * Response from `POST /api/ai/spindle/translate`.
 * - `sql` is `null` on abstention (vague `nl_to_sql`) and always `null` for
 *   `sql_to_nl`.
 * - `clarifyingQuestion` is non-null only when the model abstains.
 * - `assumptions` surfaces the guesses the model made when it did emit SQL.
 */
export interface SpindleTranslateResponse {
  sql: string | null;
  explanation: string;
  assumptions: string[];
  clarifyingQuestion: string | null;
}

/**
 * Request body for `POST /api/ai/spindle/explain-results`. Carries a capped
 * sample of result rows (the server re-caps to 50 regardless). Rows are never
 * logged server-side.
 */
export interface SpindleExplainResultsRequest {
  sql: string;
  columns: Array<{ name: string; type: string }>;
  rows: Array<Record<string, unknown>>;
}

/** Response from `POST /api/ai/spindle/explain-results`. */
export interface SpindleExplainResultsResponse {
  summary: string;
}

/** Token state from the provider */
export interface TinybirdTokenState {
  token: string | null;
  expiresAt: Date | null;
  baseUrl: string | null;
  pipes: string[];
  hasPremium: boolean;
  datasources: DatasourceSchema[];
  sqlEnabled: boolean;
  isLoading: boolean;
  error: TinybirdTokenError | null;
  retry: () => void;
}

/** Internal token state (without retry) used by useState */
export type TinybirdTokenData = Omit<TinybirdTokenState, "retry">;

/** Token error types */
export type TinybirdTokenError = {
  type: "PLAN_REQUIRED" | "AUTH_ERROR" | "SERVICE_UNAVAILABLE" | "NETWORK_ERROR" | "UNKNOWN";
  message: string;
  status?: number;
};

/** Time granularity for trend queries */
export type Granularity = "hourly" | "daily" | "weekly" | "monthly";

/** Date preset identifiers */
export type DatePreset =
  | "7d"
  | "30d"
  | "90d"
  | "12m"
  | "this_program_cycle"
  | "since_launch"
  | "last_billing_period"
  | "this_quarter"
  | "custom";

/** Date range selection */
export interface DateRange {
  startDate: string;
  endDate: string;
  preset: DatePreset;
  label: string;
}

/** CSV export state */
export interface ExportState {
  isExporting: boolean;
  pipeName: string | null;
  error: string | null;
}

/** Token endpoint response shape */
export interface AnalyticsTokenResponse {
  token: string;
  expiresAt: string;
  baseUrl: string;
  pipes: string[];
  datasources?: DatasourceSchema[];
}

// ─── Per-Pipe Row Types ─────────────────────────────────

/**
 * Currency measure broken out per `program_currency_code` (POINTS, MILES, …).
 * The old conflated scalar equals the sum of this map's values. The `""` key
 * can appear for activity not yet attributed to a code (a data state).
 */
export type CurrencyByCode = Record<string, number>;

export interface DashboardSummaryRow {
  total_customers: number;
  active_customers: number;
  inactive_customers: number;
  currency_issued_by_code: CurrencyByCode;
  currency_debit_issued_by_code: CurrencyByCode;
  currency_redeemed_by_code: CurrencyByCode;
  currency_credit_withdrawn_by_code: CurrencyByCode;
  customers_with_tiers: number;
  total_tier_assignments: number;
  total_coupons_issued: number;
  total_coupons_used: number;
  total_coupons_cancelled: number;
  coupon_redemption_rate: number;
}

export interface CurrencyTotalsRow {
  program_currency_code: string;
  currency_code: string;
  currency_name: string;
  total_issued: number;
  total_redeemed: number;
  total_expired: number;
  net_balance: number;
  redemption_rate: number;
  unique_earners: number;
  unique_redeemers: number;
}

export interface CurrencyTrendRow {
  period: string;
  program_currency_code: string;
  issued_amount: number;
  redeemed_amount: number;
  net_change: number;
  unique_earners: number;
  unique_redeemers: number;
}

export interface CurrencyByDescriptionRow {
  program_currency_code: string;
  description: string;
  total_amount: number;
  transaction_count: number;
  percentage: number;
}

export interface CustomersTotalRow {
  total_customers: number;
  active_customers: number;
  new_customers: number;
  churned_customers: number;
}

export interface CustomersTrendRow {
  period: string;
  total: number;
  new_customers: number;
  churned: number;
}

export interface CustomersByStatusRow {
  status_code: string;
  customer_count: number;
  percentage: number;
}

export interface TiersTotalRow {
  tier_code: string;
  tier_name: string;
  customer_count: number;
  percentage: number;
}

export interface TiersTrendRow {
  period: string;
  tier_code: string;
  tier_name: string;
  customer_count: number;
}

export interface ProgramsEnrollmentRow {
  program_code: string;
  total_enrollments: number;
  unique_customers: number;
  active_enrollments: number;
  inactive_enrollments: number;
  first_enrollment: string;
  latest_enrollment: string;
}

export interface OfferSummaryRow {
  offer_code: string;
  offer_name: string;
  offer_type: string;
  coupon_type_code: string;
  total_issued: number;
  total_used: number;
  total_cancelled: number;
  outstanding: number;
  redemption_rate: number;
  unique_recipients: number;
  total_discount_value: number;
}

export interface CouponsSummaryRow {
  total_coupons: number;
  redeemed_coupons: number;
  expired_coupons: number;
  active_coupons: number;
}

export interface CouponsByOfferRow {
  offer_id: string;
  offer_name: string;
  total_coupons: number;
  redeemed: number;
  expired: number;
}

export interface TargetsSummaryRow {
  total_targets: number;
  completed_targets: number;
  in_progress_targets: number;
  completion_rate: number;
}

export interface TargetsByTypeRow {
  target_type: string;
  count: number;
  completed: number;
  completion_rate: number;
}

export interface BadgesIssuedRow {
  period: string;
  badge_code: string;
  badge_name: string;
  issued_count: number;
}

export interface CustomerActivityRow {
  event_record_id: string;
  source_event_datetime: string;
  event_type_code: string;
  entity_type: string;
  entity_id: string;
  status: string;
  status_description: string;
  description: string;
  created_datetime: string;
  modified_datetime: string;
}

export interface EventVolumeRow {
  period: string;
  event_type_code: string;
  event_count: number;
}

export interface TopCustomersByCurrencyRow {
  program_currency_code: string;
  customer_id: string;
  customer_name: string;
  total_earned: number;
  total_redeemed: number;
  net_balance: number;
}

// ─── Customer Lifecycle Funnel + Revenue Decile ─────────

/**
 * The 9 mutually-exclusive lifecycle stages returned by api_customer_funnel.
 * Order matters: dormancy (Support/Lapse/Inactive) overrides progression.
 * See tinybird/endpoints/api_customer_funnel.pipe `classified` node.
 */
export type LifecycleStage =
  | "Awareness"
  | "Engagement"
  | "Conversion"
  | "Retention"
  | "Loyalty"
  | "Advocacy"
  | "Support"
  | "Lapse"
  | "Inactive";

export interface CustomerFunnelRow {
  /** 1..9 — see LifecycleStage order */
  stage_order: number;
  stage: LifecycleStage;
  customer_count: number;
  /** 0..100 */
  pct_of_total: number;
}

export interface CustomerFunnelMemberRow {
  /** UUID */
  customer_id: string;
  stage_order: number;
  stage: LifecycleStage;
}

export interface CustomerRevenueDecileRow {
  /** 1..10 — pipe returns DESC, so first row in response is decile 10 */
  decile: number;
  customer_count: number;
  metric_total: number;
  metric_avg: number;
  /**
   * Wire shape: TinyBird Map columns serialize as JSON object
   * (e.g. `{"USD": 12500, "POINTS": 89000}`).
   * Empty / missing map is normalized to `{}` at the hook boundary.
   */
  currency_issued: Record<string, number>;
  /** 0..100 */
  share_of_total_pct: number;
}

/**
 * Cohort filter for the customer-funnel page. The underlying pipe filters by
 * `created_datetime` (acquisition date), NOT activity. Default is `{ kind: 'all' }`
 * — the funnel renders a snapshot of every current customer.
 *
 * For `kind: 'period'`, callers must convert to explicit start_date/end_date BEFORE
 * passing to useComparison; the existing useComparison hook only computes a previous
 * period when both start_date and end_date are present.
 */
export type CohortFilter =
  | { kind: "all" }
  | { kind: "period"; period: "7d" | "30d" | "90d" | "1y" }
  | { kind: "range"; start_date: string; end_date: string };
