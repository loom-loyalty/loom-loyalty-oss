/**
 * WorkflowFormSheet - Sheet component for creating/editing Workflows
 *
 * Provides form fields for workflow name, code, description, active toggle,
 * and a step editor for defining approval steps.
 */

import { Plus, Trash2 } from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";
import { CodeInput, useCodeInput } from "../../../forms/code-input.js";
import { WithFieldError } from "../../../forms/field-errors.js";
import { FormSheet } from "../../../forms/form-sheet.js";
import {
  LocalizedStringInput,
  type LocalizedString,
} from "../../../forms/localized-string-input.js";
import { Button } from "../../../primitives/button.js";
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
import {
  STEP_TYPE_OPTIONS,
  type WorkflowFormData,
  type WorkflowFormSheetProps,
  type WorkflowStepType,
} from "./types.js";

/**
 * Internal step form state
 */
interface StepFormState {
  key: string;
  name: string;
  type: WorkflowStepType;
  orderIndex: number;
}

let stepKeyCounter = 0;
function nextStepKey(): string {
  stepKeyCounter += 1;
  return `step-${stepKeyCounter}`;
}

/**
 * Helper to extract localized string from i18n object
 */
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
 * Sheet component for creating and editing Workflows.
 */
export function WorkflowFormSheet({
  open,
  onOpenChange,
  mode,
  initialData,
  onSubmit,
  isSubmitting = false,
  error,
  fieldErrors,
}: WorkflowFormSheetProps): ReactNode {
  const [name, setName] = useState(initialData?.name ?? "");
  const [description, setDescription] = useState<LocalizedString>(
    () => getLocalizedDescription(initialData?.description) ?? {}
  );
  const [active, setActive] = useState(initialData?.active ?? true);
  const [steps, setSteps] = useState<StepFormState[]>(
    () =>
      initialData?.steps?.map((s) => ({
        key: nextStepKey(),
        name: s.name,
        type: s.type,
        orderIndex: s.orderIndex,
      })) ?? []
  );

  const codeInput = useCodeInput(name, {
    pattern: "resource",
    format: "kebab-case",
    initialValue: initialData?.code,
    locked: mode === "edit",
  });

  const resetForm = () => {
    setName(initialData?.name ?? "");
    setDescription(getLocalizedDescription(initialData?.description) ?? {});
    setActive(initialData?.active ?? true);
    setSteps(
      initialData?.steps?.map((s) => ({
        key: nextStepKey(),
        name: s.name,
        type: s.type,
        orderIndex: s.orderIndex,
      })) ?? []
    );
    codeInput.reset();
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      resetForm();
    }
    onOpenChange(newOpen);
  };

  const addStep = () => {
    setSteps((prev) => [
      ...prev,
      {
        key: nextStepKey(),
        name: "",
        type: "USER_APPROVAL",
        orderIndex: prev.length,
      },
    ]);
  };

  const removeStep = (key: string) => {
    setSteps((prev) => prev.filter((s) => s.key !== key).map((s, i) => ({ ...s, orderIndex: i })));
  };

  const updateStep = (key: string, field: "name" | "type", value: string) => {
    setSteps((prev) => prev.map((s) => (s.key === key ? { ...s, [field]: value } : s)));
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const hasDescription = Object.values(description).some((v) => v.trim() !== "");

    const formData: WorkflowFormData = {
      name,
      code: codeInput.value,
      description: hasDescription ? description : undefined,
      active,
      steps: steps.map((s) => ({
        name: s.name,
        type: s.type,
        orderIndex: s.orderIndex,
      })),
    };

    await onSubmit(formData);
  };

  const handleCancel = () => {
    handleOpenChange(false);
  };

  const title = mode === "create" ? "Create Workflow" : `Edit ${initialData?.name ?? "Workflow"}`;
  const submitLabel = mode === "create" ? "Create Workflow" : "Save Changes";

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
      error={error}
      fieldErrors={fieldErrors}
    >
      <div className="space-y-6">
        {/* Name field */}
        <div className="space-y-2">
          <Label htmlFor="workflow-name">
            Name <span className="text-destructive">*</span>
          </Label>
          <WithFieldError field="name">
            {(fe) => (
              <Input
                {...fe.inputProps}
                id="workflow-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter workflow name"
                required
                disabled={isSubmitting}
              />
            )}
          </WithFieldError>
        </div>

        {/* Code field with auto-generation */}
        <div className="space-y-2">
          <Label htmlFor="workflow-code">
            Code <span className="text-destructive">*</span>
          </Label>
          <WithFieldError field="code" hideMessage>
            {(fe) => (
              <CodeInput
                data-field={fe.inputProps["data-field"]}
                id="workflow-code"
                sourceValue={name}
                value={codeInput.value}
                onChange={codeInput.onChange}
                error={fe.error ?? codeInput.error}
                format="kebab-case"
                placeholder="workflow-code"
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

        {/* Active toggle */}
        <div className="flex items-center justify-between rounded-lg border p-3">
          <div>
            <Label htmlFor="workflow-active" className="text-sm font-medium">
              Active
            </Label>
            <p className="text-muted-foreground text-xs">
              Active workflows process new enablement requests
            </p>
          </div>
          <Switch
            id="workflow-active"
            checked={active}
            onCheckedChange={setActive}
            disabled={isSubmitting}
          />
        </div>

        {/* Steps editor */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Approval Steps</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addStep}
              disabled={isSubmitting}
            >
              <Plus className="mr-1 h-3 w-3" />
              Add Step
            </Button>
          </div>

          {steps.length === 0 && (
            <p className="text-muted-foreground rounded-lg border border-dashed p-4 text-center text-sm">
              No steps defined. Add approval steps to configure the workflow.
            </p>
          )}

          {steps.map((step, index) => (
            <div key={step.key} className="space-y-3 rounded-lg border p-3">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-xs font-medium">Step {index + 1}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeStep(step.key)}
                  disabled={isSubmitting}
                  aria-label={`Remove step ${index + 1}`}
                  className="h-6 w-6 p-0"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  placeholder="Step name"
                  value={step.name}
                  onChange={(e) => updateStep(step.key, "name", e.target.value)}
                  disabled={isSubmitting}
                  required
                />
                <Select
                  value={step.type}
                  onValueChange={(val) => updateStep(step.key, "type", val)}
                  disabled={isSubmitting}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STEP_TYPE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ))}
        </div>

        {/* Description */}
        <div className="space-y-2">
          <Label>Description</Label>
          <WithFieldError field="description" value={description}>
            {(fe) => (
              <LocalizedStringInput
                {...fe.inputProps}
                value={description}
                onChange={setDescription}
                placeholder="Describe the workflow purpose"
                multiline
                disabled={isSubmitting}
              />
            )}
          </WithFieldError>
          <p className="text-muted-foreground text-xs">
            Multi-language description of the workflow.
          </p>
        </div>
      </div>
    </FormSheet>
  );
}
