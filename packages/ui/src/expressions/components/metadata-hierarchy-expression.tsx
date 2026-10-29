/**
 * Metadata hierarchy expression components (event surface only).
 *
 * - `isMetadataType`  — the value at `path` is a metadata entry of a type
 *                       (optionally a specific code).
 * - `inMetadataGroup` — the value at `path` belongs to a metadata group.
 * - `isChildMetadata` — the value at `path` sits below a parent node in the
 *                       metadata hierarchy (e.g. a Store under Region WEST).
 *
 * Metadata types and entries are picked with the shared MetadataTypeField /
 * MetadataField, the same pickers the Tag Metadata action uses.
 */

import { memo, useCallback, useId, type ReactNode } from "react";
import { MetadataField } from "../../forms/metadata-field/index.js";
import { MetadataTypeField } from "../../forms/metadata-type-field/index.js";
import { Input } from "../../primitives/input.js";
import { Label } from "../../primitives/label.js";
import { Switch } from "../../primitives/switch.js";

import { JsonPathInput } from "../inputs/json-path-input";
import type {
  ExpressionComponentProps,
  InMetadataGroupExpression,
  IsChildMetadataExpression,
  IsMetadataTypeExpression,
} from "../types";

type IsMetadataTypeData = IsMetadataTypeExpression["isMetadataType"];
type InMetadataGroupData = InMetadataGroupExpression["inMetadataGroup"];
type IsChildMetadataData = IsChildMetadataExpression["isChildMetadata"];

function DisplayLine({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={className}>
      <span className="text-muted-foreground text-xs">{children}</span>
    </div>
  );
}

function TypeSelect({
  id,
  label,
  value,
  onChange,
  disabled,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (code: string) => void;
  disabled?: boolean;
}): ReactNode {
  return (
    <div>
      <Label htmlFor={id} className="mb-1.5 block text-xs">
        {label}
      </Label>
      <MetadataTypeField
        id={id}
        value={value}
        onValueChange={onChange}
        placeholder="Select metadata type..."
        disabled={disabled}
      />
    </div>
  );
}

function EntrySelect({
  id,
  label,
  typeCode,
  value,
  onChange,
  disabled,
}: {
  id: string;
  label: string;
  typeCode: string;
  value: string;
  onChange: (code: string) => void;
  disabled?: boolean;
}): ReactNode {
  return (
    <div>
      <Label htmlFor={id} className="mb-1.5 block text-xs">
        {label}
      </Label>
      <MetadataField
        id={id}
        typeCode={typeCode}
        typeLabel="Metadata"
        value={value}
        onValueChange={(code) => onChange(code)}
        placeholder="Select metadata..."
        disabled={disabled || !typeCode}
        showCreateNew={false}
      />
    </div>
  );
}

export const IsMetadataTypeExpressionComponent = memo(function IsMetadataTypeExpressionComponent({
  value,
  onChange,
  disabled,
  mode,
  className,
  presentation,
}: ExpressionComponentProps<IsMetadataTypeData>): ReactNode {
  const typeId = useId();
  const codeId = useId();
  const update = useCallback(
    (partial: Partial<IsMetadataTypeData>) => onChange({ ...value, ...partial }),
    [value, onChange]
  );

  if (mode === "display") {
    return (
      <DisplayLine className={className}>
        {value.metadataTypeCode || "(type not set)"}
        {value.metadataCode ? ` = ${value.metadataCode}` : ""}
      </DisplayLine>
    );
  }

  return (
    <div className={className}>
      <div className="space-y-3">
        <JsonPathInput
          value={value.path}
          onChange={(path) => update({ path })}
          label="Event data field holding the metadata code"
          placeholder="$.eventData.STORE"
          disabled={disabled}
          presentation={presentation}
        />
        <TypeSelect
          id={typeId}
          label="Metadata Type"
          value={value.metadataTypeCode}
          onChange={(metadataTypeCode) => update({ metadataTypeCode, metadataCode: "" })}
          disabled={disabled}
        />
        <EntrySelect
          id={codeId}
          label="Metadata Entry (optional)"
          typeCode={value.metadataTypeCode}
          value={value.metadataCode ?? ""}
          onChange={(metadataCode) => update({ metadataCode })}
          disabled={disabled}
        />
      </div>
    </div>
  );
});

