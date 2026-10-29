/**
 * AudienceFormSheet - Sheet component for creating/editing Audiences
 *
 * Wraps FormSheet with audience-specific form fields and logic.
 * Supports type-specific configuration for CustomerList, ClickHouse, and THREADS.
 * Uses CodeInput for code auto-generation.
 * Uses LocalizedStringInput for multi-language description support.
 */

import { useState, type FormEvent, type ReactNode } from "react";
import { normalizeExpression } from "../../../expressions/migrate.js";
import type { Expression } from "../../../expressions/types.js";
import { CodeInput, useCodeInput } from "../../../forms/code-input.js";
import { WithFieldError } from "../../../forms/field-errors.js";
import { FormSheet } from "../../../forms/form-sheet.js";
import {
  LocalizedStringInput,
  type LocalizedString,
} from "../../../forms/localized-string-input.js";
import { Input } from "../../../primitives/input.js";
import { Label } from "../../../primitives/label.js";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../primitives/select.js";
import { Switch } from "../../../primitives/switch.js";
import { extractExtendedFields } from "../../entity-field-utils.js";
import { ExtendedFieldsSection } from "../../extended-fields-section.js";
import type { AudienceFormData } from "./types.js";
import {
  isThreadsSegment,
  type AudienceFormSheetProps,
  type CustomerAudienceType,
  type SegmentEngine,
} from "./types.js";
import { engineDescriptions } from "./utils.js";

type AudienceTypeOption = "CUSTOMER_LIST" | "EXPRESSION" | "THREADS";

/**
 * Map the combined type option to the type/engine tuple
 */
function parseTypeOption(option: AudienceTypeOption): {
  type: CustomerAudienceType;
  engine?: SegmentEngine;
} {
  switch (option) {
    case "CUSTOMER_LIST":
      return { type: "CUSTOMER_LIST" };
    case "EXPRESSION":
      return { type: "CUSTOMER_SEGMENT", engine: "CLICKHOUSE" };
    case "THREADS":
      return { type: "CUSTOMER_SEGMENT", engine: "THREADS" };
  }
}

/**
 * Derive the combined type option from type/engine
 */
function deriveTypeOption(type?: CustomerAudienceType, engine?: SegmentEngine): AudienceTypeOption {
  if (type === "CUSTOMER_SEGMENT" && engine === "THREADS") return "THREADS";
  if (type === "CUSTOMER_SEGMENT") return "EXPRESSION";
  return "CUSTOMER_LIST";
}

/**
 * Sheet component for creating and editing Audiences.
 *
 * @example
 * ```tsx
 * // Create mode
 * <AudienceFormSheet
 *   open={createOpen}
 *   onOpenChange={setCreateOpen}
 *   mode="create"
 *   onSubmit={handleCreate}
 *   isSubmitting={createMutation.isPending}
 * />
 *
 * // Edit mode
 * <AudienceFormSheet
 *   open={editOpen}
 *   onOpenChange={setEditOpen}
 *   mode="edit"
 *   initialData={selectedAudience}
 *   onSubmit={handleUpdate}
 *   isSubmitting={updateMutation.isPending}
 * />
 * ```
 */
