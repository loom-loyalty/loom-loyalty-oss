/**
 * Has Badge Expression Component
 *
 * Badge selection via BadgeField and revalidateBadge switch.
 */

import { memo, useCallback, useId, type ReactNode } from "react";
import { BadgeField } from "../../forms/badge-field/index.js";
import { useBadgeField } from "../../forms/badge-field/use-badge-field.js";
import { Label } from "../../primitives/label.js";
import { Switch } from "../../primitives/switch.js";

import type { ExpressionComponentProps, HasBadgeExpression } from "../types";

type HasBadgeData = HasBadgeExpression["hasBadge"];

export const HasBadgeExpressionComponent = memo(function HasBadgeExpressionComponent({
  value,
  onChange,
  disabled,
  mode,
  className,
}: ExpressionComponentProps<HasBadgeData>): ReactNode {
  const badgeFieldId = useId();
  const { findBadge } = useBadgeField();

  const handleBadgeChange = useCallback(
    (badgeId: string) => onChange({ ...value, badgeId }),
    [value, onChange]
  );

  const handleRevalidateChange = useCallback(
    (revalidateBadge: boolean) => onChange({ ...value, revalidateBadge }),
    [value, onChange]
  );

  if (mode === "display") {
    const badge = value.badgeId ? findBadge(value.badgeId) : undefined;
    return (
      <div className={className}>
        <span className="text-muted-foreground text-xs">
          Badge: {badge?.name ?? (value.badgeId || "(not set)")}
        </span>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="space-y-3">
        <div>
          <Label htmlFor={badgeFieldId} className="mb-1.5 block text-xs">
            Badge
          </Label>
          <BadgeField
            id={badgeFieldId}
            value={value.badgeId}
            onValueChange={handleBadgeChange}
            placeholder="Select badge..."
            disabled={disabled}
          />
        </div>
        <label className="flex items-center gap-2">
          <Switch
            checked={value.revalidateBadge}
            onCheckedChange={handleRevalidateChange}
            disabled={disabled}
          />
          <Label className="text-xs">Revalidate badge</Label>
        </label>
      </div>
    </div>
  );
});
