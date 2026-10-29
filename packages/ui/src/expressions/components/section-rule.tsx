import type { ReactNode } from "react";

export interface SectionRuleProps {
  label: string;
  trailing?: ReactNode;
  /**
   * Screen-reader heading text for this section, distinct from the terse
   * visible `label` (e.g. "Actions" vs the visible "THEN" pill) — restores a
   * heading-navigable landmark for this section without changing its visual
   * design (adversarial review finding: a prior `<h5>Actions</h5>` was
   * removed during the redesign with no heading replacement). Defaults to
   * `label` when omitted.
   */
  srHeading?: string;
}

export function SectionRule({ label, trailing, srHeading }: SectionRuleProps): ReactNode {
  return (
    <div className="flex items-center gap-2">
      <h5 className="sr-only">{srHeading ?? label}</h5>
      <span className="text-primary text-[10px] font-semibold tracking-wider uppercase">
        {label}
      </span>
      <span className="bg-border h-px flex-1" aria-hidden="true" />
      {trailing}
    </div>
  );
}