export const InMetadataGroupExpressionComponent = memo(function InMetadataGroupExpressionComponent({
  value,
  onChange,
  disabled,
  mode,
  className,
  presentation,
}: ExpressionComponentProps<InMetadataGroupData>): ReactNode {
  const typeId = useId();
  const groupId = useId();
  const update = useCallback(
    (partial: Partial<InMetadataGroupData>) => onChange({ ...value, ...partial }),
    [value, onChange]
  );

  if (mode === "display") {
    return (
      <DisplayLine className={className}>
        {value.metadataTypeCode || "(type not set)"} in group{" "}
        {value.metadataGroupCode || "(not set)"}
      </DisplayLine>
    );
  }

  return (
    <div className={className}>
      <div className="space-y-3">
        <JsonPathInput
          value={value.path}
          onChange={(path) => update({ path })}
          label="Event data field holding the metadata code"
          placeholder="$.eventData.STORE"
          disabled={disabled}
          presentation={presentation}
        />
        <TypeSelect
          id={typeId}
          label="Metadata Type"
          value={value.metadataTypeCode}
          onChange={(metadataTypeCode) => update({ metadataTypeCode })}
          disabled={disabled}
        />
        <div>
          <Label htmlFor={groupId} className="mb-1.5 block text-xs">
            Metadata Group Code
          </Label>
          <Input
            id={groupId}
            value={value.metadataGroupCode}
            onChange={(e) => update({ metadataGroupCode: e.target.value })}
            placeholder="e.g. FLAGSHIPS"
            disabled={disabled}
            className="text-xs"
          />
        </div>
      </div>
    </div>
  );
});

export const IsChildMetadataExpressionComponent = memo(function IsChildMetadataExpressionComponent({
  value,
  onChange,
  disabled,
  mode,
  className,
  presentation,
}: ExpressionComponentProps<IsChildMetadataData>): ReactNode {
  const typeId = useId();
  const parentTypeId = useId();
  const parentCodeId = useId();
  const update = useCallback(
    (partial: Partial<IsChildMetadataData>) => onChange({ ...value, ...partial }),
    [value, onChange]
  );

  if (mode === "display") {
    return (
      <DisplayLine className={className}>
        {value.metadataTypeCode || "(type not set)"} {value.directOnly ? "directly under" : "under"}{" "}
        {value.parentTypeCode || "(type not set)"} {value.parentCode || "(not set)"}
      </DisplayLine>
    );
  }

  return (
    <div className={className}>
      <div className="space-y-3">
        <JsonPathInput
          value={value.path}
          onChange={(path) => update({ path })}
          label="Event data field holding the metadata code"
          placeholder="$.eventData.STORE"
          disabled={disabled}
          presentation={presentation}
        />
        <TypeSelect
          id={typeId}
          label="Metadata Type"
          value={value.metadataTypeCode}
          onChange={(metadataTypeCode) => update({ metadataTypeCode })}
          disabled={disabled}
        />
        <TypeSelect
          id={parentTypeId}
          label="Parent Metadata Type"
          value={value.parentTypeCode}
          onChange={(parentTypeCode) => update({ parentTypeCode, parentCode: "" })}
          disabled={disabled}
        />
        <EntrySelect
          id={parentCodeId}
          label="Parent Metadata Entry"
          typeCode={value.parentTypeCode}
          value={value.parentCode}
          onChange={(parentCode) => update({ parentCode })}
          disabled={disabled}
        />
        <label className="flex min-h-11 items-center gap-2">
          <Switch
            checked={value.directOnly ?? false}
            onCheckedChange={(directOnly) => update({ directOnly })}
            disabled={disabled}
          />
          <span className="text-xs">Direct children only</span>
        </label>
      </div>
    </div>
  );
});
