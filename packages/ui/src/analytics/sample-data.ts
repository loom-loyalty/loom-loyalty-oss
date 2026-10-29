/** Static sample data for all chart types — all values are deterministic for SSR safety */
export const SAMPLE_DASHBOARD_SUMMARY = {
  data: [
    {
      total_customers: 12456,
      active_customers: 8234,
      inactive_customers: 4222,
      currency_issued_by_code: { POINTS: 1250000 },
      currency_debit_issued_by_code: { POINTS: 950000 },
      currency_redeemed_by_code: { POINTS: 890000 },
      currency_credit_withdrawn_by_code: { POINTS: 120000 },
      customers_with_tiers: 9800,
      total_tier_assignments: 12456,
      total_coupons_issued: 4530,
      total_coupons_used: 2890,
      total_coupons_cancelled: 340,
      coupon_redemption_rate: 63.8,
    },
  ],
  rows: 1,
  rows_before_limit_at_least: 1,
  meta: [],
  statistics: { elapsed: 0.01, rows_read: 1, bytes_read: 100 },
};

// Deterministic pseudo-random using a simple seed hash
function seeded(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 49297;
  return x - Math.floor(x);
}

export const SAMPLE_CURRENCY_TREND = {
  data: Array.from({ length: 30 }, (_, i) => {
    // Earn ramps up gradually over time with deterministic daily noise
    const baseEarn = 4000 + (i / 29) * 8000;
    const noise = seeded(i * 7 + 1) * 600 - 300;
    const issued_amount = Math.floor(baseEarn + Math.sin(i * 0.7) * 400 + noise);
    // Redemptions start very low and slowly grow to ~10% of earn by end
    const redeemRatio = 0.02 + (i / 29) * 0.08;
    const redeemNoise = seeded(i * 13 + 2) * 80 - 40;
    const redeemed_amount = Math.floor(issued_amount * redeemRatio + redeemNoise);
    const net_change = issued_amount - redeemed_amount;
    const unique_earners = Math.floor(100 + seeded(i * 17 + 3) * 50);
    const unique_redeemers = Math.floor(20 + seeded(i * 19 + 4) * 30);
    return {
      period: `2026-02-${String(16 + Math.floor((i / 30) * 30)).padStart(2, "0")}`.slice(0, 10),
      program_currency_code: "POINTS",
      issued_amount,
      redeemed_amount,
      net_change,
      unique_earners,
      unique_redeemers,
    };
  }),
  rows: 30,
  rows_before_limit_at_least: 30,
  meta: [],
  statistics: { elapsed: 0.02, rows_read: 30, bytes_read: 1000 },
};

export const SAMPLE_CUSTOMERS_TREND = {
  data: Array.from({ length: 30 }, (_, i) => ({
    period: `2026-02-${String(16 + Math.floor((i / 30) * 30)).padStart(2, "0")}`.slice(0, 10),
    total: 10000 + i * 80 + Math.floor(seeded(i * 11 + 4) * 50),
    new_customers: Math.floor(25 + seeded(i * 19 + 5) * 20),
    churned: Math.floor(5 + seeded(i * 23 + 6) * 8),
  })),
  rows: 30,
  rows_before_limit_at_least: 30,
  meta: [],
  statistics: { elapsed: 0.02, rows_read: 30, bytes_read: 1000 },
};

export const SAMPLE_CUSTOMERS_BY_STATUS = {
  data: [
    { status_code: "ACTIVE", customer_count: 8234, percentage: 66.1 },
    { status_code: "INACTIVE", customer_count: 2890, percentage: 23.2 },
    { status_code: "NEW", customer_count: 890, percentage: 7.1 },
    { status_code: "CHURNED", customer_count: 442, percentage: 3.6 },
  ],
  rows: 4,
  rows_before_limit_at_least: 4,
  meta: [],
  statistics: { elapsed: 0.01, rows_read: 4, bytes_read: 200 },
};

export const SAMPLE_TIERS_TOTAL = {
  data: [
    { tier_code: "bronze", tier_name: "Bronze", customer_count: 6500, percentage: 52.2 },
    { tier_code: "silver", tier_name: "Silver", customer_count: 3200, percentage: 25.7 },
    { tier_code: "gold", tier_name: "Gold", customer_count: 2100, percentage: 16.8 },
    { tier_code: "platinum", tier_name: "Platinum", customer_count: 656, percentage: 5.3 },
  ],
  rows: 4,
  rows_before_limit_at_least: 4,
  meta: [],
  statistics: { elapsed: 0.01, rows_read: 4, bytes_read: 200 },
};

export const SAMPLE_PROGRAMS_ENROLLMENT = {
  data: [
    {
      program_code: "rewards",
      total_enrollments: 8500,
      unique_customers: 7800,
      active_enrollments: 6200,
      inactive_enrollments: 2300,
      first_enrollment: "2025-01-15T10:00:00.000Z",
      latest_enrollment: "2026-03-18T14:30:00.000Z",
    },
    {
      program_code: "vip",
      total_enrollments: 3200,
      unique_customers: 3100,
      active_enrollments: 2800,
      inactive_enrollments: 400,
      first_enrollment: "2025-03-01T09:00:00.000Z",
      latest_enrollment: "2026-03-17T11:20:00.000Z",
    },
    {
      program_code: "referral",
      total_enrollments: 1800,
      unique_customers: 1650,
      active_enrollments: 950,
      inactive_enrollments: 850,
      first_enrollment: "2025-06-10T08:00:00.000Z",
      latest_enrollment: "2026-03-16T16:45:00.000Z",
    },
  ],
  rows: 3,
  rows_before_limit_at_least: 3,
  meta: [],
  statistics: { elapsed: 0.01, rows_read: 3, bytes_read: 200 },
};

