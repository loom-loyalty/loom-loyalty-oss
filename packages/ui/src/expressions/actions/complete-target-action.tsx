/**
 * Complete Target Data Action Component
 *
 * Target reference via TargetField, auto-registration, metadata filtering.
 */

import { memo, useCallback, useId, type ReactNode } from "react";
import { MetadataField } from "../../forms/metadata-field/index.js";
import { MetadataTypeField } from "../../forms/metadata-type-field/index.js";
import { TargetField } from "../../forms/target-field/index.js";
import { useTargetField } from "../../forms/target-field/use-target-field.js";
import { Label } from "../../primitives/label.js";
import { Switch } from "../../primitives/switch.js";

import { FieldsetLegend } from "../components/fieldset-legend.js";
import { PathOrValueField } from "../inputs/path-or-value-field.js";
import type { ActionComponentProps, CompleteTargetDataAction } from "../types";

type CompleteTargetData = CompleteTargetDataAction["completeTargetData"];

export const CompleteTargetActionComponent = memo(function CompleteTargetActionComponent({
  value,
  onChange,
  disabled,
  className,
  presentation = "card",
}: ActionComponentProps<CompleteTargetData>): ReactNode {
  const targetFieldId = useId();
  const { findTarget } = useTargetField();

  const update = useCallback(
    (partial: Partial<CompleteTargetData>) => onChange({ ...value, ...partial }),
    [value, onChange]
  );

  const handleTargetChange = useCallback(
    (targetId: string) => {
      const target = findTarget(targetId);
      update({
        targetId: targetId || undefined,
        targetCode: target?.code ?? undefined,
      });
    },
    [update, findTarget]
  );

  return (
    <div className={className}>
      <div className="space-y-3">
        <fieldset className="border-border bg-card space-y-3 rounded-lg border p-3">
          <FieldsetLegend>Target</FieldsetLegend>
          <div>
            <Label htmlFor={targetFieldId} className="mb-1.5 block text-xs">
              Target
            </Label>
            <TargetField
              id={targetFieldId}
              value={value.targetId ?? ""}
              onValueChange={handleTargetChange}
              placeholder="Select target..."
              disabled={disabled}
            />
          </div>
          <label className="flex items-center gap-2">
            <Switch
              checked={value.registerTarget ?? false}
              onCheckedChange={(v) => update({ registerTarget: v })}
              disabled={disabled}
            />
            <Label className="text-xs">Auto-register target</Label>
          </label>
        </fieldset>

        <fieldset className="border-border bg-card space-y-3 rounded-lg border p-3">
          <FieldsetLegend>Metadata Filtering (optional)</FieldsetLegend>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <PathOrValueField
              path={value.metadataTypeCodePath}
              value={value.metadataTypeCodeValue}
              onPathChange={(metadataTypeCodePath) => update({ metadataTypeCodePath })}
              label="Metadata type"
              pathLabel="Metadata type path"
              disabled={disabled}
              presentation={presentation}
            >
              <div>
                <Label className="mb-1.5 block text-xs">Metadata Type</Label>
                <MetadataTypeField
                  value={value.metadataTypeCodeValue ?? ""}
                  onValueChange={(metadataTypeCodeValue) =>
                    update({
                      metadataTypeCodeValue: metadataTypeCodeValue || undefined,
                      metadataCodeValue: undefined,
                    })
                  }
                  placeholder="Select metadata type..."
                  disabled={disabled}
                />
              </div>
            </PathOrValueField>
            <PathOrValueField
              path={value.metadataCodePath}
              value={value.metadataCodeValue}
              onPathChange={(metadataCodePath) => update({ metadataCodePath })}
              label="Metadata code"
              pathLabel="Metadata code path"
              disabled={disabled}
              presentation={presentation}
            >
              <div>
                <Label className="mb-1.5 block text-xs">Metadata Code</Label>
                <MetadataField
                  typeCode={value.metadataTypeCodeValue ?? ""}
                  typeLabel="Metadata"
                  value={value.metadataCodeValue ?? ""}
                  onValueChange={(metadataCodeValue) =>
                    update({ metadataCodeValue: metadataCodeValue || undefined })
                  }
                  placeholder="Select metadata..."
                  disabled={disabled || !value.metadataTypeCodeValue}
                  showCreateNew={false}
                />
              </div>
            </PathOrValueField>
          </div>
        </fieldset>
      </div>
    </div>
  );
});
