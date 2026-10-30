import { Award, Lock } from "lucide-react";

import { cn } from "../../../lib/utils";
import { Card } from "../../../primitives/card";
import { Progress } from "../../../primitives/progress";

export type BadgeShelfStatus = "earned" | "in_progress" | "locked";

export interface BadgeShelfItem {
  id: string;
  name: string;
  status: BadgeShelfStatus;
  /** Short line under the name, e.g. "Earned week 4" or "2 of 5 lessons" */
  detail?: string;
  /** Progress toward an in-progress badge */
  progress?: { current: number; target: number };
}

export interface BadgeShelfProps {
  badges: BadgeShelfItem[];
  title?: string;
  columns?: 2 | 3 | 4;
  className?: string;
}

const COLUMNS = {
  2: "grid-cols-2",
  3: "grid-cols-2 sm:grid-cols-3",
  4: "grid-cols-2 sm:grid-cols-4",
} as const;

const STATUS_LABEL: Record<BadgeShelfStatus, string> = {
  earned: "Earned",
  in_progress: "In progress",
  locked: "Locked",
};

/**
 * A member's badges at a glance: earned ones lit, in-progress ones with their
 * progress, the rest locked. Presentational only; the caller maps its badge and
 * target data into `badges`.
 */
export function BadgeShelf({ badges, title = "Badges", columns = 2, className }: BadgeShelfProps) {
  const earned = badges.filter((b) => b.status === "earned").length;
  return (
    <section aria-label={title} className={cn("space-y-3", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-foreground text-base font-semibold">{title}</h3>
        <p className="text-muted-foreground text-sm">{earned} earned</p>
      </div>
      <ul className={cn("grid gap-3", COLUMNS[columns])}>
        {badges.map((badge) => (
          <li key={badge.id}>
            <Card
              className={cn(
                "flex h-full flex-col items-center gap-2 p-4 text-center",
                badge.status === "earned" && "border-accent bg-accent/10 border",
                badge.status === "locked" && "border-border border border-dashed"
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "flex size-10 items-center justify-center rounded-full",
                  badge.status === "earned"
                    ? "bg-accent text-accent-foreground"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {badge.status === "locked" ? (
                  <Lock className="size-4" />
                ) : (
                  <Award className="size-5" />
                )}
              </span>
              <span
                className={cn(
                  "text-sm leading-tight font-semibold",
                  badge.status === "locked" ? "text-muted-foreground" : "text-foreground"
                )}
              >
                {badge.name}
                <span className="sr-only">, {STATUS_LABEL[badge.status]}</span>
              </span>
              {badge.detail && (
                <span
                  className={cn(
                    "text-xs",
                    badge.status === "earned" ? "text-accent-foreground" : "text-muted-foreground"
                  )}
                >
                  {badge.detail}
                </span>
              )}
              {badge.status === "in_progress" && badge.progress && badge.progress.target > 0 && (
                <Progress
                  aria-label={`${badge.name} progress`}
                  getValueLabel={(value, max) => `${value} of ${max}`}
                  value={badge.progress.current}
                  max={badge.progress.target}
                  size="sm"
                  className="mt-auto"
                />
              )}
            </Card>
          </li>
        ))}
      </ul>
    </section>
  );
}
