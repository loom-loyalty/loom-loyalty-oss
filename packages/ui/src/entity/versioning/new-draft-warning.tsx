import { TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "../../lib/utils.js";

export interface NewDraftWarningProps {
  /** The version being edited, e.g. 3 for the live v3. */
  version?: number;
  /** The draft's version number when it isn't `version + 1`. */
  draftVersion?: number;
  /** Its status, e.g. "PUBLISHED" or "PAUSED". */
  versionStatus?: string;
  /** What the thing is called in this screen ("rule", "segment", "flow"). */
  noun?: string;
  /** What starts the draft. Defaults to "Saving your changes". */
  trigger?: string;
  /**
   * What happens to the live version meanwhile. Defaults to "What runs now
   * stays as it is until you publish the draft."
   */
  consequence?: string;
  /** Extra controls shown beside the message. */
  children?: ReactNode;
  className?: string;
}

/**
 * Warns that editing a live or paused version saves into a new draft
 * version, and that the live one keeps running unchanged until that draft is
 * published (no New Version button; Edit on a published item
 * starts a draft by default, with this warning).
 */
export function NewDraftWarning({
  version,
  draftVersion,
  versionStatus,
  noun = "item",
  trigger = "Saving your changes",
  consequence = "What runs now stays as it is until you publish the draft.",
  children,
  className,
}: NewDraftWarningProps): ReactNode {
  const which =
    version === undefined
      ? `This ${noun}`
      : versionStatus === "PUBLISHED"
        ? `This is the live version (v${version}).`
        : versionStatus
          ? `Version v${version} is ${versionStatus.toLowerCase()}.`
          : `This is v${version}.`;
  const next = draftVersion ?? (version === undefined ? undefined : version + 1);
  const lead = version === undefined ? `${which} is live.` : which;
  return (
    <div
      role="note"
      className={cn(
        "border-warning/40 bg-warning/10 text-foreground flex flex-wrap items-start gap-3 rounded-lg border p-3",
        className
      )}
      data-testid="new-draft-warning"
    >
      <TriangleAlert aria-hidden="true" className="text-warning-dark mt-0.5 size-4 shrink-0" />
      <p className="flex-1 text-sm">
        {lead} {trigger} starts a new draft version
        {next === undefined ? "" : ` (v${next})`}. {consequence}
      </p>
      {children}
    </div>
  );
}
