import { CheckCircle2, Circle } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "../lib/utils";

export interface ReadinessChecklistItem {
  id: string;
  /** What has to be true, e.g. "Agreements accepted". */
  label: string;
  met: boolean;
  /** Why it is met, or what is missing. */
  description?: ReactNode;
  /** Call to action shown while the item is unmet (a link or button). */
  action?: ReactNode;
}

export interface ReadinessChecklistProps {
  items: readonly ReadinessChecklistItem[];
  /** Accessible name of the list. */
  label: string;
  className?: string;
}

/**
 * A list of conditions with whether each is met and, for an unmet one, its call
 * to action. Presentational: callers supply the conditions and the actions.
 */
export function ReadinessChecklist({
  items,
  label,
  className,
}: ReadinessChecklistProps): ReactNode {
  return (
    <ul aria-label={label} className={cn("divide-border divide-y", className)}>
      {items.map((item) => (
        <li
          key={item.id}
          className="flex flex-col gap-3 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center"
        >
          <div className="flex flex-1 items-start gap-3">
            {item.met ? (
              <CheckCircle2
                aria-hidden="true"
                className="text-success-dark mt-0.5 h-5 w-5 shrink-0"
              />
            ) : (
              <Circle
                aria-hidden="true"
                className="text-muted-foreground mt-0.5 h-5 w-5 shrink-0"
              />
            )}
            <div className="min-w-0">
              <p className="text-foreground text-sm font-medium">
                {item.label}
                <span className="sr-only">{item.met ? ", done" : ", not done"}</span>
              </p>
              {item.description ? (
                <p className="text-muted-foreground text-sm">{item.description}</p>
              ) : null}
            </div>
          </div>
          {!item.met && item.action ? <div className="shrink-0 sm:ml-4">{item.action}</div> : null}
        </li>
      ))}
    </ul>
  );
}
