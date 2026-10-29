import type { ReactNode } from "react";
import { cn } from "../../../../lib/utils.js";

export interface SectionProps {
  title: string;
  /** Optional subtitle rendered below the heading */
  description?: string;
  /** Optional right-aligned action slot (e.g. Copy button on JSON schema) */
  action?: ReactNode;
  /** Override body spacing — defaults to space-y-2. */
  bodyClassName?: string;
  children: ReactNode;
}

/**
 * Shared section heading for data-model feature (detail sheet + element dialog).
 * Renders a semantic `<section>` with uppercase heading and optional description / action.
 */
export function Section({
  title,
  description,
  action,
  bodyClassName,
  children,
}: SectionProps): ReactNode {
  return (
    <section className="space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-foreground text-sm font-semibold tracking-wide uppercase">{title}</h3>
          {description && <p className="text-muted-foreground mt-1 text-xs">{description}</p>}
        </div>
        {action}
      </div>
      <div className={cn(bodyClassName ?? "space-y-2")}>{children}</div>
    </section>
  );
}

export interface DetailRowProps {
  label: string;
  value: string;
  mono?: boolean;
  /**
   * When provided, renders the value inside a semantic `<time dateTime={...}>`
   * so assistive tech and date-aware crawlers can parse the timestamp. Pass the
   * ISO string (e.g. from `toISODateTime`); the displayed `value` stays as the
   * human-formatted label.
   */
  dateTime?: string | null;
}

/**
 * Label + value pair used in the data-model detail sheet. `mono` renders the value in
 * monospace for codes / IDs. When `dateTime` is set, wraps the value in `<time>`.
 */
export function DetailRow({ label, value, mono, dateTime }: DetailRowProps): ReactNode {
  const valueClasses = cn("text-foreground", mono ? "font-mono text-sm" : "text-sm font-medium");
  return (
    <div>
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className={valueClasses}>{dateTime ? <time dateTime={dateTime}>{value}</time> : value}</p>
    </div>
  );
}
