import { Coins, Gift, Users, Zap, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { StatCard } from "../data-display/stat-card";

/**
 * Minimal subset of api_dashboard_summary that this component renders. Declared
 * here rather than imported from `@loom-loyalty/analytics` so the ui package
 * stays open-source-clean (no Tinybird-platform coupling). The currency figures
 * are plain numbers — the caller resolves the per-code map down to one code.
 */
export interface DashboardSummary {
  total_customers: number;
  currency_issued: number;
  currency_redeemed: number;
  total_coupons_issued: number;
}

type SummaryCardKey = keyof DashboardSummary;

interface SummaryCardConfig {
  key: SummaryCardKey;
  title: string;
  icon: LucideIcon;
  variant: "primary" | "secondary" | "success" | "accent";
}

const SUMMARY_CARDS: SummaryCardConfig[] = [
  { key: "total_customers", title: "Total Customers", icon: Users, variant: "primary" },
  { key: "currency_issued", title: "Currency Issued", icon: Coins, variant: "success" },
  { key: "currency_redeemed", title: "Currency Redeemed", icon: Gift, variant: "accent" },
  { key: "total_coupons_issued", title: "Coupons Issued", icon: Zap, variant: "secondary" },
];

// The two currency cards show the code (e.g. POINTS) as a subtitle.
const CURRENCY_CARD_KEYS = new Set<SummaryCardKey>(["currency_issued", "currency_redeemed"]);

function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

interface DashboardSummaryCardsProps {
  summary: DashboardSummary | undefined;
  isLoading?: boolean;
  /** Currency code shown as the subtitle on the two currency cards (e.g. POINTS). */
  currencyCode?: string;
  /** Slot rendered below the card grid; typical use is an upgrade or error banner. */
  footer?: ReactNode;
}

/**
 * Four KPI cards: Total Customers, Currency Issued, Currency Redeemed, Coupons Issued.
 * Pure presentational — caller supplies the summary row, loading flag, the currency
 * code label, and an optional footer slot.
 */
export function DashboardSummaryCards({
  summary,
  isLoading,
  currencyCode,
  footer,
}: DashboardSummaryCardsProps): ReactNode {
  return (
    <section aria-label="Key metrics" className="space-y-3">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {SUMMARY_CARDS.map((card) => (
          <StatCard
            key={card.key}
            title={card.title}
            value={summary ? formatCompact(summary[card.key]) : "—"}
            subtitle={summary && CURRENCY_CARD_KEYS.has(card.key) ? currencyCode : undefined}
            icon={card.icon}
            variant={card.variant}
            isLoading={isLoading}
          />
        ))}
      </div>
      {footer}
    </section>
  );
}
