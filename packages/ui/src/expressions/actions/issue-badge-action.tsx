/**
 * Issue Customer Badge Action Component
 *
 * Badge selection via BadgeField, date period, synchronous.
 */

import { memo, useCallback, useId, useMemo, type ReactNode } from "react";
import { BadgeField } from "../../forms/badge-field/index.js";
import { useBadgeField } from "../../forms/badge-field/use-badge-field.js";
import { DateTimeInput } from "../../forms/date-time-input.js";
import { Label } from "../../primitives/label.js";
import { Switch } from "../../primitives/switch.js";

import { FieldsetLegend } from "../components/fieldset-legend.js";
import type { ActionComponentProps, IssueCustomerBadgeAction } from "../types";

type IssueBadgeData = IssueCustomerBadgeAction["issueCustomerBadge"];

export const IssueBadgeActionComponent = memo(function IssueBadgeActionComponent({
  value,
  onChange,
  disabled,
  className,
}: ActionComponentProps<IssueBadgeData>): ReactNode {
  const badgeFieldId = useId();
  const { badges, findBadge } = useBadgeField();

  const update = useCallback(
    (partial: Partial<IssueBadgeData>) => onChange({ ...value, ...partial }),
    [value, onChange]
  );

  // The NL reward generator emits a badge as `{ badgeCode }` only (no `badgeId` —
  // the prompt forbids ids), so resolve the selector's id from the code when the id
  // is absent, mirroring the currency editor's code→id resolution. Without this an
  // AI-drafted badge reward would show an empty selector in the review builder.
  const selectedBadgeId = useMemo(() => {
    if (value.badgeId) return value.badgeId;
    if (!value.badgeCode) return "";
    const badge = badges.find((b) => b.code === value.badgeCode);
    return badge ? (badge.badgeId ?? badge.code) : "";
  }, [value.badgeId, value.badgeCode, badges]);

  const handleBadgeChange = useCallback(
    (badgeId: string) => {
      const badge = findBadge(badgeId);
      update({
        badgeId: badgeId || undefined,
        badgeCode: badge?.code ?? undefined,
      });
    },
    [update, findBadge]
  );

  return (
    <div className={className}>
      <div className="space-y-3">
        <div>
          <Label htmlFor={badgeFieldId} className="mb-1.5 block text-xs">
            Badge
          </Label>
          <BadgeField
            id={badgeFieldId}
            value={selectedBadgeId}
            onValueChange={handleBadgeChange}
            placeholder="Select badge..."
            disabled={disabled}
          />
        </div>

        <fieldset className="border-border bg-card space-y-3 rounded-lg border p-3">
          <FieldsetLegend>Validity Period</FieldsetLegend>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <DateTimeInput
                label="Start date"
                value={value.dateTimePeriod?.startDateTime}
                onChange={(startDateTime) =>
                  update({
                    dateTimePeriod: {
                      ...value.dateTimePeriod,
                      startDateTime: startDateTime || undefined,
                    },
                  })
                }
                disabled={disabled}
              />
            </div>
            <div>
              <DateTimeInput
                label="End date"
                value={value.dateTimePeriod?.endDateTime}
                onChange={(endDateTime) =>
                  update({
                    dateTimePeriod: {
                      ...value.dateTimePeriod,
                      endDateTime: endDateTime || undefined,
                    },
                  })
                }
                disabled={disabled}
              />
            </div>
          </div>
        </fieldset>

        <div className="bg-card rounded-md p-2">
          <label className="flex items-center gap-2">
            <Switch
              checked={value.synchronous ?? false}
              onCheckedChange={(v) => update({ synchronous: v })}
              disabled={disabled}
            />
            <Label className="text-xs">Synchronous execution</Label>
          </label>
        </div>
      </div>
    </div>
  );
});
