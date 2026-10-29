/**
 * TargetFormSheet - Polymorphic sheet component for creating/editing Targets
 *
 * Wraps FormSheet with target-specific form fields and logic.
 * Uses a type picker at the top to conditionally render type-specific fields.
 * Supports all 4 target types: COMPLETION, COUNTER, MILESTONE, X_OF_Y.
 *
 * Type-specific sections render in bg-muted/50 styled card containers.
 * Counter advanced features (cycles, growth) use collapsible sections.
 * Milestone steps support manual reordering.
 */

import type {
  CompletionTarget,
  CounterTarget,
  CreateCompletionTarget,
  CreateCounterTarget,
  CreateMilestoneTarget,
  CreateTarget,
  CreateXOfYTarget,
  MilestoneTarget,
  MilestoneTargetItem,
  ResponseTargetData,
  XOfYTarget,
} from "@loom-loyalty/sdk";
import { ArrowDown, ArrowUp, ChevronDown, Plus, X } from "lucide-react";
import { useCallback, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { CodeInput, useCodeInput } from "../../../forms/code-input.js";
import { DiscriminatorRadioGroup } from "../../../forms/discriminator-radio-group.js";
import { WithFieldError } from "../../../forms/field-errors.js";
import { FormSheet } from "../../../forms/form-sheet.js";
import {
  LocalizedStringInput,
  type LocalizedString,
} from "../../../forms/localized-string-input.js";
import { MetadataField, useMetadataField } from "../../../forms/metadata-field/index.js";
import { ProgramMultiField } from "../../../forms/program-field/index.js";
import { cn } from "../../../lib/utils.js";
import { Badge } from "../../../primitives/badge.js";
import { Button } from "../../../primitives/button.js";
import { Checkbox } from "../../../primitives/checkbox.js";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "../../../primitives/command.js";
import { Input } from "../../../primitives/input.js";
import { Label } from "../../../primitives/label.js";
import { Popover, PopoverContent, PopoverTrigger } from "../../../primitives/popover.js";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../primitives/select.js";
import { extractExtendedFields } from "../../entity-field-utils.js";
import { ExtendedFieldsSection } from "../../extended-fields-section.js";
import {
  GROWTH_ALGORITHM_OPTIONS,
  GROWTH_OPERATOR_OPTIONS,
  TARGET_SCOPE_OPTIONS,
  TARGET_TYPE_LABELS,
  TARGET_TYPE_OPTIONS,
  type TargetFormSheetProps,
} from "./types.js";

// ============================================================
// Helpers
// ============================================================

function getLocalizedDescription(
  description?: Record<string, unknown>
): LocalizedString | undefined {
  if (!description) return undefined;
  const result: LocalizedString = {};
  for (const [key, value] of Object.entries(description)) {
    if (typeof value === "string") {
      result[key] = value;
    }
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

/**
 * Extract the type-specific metadata type code from initial data
 */
function getInitialTypeCode(data: ResponseTargetData | undefined, targetType: string): string {
  if (!data) return "";
  switch (targetType) {
    case "COMPLETION": {
      const ct = data as CompletionTarget;
      return ct.completionTargetType?.code ?? "";
    }
    case "COUNTER": {
      const ct = data as CounterTarget;
      return ct.counterTargetType?.code ?? "";
    }
    case "MILESTONE": {
      const mt = data as MilestoneTarget;
      return mt.milestoneTargetType?.code ?? "";
    }
    case "X_OF_Y": {
      const xt = data as XOfYTarget;
      return xt.xofYTargetType?.code ?? "";
    }
    default:
      return "";
  }
}

// Metadata type code mapping per target type
const METADATA_TYPE_CODE_MAP: Record<string, string> = {
  COMPLETION: "COMPLETION_TARGET_TYPE",
  COUNTER: "COUNTER_TARGET_TYPE",
  MILESTONE: "MILESTONE_TARGET_TYPE",
  X_OF_Y: "X_OF_Y_TARGET_TYPE",
};

// ============================================================
// Form Sheet Component
// ============================================================

export function TargetFormSheet({
  open,
  onOpenChange,
  mode,
  initialData,
  onSubmit,
  isSubmitting = false,
  error,
  fieldErrors,
  schema,
  extendedFields = [],
  allTargets = [],
  allTargetsLoading = false,
  allTargetsError = false,
  lockCode = false,
}: TargetFormSheetProps): ReactNode {
  const [formError, setFormError] = useState<string | null>(null);

  // Base form state
  const initialType = initialData ? (initialData as unknown as { type: string }).type : "";
  const [name, setName] = useState(initialData?.name ?? "");
  const [programIds, setProgramIds] = useState<string[]>(initialData?.programIds ?? []);
  const [description, setDescription] = useState<LocalizedString>(
    () => getLocalizedDescription(initialData?.description) ?? {}
  );
  const [targetType, setTargetType] = useState(initialType);
  const [scope, setScope] = useState(
    (initialData as unknown as { scope: string } | undefined)?.scope ?? "GLOBAL"
  );

  // Completion state
  const [completionTypeCode, setCompletionTypeCode] = useState(
    getInitialTypeCode(initialData, "COMPLETION")
  );
  const [completionTypeIsSuggested, setCompletionTypeIsSuggested] = useState(false);

  // Counter state
  const [counterTypeCode, setCounterTypeCode] = useState(
    getInitialTypeCode(initialData, "COUNTER")
  );
  const [counterTypeIsSuggested, setCounterTypeIsSuggested] = useState(false);
  const initCounter =
    initialData && initialType === "COUNTER" ? (initialData as CounterTarget) : undefined;
  const [targetValue, setTargetValue] = useState<number | undefined>(initCounter?.targetValue);
  const [cappingTarget, setCappingTarget] = useState(initCounter?.cappingTarget ?? false);
  const [numberOfCycles, setNumberOfCycles] = useState<number | undefined>(
    initCounter?.numberOfCycles
  );
  const [numberOfCyclesToAchieve, setNumberOfCyclesToAchieve] = useState<number | undefined>(
    initCounter?.numberOfCyclesToAchieve
  );
  const [cyclesMustBeConsecutive, setCyclesMustBeConsecutive] = useState(
    initCounter?.cyclesMustBeConsecutive ?? false
  );
  const [carryOverToNextCycle, setCarryOverToNextCycle] = useState(
    initCounter?.carryOverToNextCycle ?? false
  );
  const [growthOperator, setGrowthOperator] = useState(initCounter?.growthTargetOperator ?? "");
  const [growthOperand, setGrowthOperand] = useState<number | undefined>(
    initCounter?.growthTargetOperand
  );
  const [growthAlgorithm, setGrowthAlgorithm] = useState(initCounter?.growthTargetAlgorithm ?? "");

  // Milestone state
  const [milestoneTypeCode, setMilestoneTypeCode] = useState(
    getInitialTypeCode(initialData, "MILESTONE")
  );
  const [milestoneTypeIsSuggested, setMilestoneTypeIsSuggested] = useState(false);
  const [milestoneItems, setMilestoneItems] = useState<Array<{ targetId: string; order: number }>>(
    () => {
      if (initialData && initialType === "MILESTONE") {
        const mt = initialData as MilestoneTarget;
        const items = (mt.items as MilestoneTargetItem[] | undefined) ?? [];
        return items
          .sort((a, b) => a.order - b.order)
          .map((item, i) => ({ targetId: item.targetId, order: i + 1 }));
      }
      return [];
    }
  );

  // X of Y state
  const [xofYTypeCode, setXofYTypeCode] = useState(getInitialTypeCode(initialData, "X_OF_Y"));
  const [xofYTypeIsSuggested, setXofYTypeIsSuggested] = useState(false);
  const [xofYTargetValue, setXofYTargetValue] = useState<number | undefined>(() => {
    if (initialData && initialType === "X_OF_Y") {
      return (initialData as XOfYTarget).targetValue;
    }
    return undefined;
  });
  const [xofYItemTargetIds, setXofYItemTargetIds] = useState<string[]>(() => {
    if (initialData && initialType === "X_OF_Y") {
      return (initialData as XOfYTarget).items ?? [];
    }
    return [];
  });

  // Collapsible state for advanced sections
  const [cyclesOpen, setCyclesOpen] = useState(() => (initCounter?.numberOfCycles ?? 0) > 0);
  const [growthOpen, setGrowthOpen] = useState(() => !!initCounter?.growthTargetOperator);

  // Extended fields state
  const [extendedFieldValues, setExtendedFieldValues] = useState<Record<string, unknown>>(() =>
    extractExtendedFields(initialData, extendedFields)
  );

  // Code auto-generation
  const codeInput = useCodeInput(name, {
    pattern: "resource",
    format: "kebab-case",
    initialValue: initialData?.code,
    locked: mode === "edit" || lockCode,
  });

  // Metadata field hooks for auto-creating suggested metadata
  const metadataTypeCode = METADATA_TYPE_CODE_MAP[targetType] ?? "COMPLETION_TARGET_TYPE";
  const { createMetadata, findOption, isTypeNotFound } = useMetadataField(metadataTypeCode);

  // Filter available targets (exclude current target in edit mode)
  const availableTargets = useMemo(() => {
    const currentId = initialData?.targetId;
    return allTargets.filter((t) => t.targetId !== currentId);
  }, [allTargets, initialData?.targetId]);

  const handleExtendedFieldChange = useCallback((field: string, value: unknown) => {
    setExtendedFieldValues((prev) => ({ ...prev, [field]: value }));
  }, []);

  const resetVariantFields = (data?: ResponseTargetData, dataType = "") => {
    const counter = data && dataType === "COUNTER" ? (data as CounterTarget) : undefined;

    setCompletionTypeCode(getInitialTypeCode(data, "COMPLETION"));
    setCompletionTypeIsSuggested(false);
    setCounterTypeCode(getInitialTypeCode(data, "COUNTER"));
    setCounterTypeIsSuggested(false);
    setTargetValue(counter?.targetValue);
    setCappingTarget(counter?.cappingTarget ?? false);
    setNumberOfCycles(counter?.numberOfCycles);
    setNumberOfCyclesToAchieve(counter?.numberOfCyclesToAchieve);
    setCyclesMustBeConsecutive(counter?.cyclesMustBeConsecutive ?? false);
    setCarryOverToNextCycle(counter?.carryOverToNextCycle ?? false);
    setGrowthOperator(counter?.growthTargetOperator ?? "");
    setGrowthOperand(counter?.growthTargetOperand);
    setGrowthAlgorithm(counter?.growthTargetAlgorithm ?? "");
    setMilestoneTypeCode(getInitialTypeCode(data, "MILESTONE"));
    setMilestoneTypeIsSuggested(false);
    setMilestoneItems(
      data && dataType === "MILESTONE"
        ? (((data as MilestoneTarget).items as MilestoneTargetItem[] | undefined) ?? [])
            .sort((a, b) => a.order - b.order)
            .map((item, i) => ({ targetId: item.targetId, order: i + 1 }))
        : []
    );
    setXofYTypeCode(getInitialTypeCode(data, "X_OF_Y"));
    setXofYTypeIsSuggested(false);
    setXofYTargetValue(
      data && dataType === "X_OF_Y" ? (data as XOfYTarget).targetValue : undefined
    );
    setXofYItemTargetIds(data && dataType === "X_OF_Y" ? ((data as XOfYTarget).items ?? []) : []);
    setCyclesOpen((counter?.numberOfCycles ?? 0) > 0);
    setGrowthOpen(!!counter?.growthTargetOperator);
  };

  // Handle type change - clear type-specific fields
  const handleTypeChange = (newType: string) => {
    resetVariantFields();
    setTargetType(newType);
  };

  // Reset every form field back to its initialData-derived default. Called on
  // sheet close so a cancel + reopen starts clean — matches the resetForm-on-
  // close pattern offer/tier/audience/customer all have (TARGET previously
  // lacked it, leaking the prior fill into the next create).
  const resetForm = () => {
    setFormError(null);
    setName(initialData?.name ?? "");
    setProgramIds(initialData?.programIds ?? []);
    setDescription(getLocalizedDescription(initialData?.description) ?? {});
    setTargetType(initialType);
    setScope((initialData as unknown as { scope: string } | undefined)?.scope ?? "GLOBAL");
    resetVariantFields(initialData, initialType);
    codeInput.reset();
    setExtendedFieldValues(extractExtendedFields(initialData, extendedFields));
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      resetForm();
    }
    onOpenChange(newOpen);
  };

  const handleCancel = () => {
    handleOpenChange(false);
  };

  // Milestone item management
  const addMilestoneItem = useCallback((targetId: string) => {
    setMilestoneItems((prev) => [...prev, { targetId, order: prev.length + 1 }]);
  }, []);

  const removeMilestoneItem = useCallback((index: number) => {
    setMilestoneItems((prev) => {
      const next = prev.filter((_, i) => i !== index);
      return next.map((item, i) => ({ ...item, order: i + 1 }));
    });
  }, []);

  const moveMilestoneItem = useCallback((index: number, direction: "up" | "down") => {
    setMilestoneItems((prev) => {
      const next = [...prev];
      const swapIndex = direction === "up" ? index - 1 : index + 1;
      if (swapIndex < 0 || swapIndex >= next.length) return prev;
      [next[index], next[swapIndex]] = [next[swapIndex]!, next[index]!];
      return next.map((item, i) => ({ ...item, order: i + 1 }));
    });
  }, []);

  // X of Y item management
  const addXofYItem = useCallback((targetId: string) => {
    setXofYItemTargetIds((prev) => [...prev, targetId]);
  }, []);

  const removeXofYItem = useCallback((targetId: string) => {
    setXofYItemTargetIds((prev) => prev.filter((id) => id !== targetId));
  }, []);

  // Form submission
  const handleSubmit = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setFormError(null);

      // Validation
      if (!name.trim()) {
        setFormError("Name is required.");
        return;
      }

      if (programIds.length === 0) {
        setFormError("At least one program must be selected.");
        return;
      }

      if (!targetType) {
        setFormError("Target type is required.");
        return;
      }

      // Type-specific validation
      if (targetType === "COMPLETION" && !completionTypeCode) {
        setFormError("Completion target type is required.");
        return;
      }
      if (targetType === "COUNTER" && !counterTypeCode) {
        setFormError("Counter target type is required.");
        return;
      }
      if (targetType === "MILESTONE") {
        if (!milestoneTypeCode) {
          setFormError("Milestone target type is required.");
          return;
        }
        if (milestoneItems.length < 2) {
          setFormError("Milestone targets require at least 2 steps.");
          return;
        }
      }
      if (targetType === "X_OF_Y") {
        if (!xofYTypeCode) {
          setFormError("X of Y target type is required.");
          return;
        }
        if (!xofYTargetValue || xofYTargetValue < 1) {
          setFormError("X value must be at least 1.");
          return;
        }
        if (xofYItemTargetIds.length === 0) {
          setFormError("At least one target must be selected.");
          return;
        }
        if (xofYTargetValue > xofYItemTargetIds.length) {
          setFormError("X value cannot exceed the number of available targets.");
          return;
        }
      }

      // Counter cycle validation
      if (targetType === "COUNTER" && cyclesOpen && numberOfCycles) {
        if (numberOfCyclesToAchieve && numberOfCyclesToAchieve > numberOfCycles) {
          setFormError("Cycles to achieve cannot exceed total number of cycles.");
          return;
        }
      }

      // Auto-create suggested metadata if needed
      const typeIsSuggested =
        (targetType === "COMPLETION" && completionTypeIsSuggested) ||
        (targetType === "COUNTER" && counterTypeIsSuggested) ||
        (targetType === "MILESTONE" && milestoneTypeIsSuggested) ||
        (targetType === "X_OF_Y" && xofYTypeIsSuggested);

      const activeTypeCode =
        targetType === "COMPLETION"
          ? completionTypeCode
          : targetType === "COUNTER"
            ? counterTypeCode
            : targetType === "MILESTONE"
              ? milestoneTypeCode
              : xofYTypeCode;

      // `findOption` also matches against the client-side suggestedOptions list (so the UI can
      // display a label for a not-yet-created selection), so a suggested option's own code is
      // always "found" by it — checking `!findOption(...)` here can never be true and this
      // branch never ran. Use the found option's own suggested data instead, matching the
      // (correct) equivalent check in program-form-sheet.tsx's handleSubmit.
      if (typeIsSuggested && !isTypeNotFound) {
        const option = findOption(activeTypeCode);
        if (option) {
          // No local try/catch by design: a rejection here (e.g. a 409 from a
          // stale option cache) is meant to propagate to the parent's
          // onSubmit catch, which surfaces it via setFormError without
          // aborting the target POST below — see target-list-page.tsx's
          // onSubmit wrapper and the "[audit] L3" contract test block in
          // target-form-sheet.test.tsx. This component assumes that parent
          // wrapper; a caller that renders it without one will see this
          // rejection go unhandled.
          await createMetadata({
            code: option.code,
            name: option.name,
            description: option.description ? { en: option.description } : undefined,
          });
        }
      }

      const hasDescription = Object.values(description).some((v) => v.trim() !== "");

      // Build base fields
      const baseFields = {
        programIds,
        code: codeInput.value,
        name,
        scope: scope as "GLOBAL" | "PROGRAM" | "RULE" | "EVENT",
        description: hasDescription ? description : undefined,
        ...extendedFieldValues,
      };

      // Build type-specific payload
      let formData: CreateTarget;

      switch (targetType) {
        case "COMPLETION":
          formData = {
            ...baseFields,
            type: "COMPLETION",
            completionTargetTypeCode: completionTypeCode,
          } as CreateCompletionTarget & Record<string, unknown>;
          break;

        case "COUNTER": {
          const counterPayload: CreateCounterTarget & Record<string, unknown> = {
            ...baseFields,
            type: "COUNTER",
            counterTargetTypeCode: counterTypeCode,
            ...(targetValue != null ? { targetValue } : {}),
            ...(cappingTarget ? { cappingTarget: true } : {}),
          };
          if (cyclesOpen && numberOfCycles) {
            counterPayload.numberOfCycles = numberOfCycles;
            if (numberOfCyclesToAchieve) {
              counterPayload.numberOfCyclesToAchieve = numberOfCyclesToAchieve;
            }
            if (cyclesMustBeConsecutive) {
              counterPayload.cyclesMustBeConsecutive = true;
            }
            if (carryOverToNextCycle) {
              counterPayload.carryOverToNextCycle = true;
            }
          }
          if (growthOpen && growthOperator) {
            counterPayload.growthTargetOperator =
              growthOperator as CreateCounterTarget["growthTargetOperator"];
            if (growthOperand != null) {
              counterPayload.growthTargetOperand = growthOperand;
            }
            if (growthAlgorithm) {
              counterPayload.growthTargetAlgorithm =
                growthAlgorithm as CreateCounterTarget["growthTargetAlgorithm"];
            }
          }
          formData = counterPayload;
          break;
        }

        case "MILESTONE":
          formData = {
            ...baseFields,
            type: "MILESTONE",
            milestoneTargetTypeCode: milestoneTypeCode,
            items: milestoneItems.map((item) => ({
              targetId: item.targetId,
              order: item.order,
            })),
          } as CreateMilestoneTarget & Record<string, unknown>;
          break;

        case "X_OF_Y":
          formData = {
            ...baseFields,
            type: "X_OF_Y",
            xofYTargetTypeCode: xofYTypeCode,
            itemTargetIds: xofYItemTargetIds,
            targetValue: xofYTargetValue!,
          } as CreateXOfYTarget & Record<string, unknown>;
          break;

        default:
          setFormError("Invalid target type.");
          return;
      }

      await onSubmit(formData);
    },
    [
      name,
      programIds,
      targetType,
      scope,
      description,
      codeInput.value,
      completionTypeCode,
      completionTypeIsSuggested,
      counterTypeCode,
      counterTypeIsSuggested,
      targetValue,
      cappingTarget,
      cyclesOpen,
      numberOfCycles,
      numberOfCyclesToAchieve,
      cyclesMustBeConsecutive,
      carryOverToNextCycle,
      growthOpen,
      growthOperator,
      growthOperand,
      growthAlgorithm,
      milestoneTypeCode,
      milestoneTypeIsSuggested,
      milestoneItems,
      xofYTypeCode,
      xofYTypeIsSuggested,
      xofYTargetValue,
      xofYItemTargetIds,
      extendedFieldValues,
      isTypeNotFound,
      findOption,
      createMetadata,
      onSubmit,
    ]
  );

  const title = mode === "create" ? "Create Target" : `Edit ${initialData?.name ?? "Target"}`;
  const submitLabel = mode === "create" ? "Create Target" : "Save Changes";

  return (
    <FormSheet
      open={open}
      onOpenChange={handleOpenChange}
      title={title}
      onSubmit={handleSubmit}
      submitDisabled={codeInput.error != null}
      onCancel={handleCancel}
      isSubmitting={isSubmitting}
      submitLabel={submitLabel}
      error={formError ?? error}
      fieldErrors={fieldErrors}
    >
      <div className="space-y-6">
        {/* Name field */}
        <div className="space-y-2">
          <Label htmlFor="target-name">
            Name <span className="text-destructive">*</span>
          </Label>
          <WithFieldError field="name">
            {(fe) => (
              <Input
                {...fe.inputProps}
                id="target-name"
                type="text"
                data-widget="text-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter target name"
                required
                disabled={isSubmitting}
              />
            )}
          </WithFieldError>
        </div>

        {/* Code field with auto-generation */}
        <div className="space-y-2">
          <Label htmlFor="target-code">
            Code <span className="text-destructive">*</span>
          </Label>
          <WithFieldError field="code" hideMessage>
            {(fe) => (
              <CodeInput
                data-field={fe.inputProps["data-field"]}
                id="target-code"
                sourceValue={name}
                value={codeInput.value}
                onChange={codeInput.onChange}
                error={fe.error ?? codeInput.error}
                format="kebab-case"
                placeholder="target-code"
                required
                disabled={isSubmitting || mode === "edit" || lockCode}
                showReset={mode === "create" && !lockCode}
              />
            )}
          </WithFieldError>
          {mode === "create" && !lockCode && (
            <p className="text-muted-foreground text-xs">
              Auto-generated from name. Edit to customize.
            </p>
          )}
        </div>

        {/* Target Type */}
        <div className="space-y-2">
          <Label id="target-type-label" htmlFor="target-type">
            Target Type <span className="text-destructive">*</span>
          </Label>
          <WithFieldError field="type" value={targetType}>
            {(fe) => (
              <DiscriminatorRadioGroup
                {...fe.inputProps}
                id="target-type"
                value={targetType}
                onValueChange={handleTypeChange}
                options={[...TARGET_TYPE_OPTIONS]}
                disabled={isSubmitting || mode === "edit"}
                aria-labelledby="target-type-label"
              />
            )}
          </WithFieldError>
          {mode === "edit" && (
            <p className="text-muted-foreground text-xs">
              Target type cannot be changed after creation.
            </p>
          )}
        </div>

        {/* Programs multi-select */}
        <div className="space-y-2">
          <Label htmlFor="target-programs">
            Programs <span className="text-destructive">*</span>
          </Label>
          <WithFieldError field="programIds" value={programIds}>
            {(fe) => (
              <ProgramMultiField
                {...fe.inputProps}
                id="target-programs"
                value={programIds}
                onValueChange={setProgramIds}
                placeholder="Select programs..."
                disabled={isSubmitting}
              />
            )}
          </WithFieldError>
          <p className="text-muted-foreground text-xs">
            Associate this target with one or more programs.
          </p>
        </div>

        {/* Description */}
        <div className="space-y-2">
          <Label htmlFor="target-description">Description</Label>
          <WithFieldError field="description" value={description}>
            {(fe) => (
              <LocalizedStringInput
                {...fe.inputProps}
                id="target-description"
                value={description}
                onChange={setDescription}
                placeholder="Describe this target"
                multiline
                disabled={isSubmitting}
              />
            )}
          </WithFieldError>
        </div>

        {/* Scope */}
        <div className="space-y-2">
          <Label htmlFor="target-scope">Scope</Label>
          <WithFieldError field="scope" value={scope}>
            {(fe) => (
              <Select value={scope} onValueChange={setScope} disabled={isSubmitting}>
                <SelectTrigger {...fe.inputProps} id="target-scope" data-widget="select">
                  <SelectValue placeholder="Select scope..." />
                </SelectTrigger>
                <SelectContent>
                  {TARGET_SCOPE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </WithFieldError>
        </div>

        {/* ============================================================ */}
        {/* Type-Specific Configuration */}
        {/* ============================================================ */}

        {targetType === "COMPLETION" && (
          <CompletionFields
            typeCode={completionTypeCode}
            onTypeCodeChange={(code, isSuggested) => {
              setCompletionTypeCode(code);
              setCompletionTypeIsSuggested(isSuggested);
            }}
            disabled={isSubmitting}
          />
        )}

        {targetType === "COUNTER" && (
          <CounterFields
            typeCode={counterTypeCode}
            onTypeCodeChange={(code, isSuggested) => {
              setCounterTypeCode(code);
              setCounterTypeIsSuggested(isSuggested);
            }}
            targetValue={targetValue}
            onTargetValueChange={setTargetValue}
            cappingTarget={cappingTarget}
            onCappingTargetChange={setCappingTarget}
            cyclesOpen={cyclesOpen}
            onCyclesOpenChange={setCyclesOpen}
            numberOfCycles={numberOfCycles}
            onNumberOfCyclesChange={setNumberOfCycles}
            numberOfCyclesToAchieve={numberOfCyclesToAchieve}
            onNumberOfCyclesToAchieveChange={setNumberOfCyclesToAchieve}
            cyclesMustBeConsecutive={cyclesMustBeConsecutive}
            onCyclesMustBeConsecutiveChange={setCyclesMustBeConsecutive}
            carryOverToNextCycle={carryOverToNextCycle}
            onCarryOverToNextCycleChange={setCarryOverToNextCycle}
            growthOpen={growthOpen}
            onGrowthOpenChange={setGrowthOpen}
            growthOperator={growthOperator}
            onGrowthOperatorChange={setGrowthOperator}
            growthOperand={growthOperand}
            onGrowthOperandChange={setGrowthOperand}
            growthAlgorithm={growthAlgorithm}
            onGrowthAlgorithmChange={setGrowthAlgorithm}
            disabled={isSubmitting}
          />
        )}

        {targetType === "MILESTONE" && (
          <MilestoneFields
            typeCode={milestoneTypeCode}
            onTypeCodeChange={(code, isSuggested) => {
              setMilestoneTypeCode(code);
              setMilestoneTypeIsSuggested(isSuggested);
            }}
            items={milestoneItems}
            availableTargets={availableTargets}
            onAddItem={addMilestoneItem}
            onRemoveItem={removeMilestoneItem}
            onMoveItem={moveMilestoneItem}
            disabled={isSubmitting}
            allTargetsLoading={allTargetsLoading}
            allTargetsError={allTargetsError}
          />
        )}

        {targetType === "X_OF_Y" && (
          <XOfYFields
            typeCode={xofYTypeCode}
            onTypeCodeChange={(code, isSuggested) => {
              setXofYTypeCode(code);
              setXofYTypeIsSuggested(isSuggested);
            }}
            targetValue={xofYTargetValue}
            onTargetValueChange={setXofYTargetValue}
            itemTargetIds={xofYItemTargetIds}
            availableTargets={availableTargets}
            onAddItem={addXofYItem}
            onRemoveItem={removeXofYItem}
            disabled={isSubmitting}
            allTargetsLoading={allTargetsLoading}
            allTargetsError={allTargetsError}
          />
        )}

        {/* Extended Fields Section */}
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

// ============================================================
// Completion Type Fields
// ============================================================

function CompletionFields({
  typeCode,
  onTypeCodeChange,
  disabled,
}: {
  typeCode: string;
  onTypeCodeChange: (code: string, isSuggested: boolean) => void;
  disabled: boolean;
}): ReactNode {
  return (
    <div className="bg-muted/50 space-y-4 rounded-lg border p-4">
      <h4 className="text-foreground text-sm font-medium">Completion Configuration</h4>
      <div className="space-y-2">
        <Label htmlFor="target-completion-type-code">
          Completion Type <span className="text-destructive">*</span>
        </Label>
        <WithFieldError field="completionTargetTypeCode" value={typeCode}>
          {(fe) => (
            <MetadataField
              {...fe.inputProps}
              id="target-completion-type-code"
              typeCode="COMPLETION_TARGET_TYPE"
              typeLabel="Completion Target Type"
              value={typeCode}
              onValueChange={onTypeCodeChange}
              placeholder="Select completion type..."
              disabled={disabled}
            />
          )}
        </WithFieldError>
      </div>
    </div>
  );
}

// ============================================================
// Counter Type Fields
// ============================================================

interface CounterFieldsProps {
  typeCode: string;
  onTypeCodeChange: (code: string, isSuggested: boolean) => void;
  targetValue?: number;
  onTargetValueChange: (v: number | undefined) => void;
  cappingTarget: boolean;
  onCappingTargetChange: (v: boolean) => void;
  cyclesOpen: boolean;
  onCyclesOpenChange: (v: boolean) => void;
  numberOfCycles?: number;
  onNumberOfCyclesChange: (v: number | undefined) => void;
  numberOfCyclesToAchieve?: number;
  onNumberOfCyclesToAchieveChange: (v: number | undefined) => void;
  cyclesMustBeConsecutive: boolean;
  onCyclesMustBeConsecutiveChange: (v: boolean) => void;
  carryOverToNextCycle: boolean;
  onCarryOverToNextCycleChange: (v: boolean) => void;
  growthOpen: boolean;
  onGrowthOpenChange: (v: boolean) => void;
  growthOperator: string;
  onGrowthOperatorChange: (v: string) => void;
  growthOperand?: number;
  onGrowthOperandChange: (v: number | undefined) => void;
  growthAlgorithm: string;
  onGrowthAlgorithmChange: (v: string) => void;
  disabled: boolean;
}

function CounterFields({
  typeCode,
  onTypeCodeChange,
  targetValue,
  onTargetValueChange,
  cappingTarget,
  onCappingTargetChange,
  cyclesOpen,
  onCyclesOpenChange,
  numberOfCycles,
  onNumberOfCyclesChange,
  numberOfCyclesToAchieve,
  onNumberOfCyclesToAchieveChange,
  cyclesMustBeConsecutive,
  onCyclesMustBeConsecutiveChange,
  carryOverToNextCycle,
  onCarryOverToNextCycleChange,
  growthOpen,
  onGrowthOpenChange,
  growthOperator,
  onGrowthOperatorChange,
  growthOperand,
  onGrowthOperandChange,
  growthAlgorithm,
  onGrowthAlgorithmChange,
  disabled,
}: CounterFieldsProps): ReactNode {
  return (
    <div className="bg-muted/50 space-y-4 rounded-lg border p-4">
      <h4 className="text-foreground text-sm font-medium">Counter Configuration</h4>

      {/* Counter Type */}
      <div className="space-y-2">
        <Label htmlFor="target-counter-type-code">
          Counter Type <span className="text-destructive">*</span>
        </Label>
        <WithFieldError field="counterTargetTypeCode" value={typeCode}>
          {(fe) => (
            <MetadataField
              {...fe.inputProps}
              id="target-counter-type-code"
              typeCode="COUNTER_TARGET_TYPE"
              typeLabel="Counter Target Type"
              value={typeCode}
              onValueChange={onTypeCodeChange}
              placeholder="Select counter type..."
              disabled={disabled}
            />
          )}
        </WithFieldError>
      </div>

      {/* Target Value */}
      <div className="space-y-2">
        <Label htmlFor="counter-target-value">Target Value</Label>
        <WithFieldError field="targetValue">
          {(fe) => (
            <Input
              {...fe.inputProps}
              id="counter-target-value"
              type="number"
              data-widget="text-input"
              min={0}
              value={targetValue ?? ""}
              onChange={(e) =>
                onTargetValueChange(e.target.value ? Number(e.target.value) : undefined)
              }
              placeholder="e.g. 500"
              disabled={disabled}
            />
          )}
        </WithFieldError>
        <p className="text-muted-foreground text-xs">Numerical value that must be achieved.</p>
      </div>

      {/* Capping Target */}
      <div className="flex items-center gap-2">
        <Checkbox
          id="capping-target"
          checked={cappingTarget}
          onCheckedChange={(checked) => onCappingTargetChange(checked === true)}
          disabled={disabled}
        />
        <Label htmlFor="capping-target" className="cursor-pointer font-normal">
          Capping target
        </Label>
      </div>
      <p className="text-muted-foreground -mt-2 text-xs">Acts as a limit rather than a goal.</p>

      {/* Cycles - Collapsible */}
      <CollapsibleSection
        title="Cycle Configuration"
        open={cyclesOpen}
        onOpenChange={onCyclesOpenChange}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="num-cycles">Number of Cycles</Label>
              <WithFieldError field="numberOfCycles">
                {(fe) => (
                  <Input
                    {...fe.inputProps}
                    id="num-cycles"
                    type="number"
                    data-widget="text-input"
                    min={1}
                    value={numberOfCycles ?? ""}
                    onChange={(e) =>
                      onNumberOfCyclesChange(e.target.value ? Number(e.target.value) : undefined)
                    }
                    placeholder="e.g. 3"
                    disabled={disabled}
                  />
                )}
              </WithFieldError>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cycles-to-achieve">Cycles to Achieve</Label>
              <WithFieldError field="numberOfCyclesToAchieve">
                {(fe) => (
                  <Input
                    {...fe.inputProps}
                    id="cycles-to-achieve"
                    type="number"
                    data-widget="text-input"
                    min={1}
                    max={numberOfCycles ?? undefined}
                    value={numberOfCyclesToAchieve ?? ""}
                    onChange={(e) =>
                      onNumberOfCyclesToAchieveChange(
                        e.target.value ? Number(e.target.value) : undefined
                      )
                    }
                    placeholder="e.g. 2"
                    disabled={disabled}
                  />
                )}
              </WithFieldError>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Checkbox
                id="consecutive-cycles"
                checked={cyclesMustBeConsecutive}
                onCheckedChange={(checked) => onCyclesMustBeConsecutiveChange(checked === true)}
                disabled={disabled}
              />
              <Label htmlFor="consecutive-cycles" className="cursor-pointer font-normal">
                Must be consecutive
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="carry-over"
                checked={carryOverToNextCycle}
                onCheckedChange={(checked) => onCarryOverToNextCycleChange(checked === true)}
                disabled={disabled}
              />
              <Label htmlFor="carry-over" className="cursor-pointer font-normal">
                Carry over to next cycle
              </Label>
            </div>
          </div>
        </div>
      </CollapsibleSection>

      {/* Growth - Collapsible */}
      <CollapsibleSection
        title="Growth Configuration"
        open={growthOpen}
        onOpenChange={onGrowthOpenChange}
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="growth-operator">Growth Operator</Label>
            <WithFieldError field="growthTargetOperator" value={growthOperator}>
              {(fe) => (
                <Select
                  value={growthOperator}
                  onValueChange={onGrowthOperatorChange}
                  disabled={disabled}
                >
                  <SelectTrigger {...fe.inputProps} id="growth-operator">
                    <SelectValue placeholder="Select operator..." />
                  </SelectTrigger>
                  <SelectContent>
                    {GROWTH_OPERATOR_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </WithFieldError>
          </div>
          <div className="space-y-2">
            <Label htmlFor="growth-operand">Growth Operand</Label>
            <WithFieldError field="growthTargetOperand">
              {(fe) => (
                <Input
                  {...fe.inputProps}
                  id="growth-operand"
                  type="number"
                  data-widget="text-input"
                  value={growthOperand ?? ""}
                  onChange={(e) =>
                    onGrowthOperandChange(e.target.value ? Number(e.target.value) : undefined)
                  }
                  placeholder="e.g. 1.5"
                  disabled={disabled}
                />
              )}
            </WithFieldError>
          </div>
          <div className="space-y-2">
            <Label htmlFor="growth-algorithm">Growth Algorithm</Label>
            <WithFieldError field="growthTargetAlgorithm" value={growthAlgorithm}>
              {(fe) => (
                <Select
                  value={growthAlgorithm}
                  onValueChange={onGrowthAlgorithmChange}
                  disabled={disabled}
                >
                  <SelectTrigger {...fe.inputProps} id="growth-algorithm">
                    <SelectValue placeholder="Select algorithm..." />
                  </SelectTrigger>
                  <SelectContent>
                    {GROWTH_ALGORITHM_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </WithFieldError>
          </div>
        </div>
      </CollapsibleSection>
    </div>
  );
}

// ============================================================
// Milestone Type Fields
// ============================================================

function MilestoneFields({
  typeCode,
  onTypeCodeChange,
  items,
  availableTargets,
  onAddItem,
  onRemoveItem,
  onMoveItem,
  disabled,
  allTargetsLoading,
  allTargetsError,
}: {
  typeCode: string;
  onTypeCodeChange: (code: string, isSuggested: boolean) => void;
  items: Array<{ targetId: string; order: number }>;
  availableTargets: ResponseTargetData[];
  onAddItem: (targetId: string) => void;
  onRemoveItem: (index: number) => void;
  onMoveItem: (index: number, direction: "up" | "down") => void;
  disabled: boolean;
  allTargetsLoading: boolean;
  allTargetsError: boolean;
}): ReactNode {
  const [pickerOpen, setPickerOpen] = useState(false);

  // Filter out already-selected targets
  const selectedIds = new Set(items.map((item) => item.targetId));
  const filterable = availableTargets.filter((t) => !selectedIds.has(t.targetId ?? ""));

  // Build target lookup for display names
  const targetMap = useMemo(() => {
    const map = new Map<string, ResponseTargetData>();
    for (const t of availableTargets) {
      if (t.targetId) map.set(t.targetId, t);
    }
    return map;
  }, [availableTargets]);

  return (
    <div className="bg-muted/50 space-y-4 rounded-lg border p-4">
      <h4 className="text-foreground text-sm font-medium">Milestone Configuration</h4>

      {/* Milestone Type */}
      <div className="space-y-2">
        <Label htmlFor="target-milestone-type-code">
          Milestone Type <span className="text-destructive">*</span>
        </Label>
        <WithFieldError field="milestoneTargetTypeCode" value={typeCode}>
          {(fe) => (
            <MetadataField
              {...fe.inputProps}
              id="target-milestone-type-code"
              typeCode="MILESTONE_TARGET_TYPE"
              typeLabel="Milestone Target Type"
              value={typeCode}
              onValueChange={onTypeCodeChange}
              placeholder="Select milestone type..."
              disabled={disabled}
            />
          )}
        </WithFieldError>
      </div>

      {/* Steps List */}
      <div className="space-y-2">
        <Label>
          Steps <span className="text-destructive">*</span>
          <span className="text-muted-foreground ml-1 text-xs font-normal">(minimum 2)</span>
        </Label>

        {items.length > 0 && (
          <div className="space-y-2">
            {items.map((item, index) => {
              const resolved = targetMap.get(item.targetId);
              const resolvedType = resolved
                ? (resolved as unknown as { type: string }).type
                : undefined;
              return (
                <div
                  key={item.targetId}
                  className="bg-background flex items-center gap-2 rounded-lg border p-2"
                >
                  <span className="text-muted-foreground w-6 text-center text-xs font-medium">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-foreground truncate text-sm font-medium">
                      {resolved?.name ?? item.targetId}
                    </p>
                  </div>
                  {resolvedType && (
                    <Badge variant="secondary" className="shrink-0 text-xs font-normal">
                      {TARGET_TYPE_LABELS[resolvedType] ?? resolvedType}
                    </Badge>
                  )}
                  <div className="flex shrink-0 gap-0.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      disabled={disabled || index === 0}
                      onClick={() => onMoveItem(index, "up")}
                      aria-label="Move up"
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      disabled={disabled || index === items.length - 1}
                      onClick={() => onMoveItem(index, "down")}
                      aria-label="Move down"
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="text-destructive h-7 w-7"
                      disabled={disabled}
                      onClick={() => onRemoveItem(index)}
                      aria-label="Remove"
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Add step picker */}
        <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled || allTargetsLoading || allTargetsError || filterable.length === 0}
              className="w-full"
            >
              <Plus className="mr-2 h-3.5 w-3.5" />
              Add Step
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
            <Command>
              <CommandInput placeholder="Search targets..." />
              <CommandList>
                <CommandEmpty>No targets available</CommandEmpty>
                <CommandGroup>
                  {filterable.map((t) => {
                    const tType = (t as unknown as { type: string }).type;
                    return (
                      <CommandItem
                        key={t.targetId}
                        value={`${t.targetId} ${t.name} ${t.code}`}
                        onSelect={() => {
                          if (t.targetId) {
                            onAddItem(t.targetId);
                          }
                          setPickerOpen(false);
                        }}
                      >
                        <span className="flex-1 truncate">{t.name}</span>
                        <Badge variant="secondary" className="shrink-0 text-xs font-normal">
                          {TARGET_TYPE_LABELS[tType] ?? tType}
                        </Badge>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        {allTargetsError ? (
          <div
            className="border-destructive/30 bg-destructive/5 rounded-lg border p-3"
            role="alert"
          >
            <p className="text-destructive text-sm">
              Failed to load all targets — the list shown may be incomplete.
            </p>
          </div>
        ) : allTargetsLoading ? (
          <p className="text-muted-foreground text-xs">Loading more targets…</p>
        ) : null}
      </div>
    </div>
  );
}

// ============================================================
// X of Y Type Fields
// ============================================================

function XOfYFields({
  typeCode,
  onTypeCodeChange,
  targetValue,
  onTargetValueChange,
  itemTargetIds,
  availableTargets,
  onAddItem,
  onRemoveItem,
  disabled,
  allTargetsLoading,
  allTargetsError,
}: {
  typeCode: string;
  onTypeCodeChange: (code: string, isSuggested: boolean) => void;
  targetValue?: number;
  onTargetValueChange: (v: number | undefined) => void;
  itemTargetIds: string[];
  availableTargets: ResponseTargetData[];
  onAddItem: (targetId: string) => void;
  onRemoveItem: (targetId: string) => void;
  disabled: boolean;
  allTargetsLoading: boolean;
  allTargetsError: boolean;
}): ReactNode {
  const [pickerOpen, setPickerOpen] = useState(false);

  const selectedSet = new Set(itemTargetIds);
  const filterable = availableTargets.filter((t) => !selectedSet.has(t.targetId ?? ""));

  const targetMap = useMemo(() => {
    const map = new Map<string, ResponseTargetData>();
    for (const t of availableTargets) {
      if (t.targetId) map.set(t.targetId, t);
    }
    return map;
  }, [availableTargets]);

  return (
    <div className="bg-muted/50 space-y-4 rounded-lg border p-4">
      <h4 className="text-foreground text-sm font-medium">X of Y Configuration</h4>

      {/* X of Y Type */}
      <div className="space-y-2">
        <Label htmlFor="target-xofy-type-code">
          X of Y Type <span className="text-destructive">*</span>
        </Label>
        <WithFieldError field="xofYTargetTypeCode" value={typeCode}>
          {(fe) => (
            <MetadataField
              {...fe.inputProps}
              id="target-xofy-type-code"
              typeCode="X_OF_Y_TARGET_TYPE"
              typeLabel="X of Y Target Type"
              value={typeCode}
              onValueChange={onTypeCodeChange}
              placeholder="Select X of Y type..."
              disabled={disabled}
            />
          )}
        </WithFieldError>
      </div>

      {/* X Value */}
      <div className="space-y-2">
        <Label htmlFor="xofy-target-value">
          Complete (X) <span className="text-destructive">*</span>
        </Label>
        <WithFieldError field="targetValue">
          {(fe) => (
            <div className="flex items-center gap-2">
              <Input
                {...fe.inputProps}
                id="xofy-target-value"
                type="number"
                data-widget="text-input"
                min={1}
                max={itemTargetIds.length || undefined}
                value={targetValue ?? ""}
                onChange={(e) =>
                  onTargetValueChange(e.target.value ? Number(e.target.value) : undefined)
                }
                placeholder="e.g. 3"
                disabled={disabled}
                className="w-24"
              />
              <span className="text-muted-foreground text-sm">
                of {itemTargetIds.length} target{itemTargetIds.length !== 1 ? "s" : ""}
              </span>
            </div>
          )}
        </WithFieldError>
      </div>

      {/* Selected Targets */}
      <div className="space-y-2">
        <Label>
          Available Targets (Y) <span className="text-destructive">*</span>
        </Label>

        {itemTargetIds.length > 0 && (
          <div className="space-y-2">
            {itemTargetIds.map((id) => {
              const resolved = targetMap.get(id);
              const resolvedType = resolved
                ? (resolved as unknown as { type: string }).type
                : undefined;
              return (
                <div
                  key={id}
                  className="bg-background flex items-center gap-2 rounded-lg border p-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-foreground truncate text-sm font-medium">
                      {resolved?.name ?? id}
                    </p>
                  </div>
                  {resolvedType && (
                    <Badge variant="secondary" className="shrink-0 text-xs font-normal">
                      {TARGET_TYPE_LABELS[resolvedType] ?? resolvedType}
                    </Badge>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-destructive h-7 w-7 shrink-0"
                    disabled={disabled}
                    onClick={() => onRemoveItem(id)}
                    aria-label="Remove"
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}

        {/* Add target picker */}
        <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled || allTargetsLoading || allTargetsError || filterable.length === 0}
              className="w-full"
            >
              <Plus className="mr-2 h-3.5 w-3.5" />
              Add Target
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
            <Command>
              <CommandInput placeholder="Search targets..." />
              <CommandList>
                <CommandEmpty>No targets available</CommandEmpty>
                <CommandGroup>
                  {filterable.map((t) => {
                    const tType = (t as unknown as { type: string }).type;
                    return (
                      <CommandItem
                        key={t.targetId}
                        value={`${t.targetId} ${t.name} ${t.code}`}
                        onSelect={() => {
                          if (t.targetId) {
                            onAddItem(t.targetId);
                          }
                          setPickerOpen(false);
                        }}
                      >
                        <span className="flex-1 truncate">{t.name}</span>
                        <Badge variant="secondary" className="shrink-0 text-xs font-normal">
                          {TARGET_TYPE_LABELS[tType] ?? tType}
                        </Badge>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        {allTargetsError ? (
          <div
            className="border-destructive/30 bg-destructive/5 rounded-lg border p-3"
            role="alert"
          >
            <p className="text-destructive text-sm">
              Failed to load all targets — the list shown may be incomplete.
            </p>
          </div>
        ) : allTargetsLoading ? (
          <p className="text-muted-foreground text-xs">Loading more targets…</p>
        ) : null}
      </div>
    </div>
  );
}

// ============================================================
// Shared: Collapsible Section
// ============================================================

function CollapsibleSection({
  title,
  open,
  onOpenChange,
  children,
}: {
  title: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}): ReactNode {
  return (
    <div className="border-border/50 rounded-lg border">
      <button
        type="button"
        className="hover:bg-muted/30 flex w-full items-center justify-between rounded-lg p-3 text-left"
        onClick={() => onOpenChange(!open)}
      >
        <span className="text-foreground text-sm font-medium">{title}</span>
        <ChevronDown
          className={cn(
            "text-muted-foreground h-4 w-4 transition-transform duration-200",
            open && "rotate-180"
          )}
        />
      </button>
      <div
        className={cn(
          "overflow-hidden transition-all duration-200",
          open ? "max-h-[1000px] opacity-100" : "max-h-0 opacity-0"
        )}
      >
        <div className="px-3 pb-3">{children}</div>
      </div>
    </div>
  );
}
