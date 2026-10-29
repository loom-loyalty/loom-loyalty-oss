/**
 * MetadataFormSheet - Sheet component for creating/editing Metadata values
 *
 * Uses CodeInput for code auto-generation and canonical compound widgets
 * (MetadataTypeField) for type selection.
 */

import { useQuery } from "@tanstack/react-query";
import { useState, type FormEvent, type ReactNode } from "react";
import { CodeInput, useCodeInput } from "../../../forms/code-input.js";
import { WithFieldError } from "../../../forms/field-errors.js";
import { FormSheet } from "../../../forms/form-sheet.js";
import {
  LocalizedStringInput,
  type LocalizedString,
} from "../../../forms/localized-string-input.js";
import { MetadataField } from "../../../forms/metadata-field/index.js";
import {
  MetadataSubTypeFields,
  buildMetadataSubTypePayload,
  isMetadataSubTypeCategory,
  readMetadataSubTypeValues,
  useMetadataSubTypeOptions,
  useMetadataTypeCategory,
  validateMetadataSubType,
  type MetadataSubTypeFieldName,
  type MetadataSubTypeValues,
} from "../../../forms/metadata-sub-type-fields/index.js";
import {
  MetadataTypeField,
  metadataTypeParentsQueryOptions,
} from "../../../forms/metadata-type-field/index.js";
import { Input } from "../../../primitives/input.js";
import { Label } from "../../../primitives/label.js";
import { Skeleton } from "../../../primitives/skeleton.js";
import { extractExtendedFields } from "../../entity-field-utils.js";
import { ExtendedFieldsSection } from "../../extended-fields-section.js";
import type { MetadataFormSheetProps, MetadataSubmitData } from "./types.js";

/**
 * Sheet component for creating and editing Metadata.
 */
