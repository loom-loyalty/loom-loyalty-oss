/**
 * ElementDialog
 *
 * Sub-dialog for adding or editing a single DataModelElement.
 *
 * Rendered on top of the DataModelFormSheet — clicking an element row in the
 * sheet opens this dialog with all 15+ fields organized into sections:
 * Identity, Type, Validation, Visibility, and Metadata Reference.
 *
 * Auto-generates `inputAttribute` from `name` (camelCase) until the user
 * manually edits the inputAttribute field.
 */

import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { cn } from "../../../lib/utils.js";
import { Button } from "../../../primitives/button.js";
import { Checkbox } from "../../../primitives/checkbox.js";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../../primitives/dialog.js";
import { Input } from "../../../primitives/input.js";
import { Label } from "../../../primitives/label.js";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../primitives/select.js";
import { dataModelCodeKey, sameDataModelCode } from "./code-key.js";
import { Section } from "./detail/section.js";
import { MetricRoleSelect } from "./metric-role-select.js";
import {
  isMetricRoleEligibleType,
  nameToInputAttribute,
  type DataModelElementFormData,
  type ElementDialogProps,
} from "./types.js";

const EMPTY_FORM: DataModelElementFormData = {
  name: "",
  inputAttribute: "",
  outputAttribute: "",
  typeCode: "STRING",
  isArray: false,
  required: false,
  sensitive: false,
  inputOnly: false,
  outputOnly: false,
  createOnly: false,
  metadataTypeCategory: "",
  metadataType: "",
  metricRole: undefined,
};

export const PRIMITIVE_TYPE_CODES = [
  "STRING",
  "INTEGER",
  "NUMBER",
  "BOOLEAN",
  "DATE",
  "DATE_TIME",
  "UUID",
  "LOCALIZED_STRING",
  "ANY",
] as const;

