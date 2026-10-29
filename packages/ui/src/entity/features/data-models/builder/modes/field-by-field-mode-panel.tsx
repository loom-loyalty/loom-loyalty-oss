/**
 * FieldByFieldModePanel
 *
 * No input controls of its own. Authoring happens in the field table on the
 * right. The caption exists so the rail doesn't read as broken when this mode
 * is active.
 */

import type { ReactNode } from "react";

export function FieldByFieldModePanel(): ReactNode {
  return (
    <p className="text-muted-foreground text-xs">
      Add each field with <span className="text-foreground font-medium">+ Add field</span> in the
      Fields table, then set its type and whether it&apos;s required.
    </p>
  );
}