export function MetadataFormSheet({
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
  onTypeCodeChange,
  schemaUnavailableMessage,
  typeCategory,
  entityLabel = "Metadata",
}: MetadataFormSheetProps): ReactNode {
  const [name, setName] = useState(initialData?.name ?? "");
  const [typeCode, setTypeCode] = useState(initialData?.typeCode ?? "");
  // Create mode only: the parent picked for each parent type of the chosen type.
  // Links aren't part of the metadata body; the caller makes them after create.
  const [parentCodes, setParentCodes] = useState<Record<string, string>>({});
  // The shared query options, so this cache entry has the same shape every
  // other reader of a type's parents expects.
  const parentTypesQuery = useQuery({
    ...metadataTypeParentsQueryOptions(typeCode),
    enabled: open && mode === "create" && !!typeCode,
  });
  const parentTypes = parentTypesQuery.data ?? [];
  const [description, setDescription] = useState<LocalizedString>(
    () => (initialData?.description as LocalizedString | undefined) ?? {}
  );

  const [extendedFieldValues, setExtendedFieldValues] = useState<Record<string, unknown>>(() =>
    extractExtendedFields(initialData, extendedFields)
  );
  // The field list can change after open: the caller may load the chosen type's
  // own data model. Seed newly listed fields from the stored entry and keep
  // anything already typed.
  const extendedFieldsKey = extendedFields.join("\u0000");
  const [seededFieldsKey, setSeededFieldsKey] = useState(extendedFieldsKey);
  if (extendedFieldsKey !== seededFieldsKey) {
    setSeededFieldsKey(extendedFieldsKey);
    setExtendedFieldValues((prev) => ({
      ...extractExtendedFields(initialData, extendedFields),
      ...prev,
    }));
  }
  const [subTypeValues, setSubTypeValues] = useState<MetadataSubTypeValues>(() =>
    readMetadataSubTypeValues(initialData)
  );
  const [subTypeErrors, setSubTypeErrors] = useState<Record<string, string>>({});

  // The category comes from the entry's metadata TYPE, never off the entry —
  // Metadata is a oneOf with no discriminator, so a Location and a plain
  // Metadata are indistinguishable once loaded.
  const {
    category,
    isLoading: isCategoryLoading,
    isTypeNotFound,
  } = useMetadataTypeCategory(typeCode);

  // Only LOCATION, ITEM, and DATA_TYPE add fields of their own; METADATA and
  // COUNTRY have none to render, validate, or emit.
  const subTypeCategory = isMetadataSubTypeCategory(category) ? category : undefined;
  const subTypeOptions = useMetadataSubTypeOptions(typeCode, subTypeCategory);

  const codeInput = useCodeInput(name, {
    format: "kebab-case",
    initialValue: initialData?.code,
    locked: mode === "edit",
  });

  const handleExtendedFieldChange = (field: string, value: unknown) => {
    setExtendedFieldValues((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSubTypeChange = (field: MetadataSubTypeFieldName, value: string) => {
    setSubTypeValues((prev) => ({ ...prev, [field]: value }));
    setSubTypeErrors((prev) => (prev[field] ? { ...prev, [field]: "" } : prev));
  };

  const resetForm = () => {
    setName(initialData?.name ?? "");
    setTypeCode(initialData?.typeCode ?? "");
    setParentCodes({});
    setDescription((initialData?.description as LocalizedString | undefined) ?? {});
    codeInput.reset();
    setExtendedFieldValues(extractExtendedFields(initialData, extendedFields));
    setSubTypeValues(readMetadataSubTypeValues(initialData));
    setSubTypeErrors({});
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

    // Without a resolved category there is no way to know which endpoint the
    // entry belongs to. Guessing METADATA would post a Location body to
    // /metadata, which succeeds while dropping every address field.
    if (!category) {
      // A type code that 404s can never resolve a category. Asking the user to
      // pick one would point at a field that is disabled in edit mode, so say
      // what actually went wrong instead.
      let message = "Select a metadata type before saving.";
      if (isCategoryLoading) {
        message = "Still loading this metadata type — try again in a moment.";
      } else if (isTypeNotFound) {
        message = "This metadata type could not be found.";
      }
      setSubTypeErrors({ typeCode: message });
      return;
    }

    // The extended fields aren't final yet; a write now would drop the missing ones.
    if (schemaUnavailableMessage) {
      setSubTypeErrors({ typeCode: schemaUnavailableMessage });
      return;
    }

    if (subTypeCategory) {
      const validationErrors = validateMetadataSubType(subTypeValues, subTypeCategory);
      if (Object.keys(validationErrors).length > 0) {
        setSubTypeErrors(validationErrors);
        return;
      }
    }

    // Only include description if at least one locale has non-empty content.
    // LocalizedStringInput already strips empty locales on change, but we
    // re-check here so an all-empty initialData doesn't ship an empty object.
    const hasDescription = Object.values(description).some((v) => v.trim() !== "");

    const formData = {
      name,
      code: codeInput.value,
      typeCode,
      ...(hasDescription ? { description } : {}),
      // Every metadata write is a replacement, so a field the body omits is
      // destroyed. No input renders the validity period — carry the stored one
      // through unchanged. The sub-type fields do the same for their own.
      ...(initialData?.dateTimePeriod ? { dateTimePeriod: initialData.dateTimePeriod } : {}),
      // Links are edited under Relationships, so keep a stored legacy parent.
      ...(mode === "edit" && initialData?.parentCode ? { parentCode: initialData.parentCode } : {}),
      ...(subTypeCategory ? buildMetadataSubTypePayload(subTypeValues, subTypeCategory) : {}),
      // Only the fields the current model lists; values typed for a type picked earlier stay out.
      ...Object.fromEntries(
        Object.entries(extendedFieldValues).filter(([field]) => extendedFields.includes(field))
      ),
    } as MetadataSubmitData;

    setSubTypeErrors({});
    // Only parents of the chosen type's parent types; a type switch leaves stale picks behind.
    const parentTypeCodes = new Set(parentTypes.map((t) => t.code));
    const parents = Object.fromEntries(
      Object.entries(parentCodes).filter(
        ([parentTypeCode, parentCode]) => parentCode && parentTypeCodes.has(parentTypeCode)
      )
    );
    await onSubmit(formData, category, mode === "create" ? parents : {});
  };

  const handleCancel = () => {
    handleOpenChange(false);
  };

  const title =
    mode === "create" ? `Create ${entityLabel}` : `Edit ${initialData?.name ?? entityLabel}`;
  const submitLabel = mode === "create" ? `Create ${entityLabel}` : "Save Changes";

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
          <Label htmlFor="metadata-name">
            Name <span className="text-destructive">*</span>
          </Label>
          <WithFieldError field="name">
            {(fe) => (
              <Input
                {...fe.inputProps}
                id="metadata-name"
                data-widget="text-input"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter metadata name"
                required
                disabled={isSubmitting}
              />
            )}
          </WithFieldError>
        </div>

        {/* Code */}
        <div className="space-y-2">
          <Label htmlFor="metadata-code">
            Code <span className="text-destructive">*</span>
          </Label>
          <WithFieldError field="code" hideMessage>
            {(fe) => (
              <CodeInput
                data-field={fe.inputProps["data-field"]}
                error={fe.error}
                id="metadata-code"
                sourceValue={name}
                value={codeInput.value}
                onChange={codeInput.onChange}
                format="kebab-case"
                placeholder="metadata-code"
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

        {/* Type Code */}
        <div className="space-y-2">
          <Label htmlFor="metadata-type-code">
            Type Code <span className="text-destructive">*</span>
          </Label>
          <WithFieldError field="typeCode" value={typeCode}>
            {(fe) => (
              <MetadataTypeField
                {...fe.inputProps}
                id="metadata-type-code"
                value={typeCode}
                onValueChange={(value) => {
                  setTypeCode(value);
                  onTypeCodeChange?.(value);
                  // Clear the parents — they belong to the previous type's parent types.
                  // Sub-type values go with it: the new type may not have those fields at all.
                  if (value !== typeCode) {
                    setParentCodes({});
                    setSubTypeValues({});
                    setSubTypeErrors({});
                  }
                }}
                disabled={isSubmitting || mode === "edit"}
                aria-invalid={fe.error ? true : !!subTypeErrors.typeCode}
                aria-required
                category={typeCategory}
              />
            )}
          </WithFieldError>
          {subTypeErrors.typeCode ? (
            <p className="text-destructive text-xs" role="alert">
              {subTypeErrors.typeCode}
            </p>
          ) : (
            <p className="text-muted-foreground text-xs">
              The metadata type this value belongs to.
            </p>
          )}
        </div>

        {/* Parents — one per parent type of the chosen type */}
        {mode === "edit" ? (
          <p className="text-muted-foreground text-xs">
            Set this entry&apos;s parents and children under Relationships in its details.
          </p>
        ) : typeCode && parentTypesQuery.isLoading ? (
          <Skeleton className="h-10 w-full" />
        ) : typeCode && parentTypesQuery.isError ? (
          <p role="alert" className="text-destructive text-sm">
            Couldn&apos;t load this type&apos;s parent types, so parents can&apos;t be set here.
          </p>
        ) : (
          typeCode &&
          parentTypes.map((parentType) => {
            const parentTypeCode = parentType.code ?? "";
            const parentName = parentType.name || parentTypeCode;
            return (
              <div key={parentTypeCode} className="space-y-2">
                <Label htmlFor={`metadata-parent-${parentTypeCode}`}>{parentName}</Label>
                <MetadataField
                  id={`metadata-parent-${parentTypeCode}`}
                  typeCode={parentTypeCode}
                  typeLabel={parentName}
                  value={parentCodes[parentTypeCode] ?? ""}
                  onValueChange={(value) =>
                    setParentCodes((prev) => ({ ...prev, [parentTypeCode]: value }))
                  }
                  placeholder={`Optional ${parentName}`}
                  disabled={isSubmitting}
                  showCreateNew={false}
                />
              </div>
            );
          })
        )}

        {/* Sub-type fields — Location, Item, and Data Type carry their own. */}
        {subTypeCategory && (
          <MetadataSubTypeFields
            category={subTypeCategory}
            values={subTypeValues}
            onChange={handleSubTypeChange}
            errors={subTypeErrors}
            disabled={isSubmitting}
            dataModelOptions={subTypeOptions.dataModelOptions}
            isLoadingDataModels={subTypeOptions.isLoadingDataModels}
            countryOptions={subTypeOptions.countryOptions}
            isLoadingCountries={subTypeOptions.isLoadingCountries}
          />
        )}

        {/* Description */}
        <div className="space-y-2">
          <Label htmlFor="metadata-description">Description</Label>
          <WithFieldError field="description" value={description}>
            {(fe) => (
              <LocalizedStringInput
                {...fe.inputProps}
                id="metadata-description"
                value={description}
                onChange={setDescription}
                placeholder="Describe this metadata value"
                multiline
                disabled={isSubmitting}
              />
            )}
          </WithFieldError>
          <p className="text-muted-foreground text-xs">
            Multi-language description. Add translations as needed.
          </p>
        </div>

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
