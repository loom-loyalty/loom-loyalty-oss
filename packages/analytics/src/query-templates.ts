/** Pre-built example queries per datasource to help users get started */
export interface QueryTemplate {
  name: string;
  description: string;
  sql: string;
  datasource: string;
}

export const QUERY_TEMPLATES: QueryTemplate[] = [
  // ─── mv_events ─────────────────────────────
  {
    name: "Event volume by type",
    description: "Count events grouped by type, last 30 days",
    datasource: "mv_events",
    sql: `SELECT
  event_type_code,
  COUNT(*) AS event_count
FROM mv_events
WHERE source_event_datetime >= now() - INTERVAL 30 DAY
GROUP BY event_type_code
ORDER BY event_count DESC
LIMIT 20`,
  },
  {
    name: "Recent activity feed",
    description: "Latest 100 events with details",
    datasource: "mv_events",
    sql: `SELECT
  source_event_datetime,
  event_type_code,
  entity_type,
  entity_id,
  status,
  description
FROM mv_events
ORDER BY source_event_datetime DESC
LIMIT 100`,
  },
  {
    name: "Events per day",
    description: "Daily event volume for the last 30 days",
    datasource: "mv_events",
    sql: `SELECT
  toDate(source_event_datetime) AS day,
  COUNT(*) AS event_count
FROM mv_events
WHERE source_event_datetime >= now() - INTERVAL 30 DAY
GROUP BY day
ORDER BY day`,
  },
  {
    name: "Event status breakdown",
    description: "Count events by status",
    datasource: "mv_events",
    sql: `SELECT
  status,
  COUNT(*) AS count
FROM mv_events
GROUP BY status
ORDER BY count DESC`,
  },

  // ─── mv_customers ─────────────────────────
  {
    name: "Top customers by earnings",
    description: "Top 50 customers by total currency earned",
    datasource: "mv_customers",
    sql: `SELECT
  customer_name,
  total_earned,
  total_redeemed,
  total_earned - total_redeemed AS net_balance,
  tier
FROM mv_customers
ORDER BY total_earned DESC
LIMIT 50`,
  },
  {
    name: "Customers by tier",
    description: "Count customers in each tier",
    datasource: "mv_customers",
    sql: `SELECT
  tier,
  COUNT(*) AS customer_count
FROM mv_customers
GROUP BY tier
ORDER BY customer_count DESC`,
  },
  {
    name: "Customer status summary",
    description: "Count customers by status",
    datasource: "mv_customers",
    sql: `SELECT
  status,
  COUNT(*) AS customer_count
FROM mv_customers
GROUP BY status
ORDER BY customer_count DESC`,
  },
  {
    name: "High-value customers",
    description: "Customers with net balance over 1000",
    datasource: "mv_customers",
    sql: `SELECT
  customer_name,
  tier,
  total_earned,
  total_redeemed,
  total_earned - total_redeemed AS net_balance
FROM mv_customers
WHERE total_earned - total_redeemed > 1000
ORDER BY net_balance DESC
LIMIT 100`,
  },
];
