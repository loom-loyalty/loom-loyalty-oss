/**
 * Metadata Hierarchy Feature Types
 *
 * Centralized type definitions for the metadata-hierarchies feature.
 */

import type {
  CreateMetadataType,
  CreateUpdateMetadataHierarchyViewData,
  MetadataHierarchyView,
} from "@loom-loyalty/sdk";
import type { FormFieldError } from "../../../forms/field-errors.js";
import type { FormSheetError } from "../../../forms/form-sheet.js";

/** Props for the ordered level picker. */
export interface MetadataHierarchyLevelsPickerProps {
  /** Ordered metadata type codes, top level first. Empty string = unselected. */
  levels: string[];
  onLevelsChange: (levels: string[]) => void;
  /**
   * Creates a metadata type and, when `parentCode` is set, links it as a child
   * type of that type. Resolves with the new type's code. When omitted, levels
   * offer no "Add New" option.
   */
  onCreateType?: (data: CreateMetadataType, parentCode: string | null) => Promise<string>;
  /**
   * Links an existing type as a child type of `parentCode`. When omitted, levels
   * only offer types already linked under the level above.
   */
  onLinkChildType?: (parentCode: string, childCode: string) => Promise<void>;
  disabled?: boolean;
}

/** Props for the MetadataHierarchyFormSheet component. */
export interface MetadataHierarchyFormSheetProps extends Pick<
  MetadataHierarchyLevelsPickerProps,
  "onCreateType" | "onLinkChildType"
> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  initialData?: MetadataHierarchyView;
  onSubmit: (data: CreateUpdateMetadataHierarchyViewData) => Promise<void>;
  isSubmitting?: boolean;
  /** Error to display; a `describeError` result also shows its support reference */
  error?: FormSheetError | null;
  /** Server field errors; each shows under its field, the rest with `error` */
  fieldErrors?: readonly FormFieldError[];
}

/** Filter state for the metadata hierarchies list. */
export interface MetadataHierarchyListFilters {
  search: string;
}
