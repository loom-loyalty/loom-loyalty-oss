/**
 * Metadata Tagging Action Component
 *
 * Tags the customer with a metadata entry (type code + code), optionally
 * weighted.
 */

import { memo, useCallback, useId, type ReactNode } from "react";
import { MetadataField } from "../../forms/metadata-field/index.js";
import { MetadataTypeField } from "../../forms/metadata-type-field/index.js";
import { Input } from "../../primitives/input.js";
import { Label } from "../../primitives/label.js";

import type { ActionComponentProps, MetadataTaggingAction } from "../types";

type MetadataTaggingData = MetadataTaggingAction["metadataTagging"];

export const MetadataTaggingActionComponent = memo(function MetadataTaggingActionComponent({
  value,
  onChange,
  disabled,
  className,
}: ActionComponentProps<MetadataTaggingData>): ReactNode {
  const typeFieldId = useId();
  const codeFieldId = useId();
  const weightId = useId();

  const update = useCallback(
    (partial: Partial<MetadataTaggingData>) => onChange({ ...value, ...partial }),
    [value, onChange]
  );

  return (
    <div className={className}>
      <div className="space-y-3">
        <div>
          <Label htmlFor={typeFieldId} className="mb-1.5 block text-xs">
            Metadata Type
          </Label>
          <MetadataTypeField
            id={typeFieldId}
            value={value.metadataTypeCode}
            onValueChange={(metadataTypeCode) => update({ metadataTypeCode, metadataCode: "" })}
            placeholder="Select metadata type..."
            disabled={disabled}
          />
        </div>
        <div>
          <Label htmlFor={codeFieldId} className="mb-1.5 block text-xs">
            Metadata Code
          </Label>
          <MetadataField
            id={codeFieldId}
            typeCode={value.metadataTypeCode}
            typeLabel="Metadata"
            value={value.metadataCode}
            onValueChange={(metadataCode) => update({ metadataCode })}
            placeholder="Select metadata..."
            disabled={disabled || !value.metadataTypeCode}
            showCreateNew={false}
          />
        </div>
        <div>
          <Label htmlFor={weightId} className="mb-1.5 block text-xs">
            Weight (optional)
          </Label>
          <Input
            id={weightId}
            type="number"
            value={value.weight ?? ""}
            onChange={(e) =>
              update({ weight: e.target.value ? Number(e.target.value) : undefined })
            }
            placeholder="1"
            disabled={disabled}
            className="text-xs"
          />
        </div>
      </div>
    </div>
  );
});
