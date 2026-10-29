/**
 * EventTypeConfigFormSheet - Sheet component for creating/editing Event Type Configurations
 *
 * Wraps FormSheet with event-type-configuration-specific form fields and logic.
 * Uses CodeInput for code auto-generation (upper-snake-case).
 * Uses MetadataField for event type selection (EVENT_TYPE suggested options).
 * Uses LocalizedStringInput for multi-language description support.
 * Supports extended fields from data model extensions.
 */

import type { CreateEventTypeConfiguration, EventTypeConfiguration } from "@loom-loyalty/sdk";
import { useCallback, useState, type FormEvent, type ReactNode } from "react";
import { CodeInput, useCodeInput } from "../../../forms/code-input.js";
import { WithFieldError } from "../../../forms/field-errors.js";
import { FormSheet } from "../../../forms/form-sheet.js";
import {
  LocalizedStringInput,
  type LocalizedString,
} from "../../../forms/localized-string-input.js";
import { MetadataField, useMetadataField } from "../../../forms/metadata-field/index.js";
import { Checkbox } from "../../../primitives/checkbox.js";
import { Input } from "../../../primitives/input.js";
import { Label } from "../../../primitives/label.js";
import { extractExtendedFields } from "../../entity-field-utils.js";
import { ExtendedFieldsSection } from "../../extended-fields-section.js";
import type { EventTypeConfigFormSheetProps } from "./types.js";

