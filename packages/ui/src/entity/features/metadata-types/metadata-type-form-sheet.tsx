/**
 * MetadataTypeFormSheet - Sheet component for creating/editing MetadataTypes
 *
 * Uses CodeInput for code auto-generation and category select.
 */

import {
  type CreateMetadataType,
  type CreateMetadataTypeCategory,
  type DataModelType,
} from "@loom-loyalty/sdk";
import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { CodeInput, useCodeInput } from "../../../forms/code-input.js";
import { useAllDataModelTypes } from "../../../forms/data-model-field/use-all-data-model-types.js";
import { WithFieldError } from "../../../forms/field-errors.js";
import { FormSheet } from "../../../forms/form-sheet.js";
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
import { Textarea } from "../../../primitives/textarea.js";
import { sameDataModelCode } from "../data-models/code-key.js";
import { METADATA_TYPE_CATEGORY_OPTIONS, type MetadataTypeFormSheetProps } from "./types.js";

// Radix Select can't hold an empty value, so "no data model" needs a stand-in.
const NO_DATA_MODEL = "__none__";

/**
 * Sheet component for creating and editing MetadataTypes.
 */
export function MetadataTypeFormSheet({
  open,
  onOpenChange,
  mode,
  initialData,
  onSubmit,
  isSubmitting = false,
  error,
  fieldErrors,
}: MetadataTypeFormSheetProps): ReactNode {
  const [name, setName] = useState(initialData?.name ?? "");
  const [category, setCategory] = useState<string>(initialData?.category ?? "METADATA");
  const [description, setDescription] = useState(
    () => (initialData?.description as Record<string, string> | undefined)?.en ?? ""
  );
  const [searchable, setSearchable] = useState(initialData?.searchable ?? false);
  const [dataModelCode, setDataModelCode] = useState(initialData?.dataModelCode ?? "");

  // Only METADATA-category types take a data model of their own. The choices
  // are the tenant's custom models built on the shared `metadata` model.
  const linksDataModel = category === "METADATA";
  const dataModelTypesQuery = useAllDataModelTypes(open && linksDataModel);
  const dataModelTypes: DataModelType[] = dataModelTypesQuery.items;
  const dataModelOptions = useMemo(
    () =>
      dataModelTypes.filter(
        (t) => !t.system && sameDataModelCode(t.parentTypeReference, "metadata")
      ),
    [dataModelTypes]
  );
  // A link to a system model (COUNTRY to `country`) is fixed by the platform.
  // Until the list loads there is no telling, so the field stays out of the update.
  const storedLink = initialData?.dataModelCode ?? "";
  const isLinkFixed =
    mode === "edit" &&
    !!storedLink &&
    (dataModelTypesQuery.isLoading ||
      dataModelTypesQuery.isError ||
      dataModelTypes.some((t) => t.system && sameDataModelCode(t.code, storedLink)));

  const codeInput = useCodeInput(name, {
    format: "kebab-case",
    initialValue: initialData?.code,
    locked: mode === "edit",
  });

  const resetForm = () => {
    setName(initialData?.name ?? "");
    setCategory(initialData?.category ?? "METADATA");
    setDescription((initialData?.description as Record<string, string> | undefined)?.en ?? "");
    setSearchable(initialData?.searchable ?? false);
    setDataModelCode(initialData?.dataModelCode ?? "");
    codeInput.reset();
  };

  // Reset on every open: the parent may close the sheet itself after a
  // successful submit, which bypasses handleOpenChange.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) resetForm();
  }

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      resetForm();
    }
    onOpenChange(newOpen);
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const formData: CreateMetadataType = {
      name,
      code: codeInput.value,
      category: category as CreateMetadataTypeCategory,
      searchable,
      ...(description.trim() ? { description: { en: description } } : {}),
      // On update an empty string clears the link and an omitted field keeps it.
      ...(linksDataModel && !isLinkFixed && (dataModelCode || mode === "edit")
        ? { dataModelCode }
        : {}),
    };

    await onSubmit(formData);
  };

  const handleCancel = () => {
    handleOpenChange(false);
  };

  const title =
    mode === "create" ? "Create Metadata Type" : `Edit ${initialData?.name ?? "Metadata Type"}`;
  const submitLabel = mode === "create" ? "Create Metadata Type" : "Save Changes";

  return (
    <FormSheet
      open={open}
      onOpenChange={handleOpenChange}
      title={title}
      onSubmit={handleSubmit}
      onCancel={handleCancel}
      isSubmitting={isSubmitting}
      submitLabel={submitLabel}
      error={error}
      fieldErrors={fieldErrors}
    >
      <div className="space-y-6">
        {/* Name */}
        <div className="space-y-2">
          <Label htmlFor="metadata-type-name">
            Name <span className="text-destructive">*</span>
          </Label>
          <WithFieldError field="name">
            {(fe) => (
              <Input
                {...fe.inputProps}
                id="metadata-type-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter metadata type name"
                required
                disabled={isSubmitting}
              />
            )}
          </WithFieldError>
        </div>

        {/* Code */}
        <div className="space-y-2">
          <Label htmlFor="metadata-type-code">
            Code <span className="text-destructive">*</span>
          </Label>
          <WithFieldError field="code" hideMessage>
            {(fe) => (
              <CodeInput
                data-field={fe.inputProps["data-field"]}
                error={fe.error}
                id="metadata-type-code"
                sourceValue={name}
                value={codeInput.value}
                onChange={codeInput.onChange}
                format="kebab-case"
                placeholder="metadata-type-code"
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

        {/* Category */}
        <div className="space-y-2">
          <Label htmlFor="metadata-type-category">
            Category <span className="text-destructive">*</span>
          </Label>
          <WithFieldError field="category" value={category}>
            {(fe) => (
              <Select
                value={category}
                onValueChange={setCategory}
                disabled={isSubmitting || mode === "edit"}
              >
                <SelectTrigger {...fe.inputProps} id="metadata-type-category">
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {METADATA_TYPE_CATEGORY_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </WithFieldError>
          <p className="text-muted-foreground text-xs">
            Determines the kind of metadata values this type can hold.
          </p>
        </div>

        {linksDataModel && (
          <div className="space-y-2">
            <Label htmlFor="metadata-type-data-model">Data model</Label>
            <WithFieldError field="dataModelCode" value={dataModelCode}>
              {(fe) => (
                <Select
                  value={dataModelCode || NO_DATA_MODEL}
                  onValueChange={(value) => setDataModelCode(value === NO_DATA_MODEL ? "" : value)}
                  disabled={
                    isSubmitting ||
                    isLinkFixed ||
                    dataModelTypesQuery.isLoading ||
                    dataModelTypesQuery.isError
                  }
                >
                  <SelectTrigger
                    {...fe.inputProps}
                    id="metadata-type-data-model"
                    aria-describedby={[
                      fe.inputProps["aria-describedby"],
                      "metadata-type-data-model-help",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    <SelectValue placeholder="Shared metadata model" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_DATA_MODEL}>Shared metadata model</SelectItem>
                    {dataModelCode &&
                      !dataModelOptions.some((t) => sameDataModelCode(t.code, dataModelCode)) && (
                        <SelectItem value={dataModelCode}>{dataModelCode}</SelectItem>
                      )}
                    {dataModelOptions.map((t) => (
                      <SelectItem key={t.code} value={t.code}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </WithFieldError>
            <p id="metadata-type-data-model-help" className="text-muted-foreground text-xs">
              {dataModelTypesQuery.isError
                ? "Data models could not be loaded, so the link can't be changed right now."
                : isLinkFixed && !dataModelTypesQuery.isLoading
                  ? "The platform sets this type's data model."
                  : "Values of this type get the chosen model's fields, and are checked against it on save."}
            </p>
          </div>
        )}

        {/* Searchable toggle */}
        <div className="space-y-4">
          <h3 className="text-foreground text-sm font-medium">Settings</h3>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label htmlFor="metadata-type-searchable" className="text-sm font-medium">
                Searchable
              </Label>
              <p className="text-muted-foreground text-xs">
                Enable search indexing for metadata values of this type
              </p>
            </div>
            <Switch
              id="metadata-type-searchable"
              checked={searchable}
              onCheckedChange={setSearchable}
              disabled={isSubmitting}
            />
          </div>
        </div>

        {/* Description */}
        <div className="space-y-2">
          <Label htmlFor="metadata-type-description">Description</Label>
          <WithFieldError field="description">
            {(fe) => (
              <Textarea
                {...fe.inputProps}
                id="metadata-type-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the purpose of this metadata type"
                disabled={isSubmitting}
                rows={3}
              />
            )}
          </WithFieldError>
        </div>
      </div>
    </FormSheet>
  );
}
