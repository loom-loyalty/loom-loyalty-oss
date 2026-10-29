/**
 * Add Counter Data Action Component
 *
 * Amount config, target reference via TargetField, metadata filtering.
 */

import { memo, useCallback, useId, type ReactNode } from "react";
import { MetadataField } from "../../forms/metadata-field/index.js";
import { MetadataTypeField } from "../../forms/metadata-type-field/index.js";
import { TargetField } from "../../forms/target-field/index.js";
import { useTargetField } from "../../forms/target-field/use-target-field.js";
import { Input } from "../../primitives/input.js";
import { Label } from "../../primitives/label.js";
import { Switch } from "../../primitives/switch.js";

import { FieldsetLegend } from "../components/fieldset-legend.js";
import { JsonPathInput } from "../inputs/json-path-input.js";
import { PathOrValueField } from "../inputs/path-or-value-field.js";
import { PreOperationSelector } from "../inputs/pre-operation-selector.js";
import type { ActionComponentProps, AddCounterDataAction, PreOperation } from "../types";
import { RoundingFields } from "./rounding-fields.js";

type AddCounterData = AddCounterDataAction["addCounterData"];

export const AddCounterDataActionComponent = memo(function AddCounterDataActionComponent({
  value,
  onChange,
  disabled,
  className,
  presentation = "card",
}: ActionComponentProps<AddCounterData>): ReactNode {
  const targetFieldId = useId();
  const { findTarget } = useTargetField();

  const update = useCallback(
    (partial: Partial<AddCounterData>) => onChange({ ...value, ...partial }),
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
        {/* Amount Configuration */}
        <fieldset className="border-border bg-card space-y-3 rounded-lg border p-3">
          <FieldsetLegend
            trailing={
              <label className="flex items-center gap-2">
                <Label className="text-xs">Fixed amount</Label>
                <Switch
                  checked={value.isFixedAmount}
                  onCheckedChange={(v) => update({ isFixedAmount: v })}
                  disabled={disabled}
                />
              </label>
            }
          >
            Amount Configuration
          </FieldsetLegend>
          {value.isFixedAmount ? (
            <div>
              <Label className="mb-1.5 block text-xs">Increment Value</Label>
              <Input
                type="number"
                value={value.defaultResult}
                onChange={(e) => update({ defaultResult: Number(e.target.value) })}
                disabled={disabled}
                className="text-xs"
              />
            </div>
          ) : (
            <>
              <JsonPathInput
                value={value.path ?? ""}
                onChange={(path) => update({ path })}
                label="Value Path"
                disabled={disabled}
                presentation={presentation}
              />
              <PreOperationSelector
                value={value.preOperation}
                onChange={(preOperation: PreOperation | undefined) => update({ preOperation })}
                disabled={disabled}
              />
              <div>
                <Label className="mb-1.5 block text-xs">Default Value</Label>
                <Input
                  type="number"
                  value={value.defaultResult}
                  onChange={(e) => update({ defaultResult: Number(e.target.value) })}
                  disabled={disabled}
                  className="text-xs"
                />
              </div>
            </>
          )}
          <RoundingFields value={value} onChange={update} disabled={disabled} />
        </fieldset>

        {/* Target Reference */}
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

        {/* Metadata Filtering */}
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
