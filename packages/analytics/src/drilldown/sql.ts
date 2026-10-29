/**
 * SQL literal helpers for drill-down query construction.
 *
 * Drill-down SQL interpolates values that came back from a pipe — offer names,
 * tier codes, event-type codes — into ClickHouse string literals. Those values
 * are tenant data, so they can legitimately contain quotes and backslashes
 * ("Buy 1, Get 1 — Mother's Day"). Escaping is what keeps the generated query
 * syntactically valid; it is not the security boundary. The security boundary
 * is the TinyBird token itself, which is read-only and scoped to the caller's
 * organization environment.
 */

/**
 * Renders a value as a single-quoted ClickHouse string literal, escaping the
 * two characters that terminate or continue an escape sequence inside one.
 * Backslash must be escaped first, or it would double-escape the quotes added
 * on the next pass.
 */
export function sqlString(value: string): string {
  return `'${value.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
}

/**
 * Renders a `yyyy-MM-dd` date as a ClickHouse date literal. Drill-down queries
 * bake the active date range in as literals rather than parameters so the SQL
 * that lands in the editor is complete, readable, and independently runnable.
 */
export function sqlDate(isoDate: string): string {
  return `toDate(${sqlString(isoDate)})`;
}

/**
 * `end_date` is inclusive across the analytics pipes, so a half-open comparison
 * on a DateTime column has to reach the *start of the following day* to keep the
 * last day's rows. Expressed as `< end + 1 day` rather than `<= end` because the
 * latter silently drops everything after 00:00:00 on the final day.
 */
export function sqlDateTimeRange(column: string, startDate: string, endDate: string): string {
  return `${column} >= ${sqlDate(startDate)} AND ${column} < ${sqlDate(endDate)} + INTERVAL 1 DAY`;
}
