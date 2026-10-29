import { AlertCircle, AlertTriangle, Clock } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../lib/utils";

export type AppBannerVariant = "accent" | "warning" | "destructive";

export interface AppBannerProps {
  /** Severity: `accent` for a heads-up, `warning` for action needed soon, `destructive` for action needed now. */
  variant: AppBannerVariant;
  /** One-line headline. */
  title: ReactNode;
  /** Optional supporting sentence. */
  description?: ReactNode;
  /** The call to action, supplied by the caller so it can choose a router link, an anchor, or a button. */
  action?: ReactNode;
  className?: string;
}

const VARIANT_STYLES: Record<AppBannerVariant, { container: string; icon: string }> = {
  accent: { container: "border-accent/30 bg-accent/5", icon: "text-accent" },
  warning: { container: "border-warning/40 bg-warning/10", icon: "text-warning-dark" },
  destructive: { container: "border-destructive/30 bg-destructive/5", icon: "text-destructive" },
};

const VARIANT_ICONS: Record<AppBannerVariant, typeof Clock> = {
  accent: Clock,
  warning: AlertTriangle,
  destructive: AlertCircle,
};

/**
 * A full-width notice above an app's page content, for state that concerns the whole session
 * (a trial ending, a failed payment) rather than one page. Visual shell only.
 *
 * `destructive` is announced assertively (`role="alert"`); the others politely (`role="status"`).
 */
export function AppBanner({
  variant,
  title,
  description,
  action,
  className,
}: AppBannerProps): ReactNode {
  const styles = VARIANT_STYLES[variant];
  const Icon = VARIANT_ICONS[variant];
  return (
    <div
      role={variant === "destructive" ? "alert" : "status"}
      className={cn(
        "flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between",
        styles.container,
        className
      )}
    >
      <div className="flex items-start gap-3">
        <Icon className={cn("mt-0.5 h-5 w-5 shrink-0", styles.icon)} aria-hidden="true" />
        <div className="space-y-0.5">
          <p className="text-foreground text-sm font-medium">{title}</p>
          {description && <p className="text-muted-foreground text-sm">{description}</p>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
