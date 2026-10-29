"use client";

import type { LucideIcon } from "lucide-react";
import type { ReactNode, Ref } from "react";

import { Card, CardContent } from "../primitives/card";

export interface NoticeCardProps {
  /** Icon shown in the muted circle above the title */
  icon: LucideIcon;
  /** Short heading for the notice */
  title: string;
  /** Supporting copy under the title */
  description: ReactNode;
  /** Optional action (button, link, inline error) rendered below the copy */
  action?: ReactNode;
  /** Heading level; defaults to `h2` so it sits under the page's `PageHeader` `h1` */
  headingLevel?: "h2" | "h3";
  /**
   * Ref to the title. When set, the title is focusable (`tabIndex={-1}`) so a
   * page can move focus onto the notice after the control that opened it unmounts.
   */
  headingRef?: Ref<HTMLHeadingElement>;
  /** Additional className on the card */
  className?: string;
}

/**
 * Centered, page-level notice inside a card: an icon in a muted circle, a title,
 * and short copy. Use it under a `PageHeader` when a page can't show its normal
 * content, e.g. a feature that isn't enabled or a page that doesn't exist.
 *
 * @example
 * ```tsx
 * <NoticeCard
 *   icon={ShieldX}
 *   title="Single sign-on isn't enabled"
 *   description="Contact your account team to set it up."
 * />
 * ```
 */
export function NoticeCard({
  icon: Icon,
  title,
  description,
  action,
  headingLevel: Heading = "h2",
  headingRef,
  className,
}: NoticeCardProps): ReactNode {
  return (
    <Card className={className}>
      <CardContent className="pt-6">
        <div className="flex flex-col items-center gap-4 py-12 text-center">
          <div className="bg-muted flex h-16 w-16 items-center justify-center rounded-full">
            <Icon className="text-muted-foreground h-8 w-8" aria-hidden="true" />
          </div>
          <div>
            <Heading
              ref={headingRef}
              tabIndex={headingRef ? -1 : undefined}
              // The ring only shows when a page focuses the title through headingRef.
              className="text-foreground focus-visible:ring-ring focus-visible:ring-offset-background rounded-sm font-semibold focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              {title}
            </Heading>
            <div className="text-muted-foreground mt-1 max-w-sm text-sm">{description}</div>
          </div>
          {action && <div className="flex flex-col items-center gap-3">{action}</div>}
        </div>
      </CardContent>
    </Card>
  );
}
