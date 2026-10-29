import type { CustomerFunnelRow } from "../types";

/**
 * A fresh tenant's pipe returns all 9 stages at count 0, not an empty array. Treat
 * that (and a literally empty array) as "no funnel data yet" so the page shows its
 * editorial empty state instead of a dataless funnel.
 */
export function isFunnelDataEmpty(rows: CustomerFunnelRow[]): boolean {
  return rows.length === 0 || rows.every((row) => row.customer_count === 0);
}