export const SAMPLE_OFFER_SUMMARY = {
  data: [
    {
      offer_code: "welcome",
      offer_name: "Welcome Bonus",
      offer_type: "COUPON",
      coupon_type_code: "DISCOUNT",
      total_issued: 3500,
      total_used: 2340,
      total_cancelled: 120,
      outstanding: 1040,
      redemption_rate: 66.86,
      unique_recipients: 3200,
      total_discount_value: 117000,
    },
    {
      offer_code: "double-pts",
      offer_name: "Double Points Weekend",
      offer_type: "COUPON",
      coupon_type_code: "MULTIPLIER",
      total_issued: 2800,
      total_used: 1890,
      total_cancelled: 90,
      outstanding: 820,
      redemption_rate: 67.5,
      unique_recipients: 2500,
      total_discount_value: 94500,
    },
    {
      offer_code: "birthday",
      offer_name: "Birthday Reward",
      offer_type: "COUPON",
      coupon_type_code: "DISCOUNT",
      total_issued: 1800,
      total_used: 1200,
      total_cancelled: 50,
      outstanding: 550,
      redemption_rate: 66.67,
      unique_recipients: 1800,
      total_discount_value: 60000,
    },
    {
      offer_code: "referral",
      offer_name: "Referral Bonus",
      offer_type: "COUPON",
      coupon_type_code: "FIXED",
      total_issued: 1200,
      total_used: 890,
      total_cancelled: 30,
      outstanding: 280,
      redemption_rate: 74.17,
      unique_recipients: 1100,
      total_discount_value: 44500,
    },
    {
      offer_code: "tier-gift",
      offer_name: "Tier Upgrade Gift",
      offer_type: "COUPON",
      coupon_type_code: "FIXED",
      total_issued: 650,
      total_used: 450,
      total_cancelled: 20,
      outstanding: 180,
      redemption_rate: 69.23,
      unique_recipients: 600,
      total_discount_value: 22500,
    },
  ],
  rows: 5,
  rows_before_limit_at_least: 5,
  meta: [],
  statistics: { elapsed: 0.01, rows_read: 5, bytes_read: 300 },
};

export const SAMPLE_CUSTOMER_ACTIVITY = {
  data: [
    {
      event_record_id: "pevt_sample001",
      source_event_datetime: "2026-03-18 14:55:00.000",
      event_type_code: "POINTS_EARNED",
      entity_type: "currency",
      entity_id: "abc12345-6789-0123-4567-890abcdef012",
      status: "PROCESSED",
      status_description: "PROCESSED",
      description: "Earned 500 points for purchase",
      created_datetime: "2026-03-18 14:55:01.000",
      modified_datetime: "2026-03-18 14:55:01.000",
    },
    {
      event_record_id: "pevt_sample002",
      source_event_datetime: "2026-03-18 14:50:00.000",
      event_type_code: "TIER_UPGRADE",
      entity_type: "tier",
      entity_id: "def12345-6789-0123-4567-890abcdef012",
      status: "PROCESSED",
      status_description: "PROCESSED",
      description: "Upgraded from Silver to Gold",
      created_datetime: "2026-03-18 14:50:01.000",
      modified_datetime: "2026-03-18 14:50:01.000",
    },
    {
      event_record_id: "pevt_sample003",
      source_event_datetime: "2026-03-18 14:45:00.000",
      event_type_code: "COUPON_REDEEMED",
      entity_type: "coupon",
      entity_id: "ghi12345-6789-0123-4567-890abcdef012",
      status: "PROCESSED",
      status_description: "PROCESSED",
      description: "Redeemed 20% off coupon",
      created_datetime: "2026-03-18 14:45:01.000",
      modified_datetime: "2026-03-18 14:45:01.000",
    },
    {
      event_record_id: "pevt_sample004",
      source_event_datetime: "2026-03-18 14:40:00.000",
      event_type_code: "BADGE_EARNED",
      entity_type: "badge",
      entity_id: "jkl12345-6789-0123-4567-890abcdef012",
      status: "PROCESSED",
      status_description: "PROCESSED",
      description: "Earned Loyal Customer badge",
      created_datetime: "2026-03-18 14:40:01.000",
      modified_datetime: "2026-03-18 14:40:01.000",
    },
    {
      event_record_id: "pevt_sample005",
      source_event_datetime: "2026-03-18 14:35:00.000",
      event_type_code: "POINTS_EXPIRED",
      entity_type: "currency",
      entity_id: "mno12345-6789-0123-4567-890abcdef012",
      status: "PROCESSED",
      status_description: "PROCESSED",
      description: "200 points expired",
      created_datetime: "2026-03-18 14:35:01.000",
      modified_datetime: "2026-03-18 14:35:01.000",
    },
  ],
  rows: 5,
  rows_before_limit_at_least: 50,
  meta: [],
  statistics: { elapsed: 0.01, rows_read: 5, bytes_read: 500 },
};

export const SAMPLE_EVENT_VOLUME = {
  data: Array.from({ length: 30 }, (_, i) => ({
    period: `2026-02-${String(16 + Math.floor((i / 30) * 30)).padStart(2, "0")}`.slice(0, 10),
    event_type_code: "ALL",
    event_count: Math.floor(800 + seeded(i * 29 + 7) * 400),
  })),
  rows: 30,
  rows_before_limit_at_least: 30,
  meta: [],
  statistics: { elapsed: 0.02, rows_read: 30, bytes_read: 1000 },
};