export function AudienceFormSheet({
  open,
  onOpenChange,
  mode,
  initialData,
  onSubmit,
  isSubmitting = false,
  error,
  fieldErrors,
  renderSegmentBuilder,
  schema,
  extendedFields = [],
}: AudienceFormSheetProps): ReactNode {
  // Derive initial engine from segment data
  const initialEngine = initialData?.type === "CUSTOMER_SEGMENT" ? initialData.engine : undefined;

  // Form state
  const [name, setName] = useState(initialData?.name ?? "");
  const [typeOption, setTypeOption] = useState<AudienceTypeOption>(() =>
    deriveTypeOption(initialData?.type, initialEngine)
  );
  const [description, setDescription] = useState<LocalizedString>(() => {
    if (initialData?.description && typeof initialData.description === "object") {
      return initialData.description;
    }
    return {};
  });
  const [triggerOnEnter, setTriggerOnEnter] = useState(initialData?.triggerOnEnter ?? false);
  const [triggerOnExit, setTriggerOnExit] = useState(initialData?.triggerOnExit ?? false);

  // Segment expression state (for Customer Segment type). Gate on "not THREADS"
  // rather than "is CLICKHOUSE", matching deriveTypeOption's own logic above:
  // `engine` isn't a real backend field yet (no CustomerSegment in the OpenAPI
  // contract or the Java domain model declares it), so it's never actually
  // "CLICKHOUSE" for a real segment -- gating on that literal value meant this
  // state silently stayed null for every real segment even once its
  // segmentExpression was correctly hydrated into initialData.
  const isExpressionEngine = (engine?: SegmentEngine) => engine !== "THREADS";
  const [segmentExpression, setSegmentExpression] = useState<Expression | null>(() => {
    if (initialData?.type === "CUSTOMER_SEGMENT" && isExpressionEngine(initialData.engine)) {
      return initialData.segmentExpression
        ? normalizeExpression(initialData.segmentExpression)
        : null;
    }
    return null;
  });

  // The RAW persisted segment expression (pre-normalize). The builder edits the
  // normalized copy above; the migration notice must detect on this raw tree,
  // since normalize deletes some corrupt fields before they can be surfaced.
  const rawSegmentExpression: Expression | null =
    initialData?.type === "CUSTOMER_SEGMENT" && isExpressionEngine(initialData.engine)
      ? (initialData.segmentExpression ?? null)
      : null;

  // Mirrors SegmentExpressionPanel's own isValid (reported via onValidityChange)
  // so the OUTER Save button is blocked whenever the current expression is
  // invalid, not only the nested modal's own Save (R2a/R2b) — closes the gap
  // where touching only an unrelated field (e.g. Trigger On Enter) could save
  // an audience carrying an already-invalid persisted expression. Defaults to
  // true (not blocking): CUSTOMER_LIST/THREADS never report through this
  // channel, and EXPRESSION corrects it via the panel's mount effect before
  // Save is reachable. submitDisabled below also gates this on typeOption ===
  // "EXPRESSION" explicitly -- this state only resets on sheet close (resetForm),
  // not on switching typeOption away from EXPRESSION mid-session, so a stale
  // `false` from an earlier EXPRESSION visit must not block Save once the user
  // has moved to a type where it no longer applies (fail-closed otherwise, not a
  // security issue, but a real stuck-Save bug -- code review finding).
  const [segmentExpressionValid, setSegmentExpressionValid] = useState(true);

  // THREADS config fields
  const [seedBehaviors, setSeedBehaviors] = useState(() => {
    if (initialData && isThreadsSegment(initialData)) {
      return initialData.engineConfig.seedBehaviors?.join(", ") ?? "";
    }
    return "";
  });
  const [targetSizeHint, setTargetSizeHint] = useState(() => {
    if (initialData && isThreadsSegment(initialData)) {
      return initialData.engineConfig.targetSizeHint?.toString() ?? "";
    }
    return "";
  });

  // Code auto-generation using useCodeInput hook
  const codeInput = useCodeInput(name, {
    pattern: "resource",
    format: "kebab-case",
    initialValue: initialData?.code,
    locked: mode === "edit",
  });

  // Tenant-extension field values (top-level custom fields from the data model).
  const [extendedFieldValues, setExtendedFieldValues] = useState<Record<string, unknown>>(() =>
    extractExtendedFields(initialData, extendedFields)
  );
  const handleExtendedFieldChange = (field: string, value: unknown) => {
    setExtendedFieldValues((prev) => ({ ...prev, [field]: value }));
  };

  // Reset form when sheet opens/closes or initialData changes
  const resetForm = () => {
    const resetEngine = initialData?.type === "CUSTOMER_SEGMENT" ? initialData.engine : undefined;

    setName(initialData?.name ?? "");
    setTypeOption(deriveTypeOption(initialData?.type, resetEngine));
    setDescription(
      initialData?.description && typeof initialData.description === "object"
        ? initialData.description
        : {}
    );
    setTriggerOnEnter(initialData?.triggerOnEnter ?? false);
    setTriggerOnExit(initialData?.triggerOnExit ?? false);
    codeInput.reset();

    // Reset expression state
    if (initialData?.type === "CUSTOMER_SEGMENT" && isExpressionEngine(initialData.engine)) {
      setSegmentExpression(
        initialData.segmentExpression ? normalizeExpression(initialData.segmentExpression) : null
      );
    } else {
      setSegmentExpression(null);
    }
    // The panel re-reports its real validity on its next mount effect; reset
    // to the non-blocking default in the meantime so a stale value from a
    // previous session can't linger.
    setSegmentExpressionValid(true);

    // Reset THREADS fields
    if (initialData && isThreadsSegment(initialData)) {
      setSeedBehaviors(initialData.engineConfig.seedBehaviors?.join(", ") ?? "");
      setTargetSizeHint(initialData.engineConfig.targetSizeHint?.toString() ?? "");
    } else {
      setSeedBehaviors("");
      setTargetSizeHint("");
    }

    setExtendedFieldValues(extractExtendedFields(initialData, extendedFields));
  };

  // Handle open change with form reset
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      resetForm();
    }
    onOpenChange(newOpen);
  };

  // Handle submit - build AudienceFormData from form state
  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const { type, engine } = parseTypeOption(typeOption);

    // Only include description if it has content
    const hasDescription = Object.values(description).some((v) => v.trim() !== "");

    const formData: AudienceFormData = {
      name,
      code: codeInput.value,
      description: hasDescription ? description : {},
      type,
      triggerOnEnter,
      triggerOnExit,
      engine,
    };

    // Set expression for Customer Segment type
    if (typeOption === "EXPRESSION") {
      formData.segmentExpression = segmentExpression;
    }

    if (typeOption === "THREADS") {
      const behaviors = seedBehaviors
        .split(",")
        .map((s: string) => s.trim())
        .filter(Boolean);
      formData.engineConfig = {
        seedBehaviors: behaviors.length > 0 ? behaviors : undefined,
        targetSizeHint: targetSizeHint ? Number(targetSizeHint) : undefined,
      };
    }

    // Extended (tenant) fields ride at the top level. Spread last (after the
    // typed fields) so they win on any name collision, matching offer/tier. In
    // practice extended fields are the complement of the standard set, so no
    // collision occurs.
    await onSubmit({ ...formData, ...extendedFieldValues });
  };

  const handleCancel = () => {
    handleOpenChange(false);
  };

  const title = mode === "create" ? "Create Audience" : `Edit ${initialData?.name ?? "Audience"}`;
  const submitLabel = mode === "create" ? "Create Audience" : "Save Changes";

  return (
    <FormSheet
      open={open}
      onOpenChange={handleOpenChange}
      title={title}
      onSubmit={handleSubmit}
      submitDisabled={
        codeInput.error != null || (typeOption === "EXPRESSION" && !segmentExpressionValid)
      }
      onCancel={handleCancel}
      isSubmitting={isSubmitting}
      submitLabel={submitLabel}
      error={error}
      fieldErrors={fieldErrors}
    >
      <div className="space-y-6">
        {/* Type selector */}
        <div className="space-y-2">
          <Label htmlFor="audience-type">
            Audience Type <span className="text-destructive">*</span>
          </Label>
          <WithFieldError field="type" value={typeOption}>
            {(fe) => (
              <Select
                value={typeOption}
                onValueChange={(value: string) => {
                  const next = value as AudienceTypeOption;
                  setTypeOption(next);
                  // The segment builder is about to unmount (its render is gated on
                  // typeOption === "EXPRESSION") and can no longer self-correct via its
                  // own mount effect -- reset to the non-blocking default so a stale
                  // `false` from a previous EXPRESSION selection can't linger and block
                  // Save for a type that never uses segmentExpression (code review
                  // finding; submitDisabled below also gates on typeOption directly as
                  // a second, independent safeguard for the same case).
                  if (next !== "EXPRESSION") setSegmentExpressionValid(true);
                }}
                disabled={isSubmitting || mode === "edit"}
              >
                <SelectTrigger
                  {...fe.inputProps}
                  id="audience-type"
                  data-widget="select"
                  data-discriminator="true"
                >
                  <SelectValue placeholder="Select audience type..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CUSTOMER_LIST">Customer List</SelectItem>
                  <SelectItem value="EXPRESSION">Customer Segment</SelectItem>
                  <SelectItem value="THREADS">THREADS Segment</SelectItem>
                </SelectContent>
              </Select>
            )}
          </WithFieldError>
          {typeOption === "EXPRESSION" && (
            <p className="text-muted-foreground text-xs">
              Build conditions to define which customers belong to this segment.
            </p>
          )}
          {typeOption === "THREADS" && (
            <p className="text-muted-foreground text-xs">{engineDescriptions.THREADS}</p>
          )}
        </div>

        {/* Name field */}
        <div className="space-y-2">
          <Label htmlFor="audience-name">
            Name <span className="text-destructive">*</span>
          </Label>
          <WithFieldError field="name">
            {(fe) => (
              <Input
                {...fe.inputProps}
                id="audience-name"
                data-widget="text-input"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter audience name"
                required
                disabled={isSubmitting}
              />
            )}
          </WithFieldError>
        </div>

        {/* Code field with auto-generation */}
        <div className="space-y-2">
          <Label htmlFor="audience-code">
            Code <span className="text-destructive">*</span>
          </Label>
          <WithFieldError field="code" hideMessage>
            {(fe) => (
              <CodeInput
                data-field={fe.inputProps["data-field"]}
                id="audience-code"
                sourceValue={name}
                value={codeInput.value}
                onChange={codeInput.onChange}
                error={fe.error ?? codeInput.error}
                format="kebab-case"
                placeholder="audience-code"
                required
                disabled={isSubmitting || mode === "edit"}
                showReset={mode === "create"}
              />
            )}
          </WithFieldError>
          {mode === "create" && (
            <p className="text-muted-foreground text-xs">
              Auto-generated from name. Edit to customize.
            </p>
          )}
        </div>

        {/* Description with LocalizedStringInput */}
        <div className="space-y-2">
          <Label htmlFor="audience-description">Description</Label>
          <WithFieldError field="description" value={description}>
            {(fe) => (
              <LocalizedStringInput
                {...fe.inputProps}
                id="audience-description"
                value={description}
                onChange={setDescription}
                placeholder="Describe the audience criteria and purpose"
                multiline
                disabled={isSubmitting}
              />
            )}
          </WithFieldError>
          <p className="text-muted-foreground text-xs">
            Multi-language description of the audience. Add translations as needed.
          </p>
        </div>

        {/* Membership event triggers */}
        <div className="space-y-4">
          <h4 className="text-foreground text-sm font-medium">Membership Events</h4>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label htmlFor="audience-trigger-on-enter" className="text-sm font-medium">
                Trigger On Enter
              </Label>
              <p className="text-muted-foreground text-xs">
                Fire a membership-entered event when a customer joins this audience.
              </p>
            </div>
            <Switch
              id="audience-trigger-on-enter"
              checked={triggerOnEnter}
              onCheckedChange={setTriggerOnEnter}
              disabled={isSubmitting}
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label htmlFor="audience-trigger-on-exit" className="text-sm font-medium">
                Trigger On Exit
              </Label>
              <p className="text-muted-foreground text-xs">
                Fire a membership-exited event when a customer leaves this audience.
              </p>
            </div>
            <Switch
              id="audience-trigger-on-exit"
              checked={triggerOnExit}
              onCheckedChange={setTriggerOnExit}
              disabled={isSubmitting}
            />
          </div>
        </div>

        {/* Customer Segment expression builder */}
        {typeOption === "EXPRESSION" && (
          <div className="space-y-2">
            <Label htmlFor="segment-expression-builder">Segment Expression</Label>
            <p className="text-muted-foreground text-sm">
              Define conditions to determine which customers belong to this segment.
            </p>
            {renderSegmentBuilder ? (
              <div id="segment-expression-builder">
                {renderSegmentBuilder({
                  expression: segmentExpression,
                  onChange: setSegmentExpression,
                  disabled: isSubmitting,
                  rawExpression: rawSegmentExpression,
                  onValidityChange: setSegmentExpressionValid,
                })}
              </div>
            ) : (
              <p className="text-muted-foreground text-xs">Expression builder not available.</p>
            )}
          </div>
        )}

        {/* THREADS config fields */}
        {typeOption === "THREADS" && (
          <div className="space-y-4">
            <h4 className="text-foreground text-sm font-medium">AI Configuration</h4>

            <div className="space-y-2">
              <Label htmlFor="audience-behaviors">Seed Behaviors</Label>
              <WithFieldError field="engineConfig.seedBehaviors">
                {(fe) => (
                  <Input
                    {...fe.inputProps}
                    id="audience-behaviors"
                    data-widget="text-input"
                    type="text"
                    value={seedBehaviors}
                    onChange={(e) => setSeedBehaviors(e.target.value)}
                    placeholder="purchase, browse, wishlist"
                    disabled={isSubmitting}
                  />
                )}
              </WithFieldError>
              <p className="text-muted-foreground text-xs">
                Comma-separated behavior tags to seed AI clustering.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="audience-target-size">Target Size Hint</Label>
              <WithFieldError field="engineConfig.targetSizeHint">
                {(fe) => (
                  <Input
                    {...fe.inputProps}
                    id="audience-target-size"
                    data-widget="text-input"
                    type="number"
                    value={targetSizeHint}
                    onChange={(e) => setTargetSizeHint(e.target.value)}
                    placeholder="1000"
                    min={0}
                    disabled={isSubmitting}
                  />
                )}
              </WithFieldError>
              <p className="text-muted-foreground text-xs">
                Approximate target number of members for the AI segment.
              </p>
            </div>
          </div>
        )}

        {/* Extended Fields Section (tenant data-model extensions) */}
        {schema && extendedFields.length > 0 && (
          <ExtendedFieldsSection
            schema={schema}
            fields={extendedFields}
            data={extendedFieldValues}
            mode="edit"
            onChange={handleExtendedFieldChange}
            title="Additional Information"
            defaultCollapsed={false}
          />
        )}
      </div>
    </FormSheet>
  );
}
