"use client";

import { FileQuestionMark } from "lucide-react";
import { isValidElement, type ReactElement, type ReactNode } from "react";

import { cn } from "../lib/utils";
import { Button } from "../primitives/button";
import { NoticeCard } from "./notice-card";
import { PageHeader } from "./page-header";

export interface NotFoundScreenProps {
  /** Page heading (the page's `<h1>`). */
  title?: string;
  /** Heading inside the notice card. */
  heading?: string;
  /** Supporting copy inside the notice card. */
  description?: string;
  /**
   * CTA element — pass the app's router link, e.g. `<Link to="/">Back to dashboard</Link>`.
   * It inherits button styling (via `Button asChild`, which requires a single element).
   * When omitted (or not a valid element), a plain anchor to `homeHref` is rendered.
   */
  homeAction?: ReactElement;
  /** Destination for the default CTA when `homeAction` is not provided. Use a trusted path. */
  homeHref?: string;
  /** Label for the default CTA when `homeAction` is not provided. */
  homeLabel?: string;
  /** Additional className on the root. */
  className?: string;
}

/**
 * Not-found state, shared across apps. Presentational only — pass the app's
 * router link via `homeAction` so the CTA navigates client-side.
 *
 * Renders a page header and a centered notice card inside the app shell's
 * content area, so it matches other page-level notices and the navigation stays.
 *
 * @example
 * ```tsx
 * <NotFoundScreen homeAction={<Link to="/">Back to dashboard</Link>} />
 * ```
 */
export function NotFoundScreen({
  title = "Page not found",
  heading = "We couldn't find that page",
  description = "The page you're looking for doesn't exist or may have moved.",
  homeAction,
  homeHref = "/",
  homeLabel = "Back to dashboard",
  className,
}: NotFoundScreenProps): ReactNode {
  return (
    <div className={cn("space-y-6", className)}>
      <PageHeader title={title} />
      <NoticeCard
        icon={FileQuestionMark}
        title={heading}
        description={description}
        action={
          <Button asChild variant="outline">
            {isValidElement(homeAction) ? homeAction : <a href={homeHref}>{homeLabel}</a>}
          </Button>
        }
      />
    </div>
  );
}
