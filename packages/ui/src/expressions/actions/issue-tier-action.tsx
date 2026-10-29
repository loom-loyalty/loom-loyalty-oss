/**
 * Issue Customer Tier Action Component
 *
 * Tier selection via TierField, lifetime/trial flags, date period, synchronous.
 */

import { memo, useCallback, useId, type ReactNode } from "react";
import { DateTimeInput } from "../../forms/date-time-input.js";
import { TierField } from "../../forms/tier-field/index.js";
import { Label } from "../../primitives/label.js";
import { Switch } from "../../primitives/switch.js";

import { FieldsetLegend } from "../components/fieldset-legend.js";
import type { ActionComponentProps, IssueCustomerTierAction } from "../types";

type IssueTierData = IssueCustomerTierAction["issueCustomerTier"];

export const IssueTierActionComponent = memo(function IssueTierActionComponent({
  value,
  onChange,
  disabled,
  className,
}: ActionComponentProps<IssueTierData>): ReactNode {
  const tierFieldId = useId();
  const update = useCallback(
    (partial: Partial<IssueTierData>) => onChange({ ...value, ...partial }),
    [value, onChange]
  );

  const handleTierChange = useCallback(
    (tierCode: string) => {
      // When a new tier is selected by code, clear legacy tierId since code
      // takes precedence. When cleared, preserve existing tierId for backward
      // compat with rules that only stored a UUID.
      update(tierCode ? { tierCode, tierId: undefined } : { tierCode: undefined });
    },
    [update]
  );

  return (
    <div className={className}>
      <div className="space-y-3">
        <div>
          <Label htmlFor={tierFieldId} className="mb-1.5 block text-xs">
            Tier
          </Label>
          <TierField
            id={tierFieldId}
            idField="code"
            value={value.tierCode ?? ""}
            onValueChange={handleTierChange}
            placeholder="Select tier..."
            disabled={disabled}
          />
        </div>
        <div className="bg-card space-y-2 rounded-md p-2">
          <label className="flex items-center gap-2">
            <Switch
              checked={value.issueLifetimeTier ?? false}
              onCheckedChange={(v) => update({ issueLifetimeTier: v })}
              disabled={disabled}
            />
            <Label className="text-xs">Issue lifetime tier</Label>
          </label>
          <label className="flex items-center gap-2">
            <Switch
              checked={value.issueTrialTier ?? false}
              onCheckedChange={(v) => update({ issueTrialTier: v })}
              disabled={disabled}
            />
            <Label className="text-xs">Issue trial tier</Label>
          </label>
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
