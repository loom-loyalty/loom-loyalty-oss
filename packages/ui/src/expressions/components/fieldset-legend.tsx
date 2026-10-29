import type { ReactNode } from "react";
import { cn } from "../../lib/utils.js";

export interface FieldsetLegendProps {
  children: ReactNode;
  trailing?: ReactNode;
  className?: string;
}

/**
 * A `<fieldset>` legend rendered as normal content inside the fieldset's
 * padded area instead of a native `<legend>` box, which always straddles
 * the border-top and leaves a gap in it wherever it sits. The native
 * `<legend>` is kept but visually hidden (`sr-only`'s `position: absolute`
 * removes it from the border-notch layout entirely) so the fieldset's
 * accessible name is unchanged for screen readers.
 */
export function FieldsetLegend({ children, trailing, className }: FieldsetLegendProps): ReactNode {
  return (
    <>
      <legend className="sr-only">{children}</legend>
      <div className={cn("flex w-full items-center justify-between gap-3", className)}>
        <span className="text-muted-foreground text-[11px] font-medium tracking-wider uppercase">
          {children}
        </span>
        {trailing}
      </div>
    </>
  );
}