export function getInitialEventTypeCode(initialData?: EventTypeConfiguration): string {
  if (!initialData) return "";
  if (initialData.eventTypeCode) return initialData.eventTypeCode;
  const resolved = initialData.eventType as { code?: string } | undefined;
  return resolved?.code ?? "";
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
 * Sheet component for creating and editing Event Type Configurations.
 */
export function EventTypeConfigFormSheet({
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
  lockEventType = false,
}: EventTypeConfigFormSheetProps): ReactNode {
  // Local validation error (separate from parent error prop)
  const [formError, setFormError] = useState<string | null>(null);

  // Form state - standard fields
  const [name, setName] = useState(initialData?.name ?? "");
  const [eventTypeCode, setEventTypeCode] = useState(getInitialEventTypeCode(initialData));
  const [eventSubTypeIdentifier, setEventSubTypeIdentifier] = useState(
    initialData?.eventSubTypeIdentifier ?? ""
  );
  const [synchronous, setSynchronous] = useState(initialData?.synchronous ?? false);
  const [saveUnprocessedEvent, setSaveUnprocessedEvent] = useState(
    initialData?.saveUnprocessedEvent ?? false
  );
  const [processedDaysTillArchival, setProcessedDaysTillArchival] = useState<number | undefined>(
    initialData?.processedDaysTillArchival
  );
  const [unprocessedDaysTillArchival, setUnprocessedDaysTillArchival] = useState<
    number | undefined
  >(initialData?.unprocessedDaysTillArchival);
  const [defaultEventDescription, setDefaultEventDescription] = useState(
    initialData?.defaultEventDescription ?? ""
  );
  const [eventDescriptionJsonPath, setEventDescriptionJsonPath] = useState(
    initialData?.eventDescriptionJsonPath ?? ""
  );
  const [description, setDescription] = useState<LocalizedString>(
    () => getLocalizedDescription(initialData?.description) ?? {}
  );

  // Extended fields state
  const [extendedFieldValues, setExtendedFieldValues] = useState<Record<string, unknown>>(() =>
    extractExtendedFields(initialData, extendedFields)
  );

  // Code auto-generation using useCodeInput hook
  const codeInput = useCodeInput(name, {
    pattern: "event-type",
    format: "dot-case",
    initialValue: initialData?.code,
    locked: mode === "edit",
  });

  // Metadata field hook for auto-creating suggested EVENT_TYPE metadata
  const { createMetadata, findOption, isTypeNotFound } = useMetadataField("EVENT_TYPE");

  // Track whether the selected event type is a suggested (not-yet-created) option
  const [typeIsSuggested, setTypeIsSuggested] = useState(false);

  // Handle extended field changes
  const handleExtendedFieldChange = useCallback((field: string, value: unknown) => {
    setExtendedFieldValues((prev) => ({
      ...prev,
      [field]: value,
    }));
  }, []);

  // Reset form when sheet opens/closes or initialData changes
  const resetForm = useCallback(() => {
    setFormError(null);
    setName(initialData?.name ?? "");
    setEventTypeCode(getInitialEventTypeCode(initialData));
    setTypeIsSuggested(false);
    setEventSubTypeIdentifier(initialData?.eventSubTypeIdentifier ?? "");
    setSynchronous(initialData?.synchronous ?? false);
    setSaveUnprocessedEvent(initialData?.saveUnprocessedEvent ?? false);
    setProcessedDaysTillArchival(initialData?.processedDaysTillArchival);
    setUnprocessedDaysTillArchival(initialData?.unprocessedDaysTillArchival);
    setDefaultEventDescription(initialData?.defaultEventDescription ?? "");
    setEventDescriptionJsonPath(initialData?.eventDescriptionJsonPath ?? "");
    setDescription(getLocalizedDescription(initialData?.description) ?? {});
    codeInput.reset();
    setExtendedFieldValues(extractExtendedFields(initialData, extendedFields));
  }, [initialData, extendedFields, codeInput]);

  // Handle open change with form reset
  const handleOpenChange = useCallback(
    (newOpen: boolean) => {
      if (!newOpen) {
        resetForm();
      }
      onOpenChange(newOpen);
    },
    [resetForm, onOpenChange]
  );

  // Handle submit
  const handleSubmit = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setFormError(null);

      if (!name.trim()) {
        setFormError("Name is required.");
        return;
      }

      if (!codeInput.value.trim()) {
        setFormError("Code is required.");
        return;
      }

      if (!eventTypeCode) {
        setFormError("Event type is required.");
        return;
      }

      // Auto-create suggested metadata if needed.
      // Skip when the metadata type itself is not found (404).
      if (typeIsSuggested && !isTypeNotFound && !findOption(eventTypeCode)) {
        await createMetadata({
          code: eventTypeCode,
          name: eventTypeCode,
          description: undefined,
        });
      }

      // Only include description if it has content
      const hasDescription = Object.values(description).some((v) => v.trim() !== "");

      const formData: CreateEventTypeConfiguration & Record<string, unknown> = {
        name,
        code: codeInput.value,
        eventTypeCode,
        description: hasDescription ? description : undefined,
        ...(eventSubTypeIdentifier ? { eventSubTypeIdentifier } : {}),
        synchronous,
        saveUnprocessedEvent,
        ...(processedDaysTillArchival != null ? { processedDaysTillArchival } : {}),
        ...(unprocessedDaysTillArchival != null ? { unprocessedDaysTillArchival } : {}),
        ...(defaultEventDescription ? { defaultEventDescription } : {}),
        ...(eventDescriptionJsonPath ? { eventDescriptionJsonPath } : {}),
        ...extendedFieldValues,
      };

      await onSubmit(formData);
    },
    [
      name,
      codeInput.value,
      eventTypeCode,
      eventSubTypeIdentifier,
      synchronous,
      saveUnprocessedEvent,
      processedDaysTillArchival,
      unprocessedDaysTillArchival,
      defaultEventDescription,
      eventDescriptionJsonPath,
      description,
      extendedFieldValues,
      typeIsSuggested,
      isTypeNotFound,
      findOption,
      createMetadata,
      onSubmit,
    ]
  );

  const handleCancel = useCallback(() => {
    handleOpenChange(false);
  }, [handleOpenChange]);

  // R7 / KTD4: lock the Event Type field on the create form only, so a
  // caller pre-binding `initialData.eventTypeCode` (e.g. the anchor's
  // "+ Add Configuration" entry point) guarantees the user cannot change it.
  const eventTypeLocked = lockEventType && mode === "create";

  const title =
    mode === "create"
      ? "Create Event Type Configuration"
      : `Edit ${initialData?.name ?? "Event Type Configuration"}`;
  const submitLabel = mode === "create" ? "Create Configuration" : "Save Changes";

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
          <Label htmlFor="event-type-config-name">
            Name <span className="text-destructive">*</span>
          </Label>
          <WithFieldError field="name">
            {(fe) => (
              <Input
                {...fe.inputProps}
                id="event-type-config-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter configuration name"
                required
                disabled={isSubmitting}
              />
            )}
          </WithFieldError>
        </div>

        {/* Code field with auto-generation */}
        <div className="space-y-2">
          <Label htmlFor="event-type-config-code">
            Code <span className="text-destructive">*</span>
          </Label>
          <WithFieldError field="code" hideMessage>
            {(fe) => (
              <CodeInput
                data-field={fe.inputProps["data-field"]}
                id="event-type-config-code"
                sourceValue={name}
                value={codeInput.value}
                onChange={codeInput.onChange}
                error={fe.error ?? codeInput.error}
                format="dot-case"
                placeholder="event-type-config.code"
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

        {/* Event Type (MetadataField) */}
        <div className="space-y-2">
          <Label>
            Event Type <span className="text-destructive">*</span>
          </Label>
          <WithFieldError field="eventTypeCode" value={eventTypeCode}>
            {(fe) => (
              <MetadataField
                {...fe.inputProps}
                typeCode="EVENT_TYPE"
                typeLabel="Event Type"
                value={eventTypeCode}
                onValueChange={(value, isSuggested) => {
                  setEventTypeCode(value);
                  setTypeIsSuggested(isSuggested);
                }}
                placeholder="Select event type..."
                disabled={isSubmitting || eventTypeLocked}
              />
            )}
          </WithFieldError>
        </div>

        {/* Sub Type Identifier */}
        <div className="space-y-2">
          <Label htmlFor="event-sub-type-identifier">Sub Type Identifier</Label>
          <WithFieldError field="eventSubTypeIdentifier">
            {(fe) => (
              <Input
                {...fe.inputProps}
                id="event-sub-type-identifier"
                type="text"
                value={eventSubTypeIdentifier}
                onChange={(e) => setEventSubTypeIdentifier(e.target.value)}
                placeholder="e.g. PURCHASE, RETURN"
                disabled={isSubmitting}
              />
            )}
          </WithFieldError>
          <p className="text-muted-foreground text-xs">
            Optional sub-type to further categorize events.
          </p>
        </div>

        {/* Description with LocalizedStringInput */}
        <div className="space-y-2">
          <Label>Description</Label>
          <WithFieldError field="description" value={description}>
            {(fe) => (
              <LocalizedStringInput
                {...fe.inputProps}
                value={description}
                onChange={setDescription}
                placeholder="Describe this event type configuration"
                multiline
                disabled={isSubmitting}
              />
            )}
          </WithFieldError>
        </div>

        {/* Processing Settings */}
        <div className="bg-muted/50 space-y-4 rounded-lg border p-4">
          <h4 className="text-foreground text-sm font-medium">Processing Settings</h4>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Checkbox
                id="synchronous"
                checked={synchronous}
                onCheckedChange={(checked) => setSynchronous(checked === true)}
                disabled={isSubmitting}
              />
              <Label htmlFor="synchronous" className="cursor-pointer font-normal">
                Synchronous processing
              </Label>
            </div>
            <p className="text-muted-foreground text-xs">
              When enabled, events are processed immediately in the request flow.
            </p>
            <div className="flex items-center gap-2">
              <Checkbox
                id="save-unprocessed"
                checked={saveUnprocessedEvent}
                onCheckedChange={(checked) => setSaveUnprocessedEvent(checked === true)}
                disabled={isSubmitting}
              />
              <Label htmlFor="save-unprocessed" className="cursor-pointer font-normal">
                Save unprocessed events
              </Label>
            </div>
            <p className="text-muted-foreground text-xs">
              When enabled, events that fail processing are saved for later review.
            </p>
          </div>
        </div>

        {/* Archival Settings */}
        <div className="bg-muted/50 space-y-4 rounded-lg border p-4">
          <h4 className="text-foreground text-sm font-medium">Archival Settings</h4>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="processed-days">Processed Days Till Archival</Label>
              <WithFieldError field="processedDaysTillArchival">
                {(fe) => (
                  <Input
                    {...fe.inputProps}
                    id="processed-days"
                    type="number"
                    min={0}
                    value={processedDaysTillArchival ?? ""}
                    onChange={(e) =>
                      setProcessedDaysTillArchival(
                        e.target.value ? Number(e.target.value) : undefined
                      )
                    }
                    placeholder="e.g. 90"
                    disabled={isSubmitting}
                  />
                )}
              </WithFieldError>
            </div>
            <div className="space-y-2">
              <Label htmlFor="unprocessed-days">Unprocessed Days Till Archival</Label>
              <WithFieldError field="unprocessedDaysTillArchival">
                {(fe) => (
                  <Input
                    {...fe.inputProps}
                    id="unprocessed-days"
                    type="number"
                    min={0}
                    value={unprocessedDaysTillArchival ?? ""}
                    onChange={(e) =>
                      setUnprocessedDaysTillArchival(
                        e.target.value ? Number(e.target.value) : undefined
                      )
                    }
                    placeholder="e.g. 30"
                    disabled={isSubmitting}
                  />
                )}
              </WithFieldError>
            </div>
          </div>
        </div>

        {/* Event Description */}
        <div className="bg-muted/50 space-y-4 rounded-lg border p-4">
          <h4 className="text-foreground text-sm font-medium">Event Description</h4>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="default-event-description">Default Event Description</Label>
              <WithFieldError field="defaultEventDescription">
                {(fe) => (
                  <Input
                    {...fe.inputProps}
                    id="default-event-description"
                    type="text"
                    value={defaultEventDescription}
                    onChange={(e) => setDefaultEventDescription(e.target.value)}
                    placeholder="Default description for events of this type"
                    disabled={isSubmitting}
                  />
                )}
              </WithFieldError>
            </div>
            <div className="space-y-2">
              <Label htmlFor="event-description-json-path">Event Description JSON Path</Label>
              <WithFieldError field="eventDescriptionJsonPath">
                {(fe) => (
                  <Input
                    {...fe.inputProps}
                    id="event-description-json-path"
                    type="text"
                    value={eventDescriptionJsonPath}
                    onChange={(e) => setEventDescriptionJsonPath(e.target.value)}
                    placeholder="$.data.description"
                    className="font-mono"
                    disabled={isSubmitting}
                  />
                )}
              </WithFieldError>
              <p className="text-muted-foreground text-xs">
                JSON path expression to extract event description from the event payload.
              </p>
            </div>
          </div>
        </div>

        {/* Extended Fields Section (from data model extensions) */}
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
