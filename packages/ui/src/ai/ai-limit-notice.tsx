import { formatUpcomingTime } from "@loom-loyalty/core";
import { Clock } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "../lib/utils";
import { useAiLimitConfig } from "./ai-limit-context";
import type { AiLimitLinkRenderProps, AiLimitNoticeProps } from "./types";

const LINK_CLASS = cn(
  "text-primary-dark inline-flex min-h-11 items-center font-medium underline underline-offset-2",
  "hover:text-foreground focus-visible:ring-ring rounded-sm focus-visible:ring-2 focus-visible:outline-none"
);

function DefaultLink({ href, className, children }: AiLimitLinkRenderProps): ReactNode {
  return (
    <a href={href} className={className}>
      {children}
    </a>
  );
}

/**
 * Inline notice for an AI request refused by the daily AI allowance. Shows
 * when the allowance resets and, for trial orgs (`limit.upgrade`), a link to
 * the plans page. Never shows a price.
 */
export function AiLimitNotice({
  limit,
  upgradeHref,
  renderLink,
  className,
}: AiLimitNoticeProps): ReactNode {
  const config = useAiLimitConfig();
  const href = upgradeHref ?? config.upgradeHref;
  const LinkRenderer = renderLink ?? config.renderLink ?? DefaultLink;

  const until = limit.resetsAt ? formatUpcomingTime(limit.resetsAt) : "your daily allowance resets";

  return (
    <div
      role="alert"
      data-testid="ai-limit-notice"
      className={cn(
        "border-warning/30 bg-warning/5 flex gap-3 rounded-lg border p-3 text-sm",
        className
      )}
    >
      <Clock className="text-warning-dark mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0 space-y-1">
        <p className="text-foreground font-medium">Daily AI limit reached</p>
        <p className="text-muted-foreground">AI features are paused until {until}.</p>
        {limit.upgrade && (
          <p className="text-muted-foreground">
            Your trial includes a small daily AI allowance. Upgrade your plan for more.
          </p>
        )}
        {limit.upgrade && href && (
          <LinkRenderer href={href} className={LINK_CLASS}>
            See plans
          </LinkRenderer>
        )}
      </div>
    </div>
  );
}
