/**
 * DetailRow - labeled value row shared by the webhook detail surfaces.
 */

import type { ReactNode } from "react";

export interface DetailRowProps {
  label: string;
  value: string;
  /** Render the value in the data (monospace) typeface for technical strings. */
  mono?: boolean;
  /** ISO date string for a semantic <time> element. */
  dateTime?: string;
}

export function DetailRow({ label, value, mono, dateTime }: DetailRowProps): ReactNode {
  const content = dateTime ? <time dateTime={dateTime}>{value}</time> : value;

  return (
    <div>
      <p className="text-muted-foreground text-sm">{label}</p>
      <p
        className={
          mono ? "text-foreground font-mono text-sm break-all" : "text-foreground font-medium"
        }
      >
        {content}
      </p>
    </div>
  );
}
