/**
 * MetadataHierarchyFormSheet - Sheet for creating/editing Metadata Hierarchy Views.
 *
 * Wraps FormSheet with code (auto-generated), name, localized description and
 * the ordered level picker.
 */

import { parseLocalizedDescription } from "@loom-loyalty/core";
import type { CreateUpdateMetadataHierarchyViewData } from "@loom-loyalty/sdk";
import { useQueries } from "@tanstack/react-query";
import { useState, type FormEvent, type ReactNode } from "react";
import { CodeInput, useCodeInput } from "../../../forms/code-input.js";
import { WithFieldError } from "../../../forms/field-errors.js";
import { FormSheet } from "../../../forms/form-sheet.js";
import {
  LocalizedStringInput,
  type LocalizedString,
} from "../../../forms/localized-string-input.js";
import { metadataTypeChildrenQueryOptions } from "../../../forms/metadata-type-field/index.js";
import { Input } from "../../../primitives/input.js";
import { Label } from "../../../primitives/label.js";
import { validateHierarchyLevels } from "./format-hierarchy-levels.js";
import { MetadataHierarchyLevelsPicker } from "./metadata-hierarchy-levels-picker.js";
import type { MetadataHierarchyFormSheetProps } from "./types.js";

export function MetadataHierarchyFormSheet({
  open,
  onOpenChange,
  mode,
  initialData,
  onSubmit,
  isSubmitting = false,
  error,
  fieldErrors,
  onCreateType,
  onLinkChildType,
}: MetadataHierarchyFormSheetProps): ReactNode {
  const initialLevels = () => (initialData?.levels?.length ? [...initialData.levels] : [""]);
  const [name, setName] = useState(initialData?.name ?? "");
  const [description, setDescription] = useState<LocalizedString>(
    () => parseLocalizedDescription(initialData?.description) ?? {}
  );
  const [levels, setLevels] = useState<string[]>(initialLevels);
  const [showValidation, setShowValidation] = useState(false);

  // The child types of every chosen level but the last, to check that each
  // level is still linked under the one above (links can change elsewhere).
  const childQueries = useQueries({
    queries: levels
      .slice(0, -1)
      .map((code) => ({ ...metadataTypeChildrenQueryOptions(code), enabled: open && !!code })),
  });

  const codeInput = useCodeInput(name, {
    pattern: "resource",
    format: "kebab-case",
    initialValue: initialData?.code,
    locked: mode === "edit",
  });

  const levelsError = validateHierarchyLevels(levels, (index) => {
    if (index === 0) return null;
    const data = childQueries[index - 1]?.data;
    return data ? data.map((t) => t.code ?? "") : null;
  });

  const resetForm = () => {
    setName(initialData?.name ?? "");
    setDescription(parseLocalizedDescription(initialData?.description) ?? {});
    setLevels(initialLevels());
    setShowValidation(false);
    codeInput.reset();
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen && isSubmitting) return;
    if (!newOpen) resetForm();
    onOpenChange(newOpen);
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setShowValidation(true);
    if (levelsError) return;
    const hasDescription = Object.values(description).some((v) => v.trim() !== "");
    const data: CreateUpdateMetadataHierarchyViewData = {
      code: codeInput.value,
      name: name.trim(),
      levels,
      // The generated description type over-nests the locale map; the wire shape
      // is the plain `{ locale: text }` record the input produces.
      ...(hasDescription
        ? {
            description:
              description as unknown as CreateUpdateMetadataHierarchyViewData["description"],
          }
        : {}),
    };
    await onSubmit(data);
  };

  return (
    <FormSheet
      open={open}
      onOpenChange={handleOpenChange}
      title={
        mode === "create"
          ? "Create Metadata Hierarchy"
          : `Edit ${initialData?.name ?? "Metadata Hierarchy"}`
      }
      onSubmit={handleSubmit}
      submitDisabled={codeInput.error != null || !name.trim()}
      onCancel={() => handleOpenChange(false)}
      isSubmitting={isSubmitting}
      hideCloseButton={isSubmitting}
      submitLabel={mode === "create" ? "Create Metadata Hierarchy" : "Save Changes"}
      error={error}
      fieldErrors={fieldErrors}
    >
      <div className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="metadata-hierarchy-name">
            Name <span className="text-destructive">*</span>
          </Label>
          <WithFieldError field="name">
            {(fe) => (
              <Input
                {...fe.inputProps}
                id="metadata-hierarchy-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Store hierarchy"
                required
                disabled={isSubmitting}
              />
            )}
          </WithFieldError>
        </div>

        <div className="space-y-2">
          <Label htmlFor="metadata-hierarchy-code">
            Code <span className="text-destructive">*</span>
          </Label>
          <WithFieldError field="code" hideMessage>
            {(fe) => (
              <CodeInput
                data-field={fe.inputProps["data-field"]}
                id="metadata-hierarchy-code"
                sourceValue={name}
                value={codeInput.value}
                onChange={codeInput.onChange}
                error={fe.error ?? codeInput.error}
                format="kebab-case"
                placeholder="metadata-hierarchy-code"
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

        <div className="space-y-2">
          <Label>Description</Label>
          <WithFieldError field="description" value={description}>
            {(fe) => (
              <LocalizedStringInput
                {...fe.inputProps}
                value={description}
                onChange={setDescription}
                placeholder="Describe what this hierarchy organizes"
                multiline
                disabled={isSubmitting}
              />
            )}
          </WithFieldError>
        </div>

        <MetadataHierarchyLevelsPicker
          levels={levels}
          onLevelsChange={setLevels}
          onCreateType={onCreateType}
          onLinkChildType={onLinkChildType}
          disabled={isSubmitting}
        />
        {showValidation && levelsError && (
          <p role="alert" className="text-destructive text-sm">
            {levelsError}
          </p>
        )}
      </div>
    </FormSheet>
  );
}