export function ElementDialog({
  open,
  onOpenChange,
  mode,
  initialData,
  availableTypes,
  onSubmit,
  error,
}: ElementDialogProps): ReactNode {
  const [form, setForm] = useState<DataModelElementFormData>(initialData ?? EMPTY_FORM);
  const [inputAttrManuallyEdited, setInputAttrManuallyEdited] = useState(mode === "edit");
  const [validationError, setValidationError] = useState<string | null>(null);

  // Reset form whenever the dialog opens (recommended pattern: adjust state during
  // render instead of in a useEffect, per https://react.dev/reference/react/useState#storing-information-from-previous-renders)
  const [prevOpen, setPrevOpen] = useState(open);
  if (open && !prevOpen) {
    setPrevOpen(true);
    setForm(initialData ?? EMPTY_FORM);
    setInputAttrManuallyEdited(mode === "edit");
    setValidationError(null);
  } else if (!open && prevOpen) {
    setPrevOpen(false);
  }

  // Build merged type options: primitives + system types + custom types
  const typeOptions = useMemo(() => {
    const seen = new Set<string>();
    const options: { code: string; label: string; group: "primitive" | "system" | "custom" }[] = [];

    // Always show primitives
    for (const code of PRIMITIVE_TYPE_CODES) {
      seen.add(dataModelCodeKey(code));
      options.push({ code, label: code, group: "primitive" });
    }

    // Add available types from API (excluding ones already seen). Dedupe on the
    // folded key: once the platform returns `string` for a primitive system type,
    // an exact-match `seen` would list both `STRING` and `string`.
    if (availableTypes) {
      for (const type of availableTypes) {
        if (!type.code || seen.has(dataModelCodeKey(type.code))) continue;
        seen.add(dataModelCodeKey(type.code));
        const group: "primitive" | "system" | "custom" = type.primitive
          ? "primitive"
          : type.system
            ? "system"
            : "custom";
        options.push({
          code: type.code,
          label: `${type.name} (${type.code})`,
          group,
        });
      }
    }

    return options;
  }, [availableTypes]);

  // Folded: `typeCode` here can be an API-sourced system code, and system
  // DataModelType codes are being lowercased by the resource-code convention.
  // A bare `=== "METADATA"` silently stops collecting
  // the metadata fields once the platform returns `metadata`.
  const isMetadataType = sameDataModelCode(form.typeCode, "METADATA");
  const isMetricRoleEligible = isMetricRoleEligibleType(form.typeCode);

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setValidationError(null);

    // Minimal client-side validation
    const trimmedName = form.name.trim();
    if (!trimmedName) {
      setValidationError("Name is required.");
      return;
    }

    const inputAttr = (form.inputAttribute || "").trim();
    if (!inputAttr) {
      setValidationError("Input attribute is required.");
      return;
    }

    if (!form.typeCode.trim()) {
      setValidationError("Type is required.");
      return;
    }

    // outputAttribute defaults to inputAttribute if not provided
    const outputAttr = (form.outputAttribute || "").trim() || inputAttr;

    onSubmit({
      ...form,
      name: trimmedName,
      inputAttribute: inputAttr,
      outputAttribute: outputAttr,
      // Strip empty metadata fields when type isn't METADATA
      metadataTypeCategory: isMetadataType
        ? (form.metadataTypeCategory || "").trim() || undefined
        : undefined,
      metadataType: isMetadataType ? (form.metadataType || "").trim() || undefined : undefined,
      // Clear metricRole if the user picked a role, then switched away from a numeric type.
      metricRole: isMetricRoleEligible ? form.metricRole : undefined,
    });
  };

  const update = <K extends keyof DataModelElementFormData>(
    key: K,
    value: DataModelElementFormData[K]
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  // Handle name changes — also derive inputAttribute in create mode until user edits it.
  // Combining both updates in the onChange handler avoids a set-state-in-effect chain.
  const handleNameChange = (name: string) => {
    setForm((prev) => {
      const next = { ...prev, name };
      if (mode === "create" && !inputAttrManuallyEdited) {
        next.inputAttribute = nameToInputAttribute(name);
      }
      return next;
    });
  };

  const title = mode === "create" ? "Add Element" : `Edit ${initialData?.name ?? "Element"}`;
  const submitLabel = mode === "create" ? "Add Element" : "Save Changes";
  const displayError = error ?? validationError;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Define a single field within this data model. Required fields are marked with{" "}
            <span className="text-destructive">*</span>.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 py-2">
          {/* Identity Section */}
          <Section title="Identity" bodyClassName="space-y-3 pl-1">
            <div className="space-y-2">
              <Label htmlFor="el-name">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="el-name"
                value={form.name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="Email Address"
                required
                autoFocus={mode === "create"}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="el-input-attr">
                  Input Attribute <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="el-input-attr"
                  value={form.inputAttribute ?? ""}
                  onChange={(e) => {
                    setInputAttrManuallyEdited(true);
                    update("inputAttribute", e.target.value);
                  }}
                  placeholder="emailAddress"
                  className="font-mono text-sm"
                  required
                />
                <p className="text-muted-foreground text-xs">
                  {mode === "create" && !inputAttrManuallyEdited
                    ? "Auto-generated from name."
                    : "camelCase identifier for input."}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="el-output-attr">Output Attribute</Label>
                <Input
                  id="el-output-attr"
                  value={form.outputAttribute ?? ""}
                  onChange={(e) => update("outputAttribute", e.target.value)}
                  placeholder="(defaults to input attribute)"
                  className="font-mono text-sm"
                />
              </div>
            </div>
          </Section>

          {/* Type Section */}
          <Section title="Type" bodyClassName="space-y-3 pl-1">
            <div className="space-y-2">
              <Label htmlFor="el-type">
                Type <span className="text-destructive">*</span>
              </Label>
              <Select value={form.typeCode} onValueChange={(value) => update("typeCode", value)}>
                <SelectTrigger id="el-type" className="font-mono">
                  <SelectValue placeholder="Select a type..." />
                </SelectTrigger>
                <SelectContent>
                  {typeOptions.map((opt) => (
                    <SelectItem key={opt.code} value={opt.code} className="font-mono">
                      <span>{opt.label}</span>
                      <span className="text-muted-foreground ml-2 text-xs">{opt.group}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <CheckboxRow
              id="el-is-array"
              label="Is Array"
              description="Element holds a list of values."
              checked={form.isArray ?? false}
              onCheckedChange={(checked) => update("isArray", checked)}
            />
          </Section>

          {/* Metric Role Section */}
          <Section title="Metric Role" bodyClassName="space-y-3 pl-1">
            <div className="space-y-2">
              <Label htmlFor="el-metric-role">Metric Role</Label>
              <MetricRoleSelect
                id="el-metric-role"
                value={form.metricRole}
                disabled={!isMetricRoleEligible}
                onChange={(value) => update("metricRole", value)}
                describedById="el-metric-role-help"
              />
              <p id="el-metric-role-help" className="text-muted-foreground text-xs">
                {isMetricRoleEligible
                  ? "Tag the attribute that holds this customer's spend so revenue analytics can read it. Requires a value-based earn rule that reads this field."
                  : "Metric roles apply to numeric attributes only."}
              </p>
            </div>
          </Section>

          {/* Validation Section */}
          <Section title="Validation" bodyClassName="space-y-3 pl-1">
            <CheckboxRow
              id="el-required"
              label="Required"
              description="Field must be present in input."
              checked={form.required ?? false}
              onCheckedChange={(checked) => update("required", checked)}
            />
            <CheckboxRow
              id="el-sensitive"
              label="Sensitive"
              description="Contains PII, credentials, or other sensitive data."
              checked={form.sensitive ?? false}
              onCheckedChange={(checked) => update("sensitive", checked)}
            />
          </Section>

          {/* Visibility Section */}
          <Section title="Visibility" bodyClassName="space-y-3 pl-1">
            <CheckboxRow
              id="el-input-only"
              label="Input Only"
              description="Accept on create/update, never return on read."
              checked={form.inputOnly ?? false}
              onCheckedChange={(checked) => update("inputOnly", checked)}
            />
            <CheckboxRow
              id="el-output-only"
              label="Output Only"
              description="Returned on read, never accepted on input."
              checked={form.outputOnly ?? false}
              onCheckedChange={(checked) => update("outputOnly", checked)}
            />
            <CheckboxRow
              id="el-create-only"
              label="Create Only"
              description="Settable on create, immutable thereafter."
              checked={form.createOnly ?? false}
              onCheckedChange={(checked) => update("createOnly", checked)}
            />
          </Section>

          {/* Metadata Reference Section (conditional) */}
          {isMetadataType && (
            <Section
              title="Metadata Reference"
              description="Required when type is METADATA. Specifies which metadata category and type this element references."
              bodyClassName="space-y-3 pl-1"
            >
              <div className="space-y-2">
                <Label htmlFor="el-meta-category">Metadata Category</Label>
                <Input
                  id="el-meta-category"
                  value={form.metadataTypeCategory ?? ""}
                  onChange={(e) => update("metadataTypeCategory", e.target.value)}
                  placeholder="e.g., LOCATION"
                  className="font-mono text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="el-meta-type">Metadata Type</Label>
                <Input
                  id="el-meta-type"
                  value={form.metadataType ?? ""}
                  onChange={(e) => update("metadataType", e.target.value)}
                  placeholder="e.g., COUNTRY"
                  className="font-mono text-sm"
                />
              </div>
            </Section>
          )}

          {displayError && (
            <div
              className="border-destructive/30 bg-destructive/5 rounded-md border p-3"
              role="alert"
            >
              <p className="text-destructive text-sm">{displayError}</p>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary-gradient">
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface CheckboxRowProps {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}

function CheckboxRow({
  id,
  label,
  description,
  checked,
  onCheckedChange,
}: CheckboxRowProps): ReactNode {
  return (
    <div className={cn("border-border/60 flex items-start gap-3 rounded-md border p-3")}>
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(value) => onCheckedChange(value === true)}
        className="mt-0.5"
      />
      <div className="flex-1 space-y-0.5">
        <Label htmlFor={id} className="cursor-pointer text-sm font-medium">
          {label}
        </Label>
        <p className="text-muted-foreground text-xs">{description}</p>
      </div>
    </div>
  );
}
