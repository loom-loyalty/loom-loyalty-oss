/**
 * Event Type Configuration Feature Types
 *
 * Centralized type definitions for the event-type-configurations feature.
 * Keeps types in a dedicated file per CLAUDE.md guidelines.
 */

import type { UIEntitySchema } from "@loom-loyalty/schema";
import type {
  CreateEventTypeConfiguration,
  EventTypeConfiguration,
  UpdateEventTypeConfiguration,
} from "@loom-loyalty/sdk";
import type { FormFieldError } from "../../../forms/field-errors.js";
import type { FormSheetError } from "../../../forms/form-sheet.js";

/**
 * Localized string type - a map of language codes to string values.
 * Used for multi-language descriptions.
 */
export type LocalizedString = Record<string, string>;

/**
 * Form data for event type configuration creation/editing.
 */
export interface EventTypeConfigFormData {
  name: string;
  code: string;
  description: LocalizedString;
  eventTypeCode: string;
  eventSubTypeIdentifier?: string;
  synchronous: boolean;
  saveUnprocessedEvent: boolean;
  processedDaysTillArchival?: number;
  unprocessedDaysTillArchival?: number;
  defaultEventDescription?: string;
  eventDescriptionJsonPath?: string;
  extendedFields?: Record<string, unknown>;
}

/**
 * Props for the EventTypeConfigFormSheet component.
 */
export interface EventTypeConfigFormSheetProps {
  /** Whether the sheet is open */
  open: boolean;
  /** Callback when open state changes */
  onOpenChange: (open: boolean) => void;
  /** Mode: create or edit */
  mode: "create" | "edit";
  /** Initial data for editing (required for edit mode) */
  initialData?: EventTypeConfiguration;
  /** Submit handler */
  onSubmit: (data: CreateEventTypeConfiguration | UpdateEventTypeConfiguration) => Promise<void>;
  /** Whether the form is submitting */
  isSubmitting?: boolean;
  /** Error to display; a `describeError` result also shows its support reference */
  error?: FormSheetError | null;
  /** Server field errors; each shows under its field, the rest with `error` */
  fieldErrors?: readonly FormFieldError[];
  /** Schema for rendering extended fields (optional) */
  schema?: UIEntitySchema;
  /** Extended field names to render (beyond standard fields) */
  extendedFields?: string[];
  /**
   * Pre-bind and lock the Event Type field on the create form (R7). When
   * true and `mode === "create"`, the Event Type `MetadataField` renders
   * disabled so a caller that seeds `initialData.eventTypeCode` (e.g. the
   * "+ Add Configuration" entry point opened from an Event Type anchor) is
   * guaranteed the user cannot change the event type away from the anchor
   * they opened it from. Seeding `initialData` alone leaves the field
   * editable — this prop is required to actually lock it (KTD4). No effect
   * in edit mode.
   */
  lockEventType?: boolean;
}

/**
 * Filter state for the event type configurations list.
 */
export interface EventTypeConfigListFilters {
  search: string;
  eventTypeFilter: string | null;
}

/**
 * Standard event type configuration fields - these have rich UI components
 */
export const EVENT_TYPE_CONFIG_STANDARD_FIELDS = [
  "name",
  "code",
  "typeCode",
  "description",
  "eventTypeConfigurationId",
  "eventType",
  "eventTypeCode",
  "eventSubTypeIdentifier",
  "synchronous",
  "processedDaysTillArchival",
  "unprocessedDaysTillArchival",
  "defaultEventDescription",
  "eventDescriptionJsonPath",
  "saveUnprocessedEvent",
  "enabledInEnvironments",
  "createdDateTime",
  "modifiedDateTime",
] as const;

/**
 * One `EventTypeConfiguration` variant of a merged Event Type anchor (R2),
 * distinguished by `eventSubTypeIdentifier`. A configuration with no
 * sub-type set still produces exactly one variant (labeled "Default"),
 * never zero — see `groupConfigurationsByEventType`.
 */
export interface EventTypeVariant {
  configuration: EventTypeConfiguration;
  /** Empty string for the sub-type-less "Default" variant, never `undefined` — keeps sorting/keying deterministic. */
  eventSubTypeIdentifier: string;
}

/**
 * The merged Event Type anchor entity (R1, R3): identity from the `EVENT_TYPE`
 * metadata record, plus every `EventTypeConfiguration` variant that shares its
 * `eventTypeCode`. The underlying records stay two linked objects — this is
 * the client-side shape the anchor list/detail pages render.
 */
export interface EventTypeAnchor {
  eventTypeCode: string;
  name: string;
  description?: string;
  dataModelCode?: string;
  createdDateTime?: string;
  modifiedDateTime?: string;
  /** Never empty when a metadata record exists — see R1's zero-configuration test scenario. */
  variants: EventTypeVariant[];
}
