/**
 * Metadata Feature Types
 *
 * Centralized type definitions for the metadata feature.
 */

import type { UIEntitySchema } from "@loom-loyalty/schema";
import type {
  CreateDataType,
  CreateItem,
  CreateLocation,
  CreateMetadata,
  Metadata,
  MetadataTypeCategory,
  UpdateDataType,
  UpdateItem,
  UpdateLocation,
  UpdateMetadata,
} from "@loom-loyalty/sdk";

import type { FormFieldError } from "../../../forms/field-errors.js";
import type { FormSheetError } from "../../../forms/form-sheet.js";
import type { MetadataSubTypeValues } from "../../../forms/metadata-sub-type-fields/types.js";

/**
 * Form data for metadata creation/editing.
 *
 * Extends the sub-type values so a LOCATION/ITEM/DATA_TYPE entry's own fields
 * have a typed home instead of riding along in an untyped payload spread.
 */
export interface MetadataFormData extends MetadataSubTypeValues {
  name: string;
  code: string;
  typeCode: string;
  description: Record<string, string>;
}

/**
 * Body the form submits. Which member it is depends on the metadata type's
 * category, which the sheet passes alongside it — `Metadata` is a `oneOf` with
 * no discriminator, so the payload cannot say for itself.
 */
export type MetadataSubmitData =
  | CreateMetadata
  | CreateDataType
  | CreateLocation
  | CreateItem
  | UpdateMetadata
  | UpdateDataType
  | UpdateLocation
  | UpdateItem;

/**
 * Props for the MetadataFormSheet component.
 */
export interface MetadataFormSheetProps {
  /** Whether the sheet is open */
  open: boolean;
  /** Callback when open state changes */
  onOpenChange: (open: boolean) => void;
  /** Mode: create or edit */
  mode: "create" | "edit";
  /** Initial data for editing */
  initialData?: Metadata;
  /**
   * Submit handler. `category` is the metadata type's category, and it decides
   * which endpoint the payload belongs to — a LOCATION body sent to /metadata
   * is accepted with its address fields silently dropped.
   */
  onSubmit: (
    data: MetadataSubmitData,
    category: MetadataTypeCategory,
    /**
     * Create mode: the chosen parent code for each parent type code. Links are
     * not part of the metadata body, so the caller makes them after creating.
     */
    parents: Record<string, string>
  ) => Promise<void>;
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
   * Called when the user picks a metadata type. The sheet starts from
   * `initialData.typeCode` (or none) on every open, so the caller tracks the
   * same. A caller whose types carry their own data model swaps `schema` and
   * `extendedFields` for that type's model in response.
   */
  onTypeCodeChange?: (typeCode: string) => void;
  /** When set, saving is blocked with this message, e.g. while the type's own model loads. */
  schemaUnavailableMessage?: string;
  /**
   * Only offer metadata types of this category in the Type Code picker — for
   * example LOCATION when the sheet is opened to create a Location.
   */
  typeCategory?: MetadataTypeCategory;
  /** Noun used in the create title and button (default "Metadata"). */
  entityLabel?: string;
}

/**
 * Filter state for the metadata list.
 */
export interface MetadataListFilters {
  search: string;
  typeCode: string;
}

/**
 * Standard metadata fields
 */
export const METADATA_STANDARD_FIELDS = [
  "name",
  "code",
  "typeCode",
  "parentCode",
  "description",
  "createdDateTime",
  "modifiedDateTime",
] as const;
