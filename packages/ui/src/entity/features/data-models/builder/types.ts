/**
 * Data Model Builder types.
 *
 * The builder's row model *wraps* `DataModelElementFormData` rather than
 * replacing it, so `schema-utils.ts` (`generateClientSchema`,
 * `findDuplicateAttributes`, `formatJson`) and `formDataToElement` keep working
 * unchanged on submit. Flatten with `builderRowsToElements` first.
 */

import type { AiLimit } from "@loom-loyalty/core";
import type { ReactNode } from "react";

import type { EntityOption } from "../../../../forms/entity-select-box.js";
import type { DataModelElementFormData } from "../types.js";

/**
 * Lifecycle state of one row in the field review table.
 *
 * - `inherited`: copied in from the `extends` parent. Muted, locked, no edit or delete.
 * - `editable`: a normal, fully editable row.
 * - `needs-review-nested`: an array field whose child fields aren't declared yet.
 *   Structural, not traffic-based: rules can't read into an array whose shape is
 *   unknown, so the modal's primary action stays disabled while any row is here.
 */
export type FieldRowState = "inherited" | "editable" | "needs-review-nested";

/** The four equally-weighted authoring modes offered by the START FROM grid. */
export type BuilderMode = "describe" | "paste-schema" | "field-by-field" | "sample";

/** Where a row's field came from. Provenance only, it does not gate behavior. */
export type BuilderFieldSource = "ai" | "paste" | "manual" | "sample" | "inherited";

/**
 * One row in the field review table.
 *
 * Rows are addressed positionally by every callback in this module (matching
 * `ElementsEditor`'s `onEditElement(index)` convention). `field._rowKey` is used
 * for React keys only.
 */
export interface BuilderFieldRow {
  field: DataModelElementFormData;
  state: FieldRowState;
  /** Child rows for a nested array field. Only meaningful for `needs-review-nested`. */
  nested?: BuilderFieldRow[];
  /** Name for the standalone child type created for a nested array field. */
  nestedTypeName?: string;
  /** Optional description for the standalone child type created on submit. */
  nestedTypeDescription?: string;
  source: BuilderFieldSource;
}

/** One option in a row's inline Type select. */
export interface BuilderTypeOption {
  /** Type code stored on the element (e.g. "STRING", "ORDER_LINE"). */
  code: string;
  /** Display label (e.g. "STRING", "Order Line (ORDER_LINE)"). */
  label: string;
}

/**
 * Flatten builder rows for the "View as JSON Schema" preview only. This is a
 * synchronous approximation: it never resolves nested children into their real
 * standalone types, because that is an async network operation performed by
 * `resolve-nested-rows.ts` during submission.
 */
export function builderRowsToElements(rows: BuilderFieldRow[]): DataModelElementFormData[] {
  return rows.map((row) => row.field);
}

/** True when a nested row is missing its child type name or declared child fields. */
export function hasUnresolvedRows(rows: BuilderFieldRow[]): boolean {
  return rows.some(
    (row) =>
      row.state === "needs-review-nested" && (!row.nestedTypeName?.trim() || !row.nested?.length)
  );
}

export interface StartFromModeGridProps {
  value: BuilderMode;
  onValueChange: (mode: BuilderMode) => void;
  disabled?: boolean;
  className?: string;
}

export interface DescribeModePanelProps {
  value: string;
  onValueChange: (value: string) => void;
  /** Fires when the user asks for a fresh draft from the current description. */
  onGenerate: () => void;
  isGenerating?: boolean;
  disabled?: boolean;
}

export interface PasteSchemaModePanelProps {
  value: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
}

export interface SampleModePanelProps {
  /** An accepted CSV file. Parsing lives in the orchestration layer. */
  onFileSelected: (file: File) => void;
  /** A human-readable rejection reason for a file the dropzone refused. */
  onFileRejected?: (message: string) => void;
  /** Loads the canned Stripe dataset. */
  onLoadSample: () => void;
  processing?: boolean;
  /** Live-region stage label while processing (e.g. "Parsing..."). */
  stageLabel?: string;
  /** Summary of the loaded source, e.g. "12 columns from orders.csv". */
  sourceSummary?: string;
  disabled?: boolean;
}

export interface NestedFieldSubtableProps {
  rows: BuilderFieldRow[];
  typeName: string;
  typeOptions: BuilderTypeOption[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTypeNameChange: (name: string) => void;
  onFieldChange: (nestedIndex: number, patch: Partial<DataModelElementFormData>) => void;
  onFieldDelete: (nestedIndex: number) => void;
  onAddField: () => void;
  disabled?: boolean;
}

export interface FieldReviewRowProps {
  row: BuilderFieldRow;
  /** Position in the table. Used for accessible names, which must stay unique per row. */
  index: number;
  typeOptions: BuilderTypeOption[];
  onFieldChange: (patch: Partial<DataModelElementFormData>) => void;
  onMarkAsNestedArray: () => void;
  onFieldDelete: () => void;
  onNestedTypeNameChange: (name: string) => void;
  onNestedFieldChange: (nestedIndex: number, patch: Partial<DataModelElementFormData>) => void;
  onNestedFieldDelete: (nestedIndex: number) => void;
  onNestedFieldAdd: () => void;
  disabled?: boolean;
}

export interface FieldReviewTableProps {
  rows: BuilderFieldRow[];
  typeOptions: BuilderTypeOption[];
  onFieldChange: (index: number, patch: Partial<DataModelElementFormData>) => void;
  onFieldMarkAsNestedArray: (index: number) => void;
  onFieldDelete: (index: number) => void;
  onNestedTypeNameChange: (index: number, name: string) => void;
  onAddField: () => void;
  onNestedFieldChange: (
    index: number,
    nestedIndex: number,
    patch: Partial<DataModelElementFormData>
  ) => void;
  onNestedFieldDelete: (index: number, nestedIndex: number) => void;
  onNestedFieldAdd: (index: number) => void;
  /** Promotes every drafted row to `editable`. Hidden when omitted. */
  onAcceptAll?: () => void;
  /** Opens a JSON Schema preview. Hidden when omitted. Schema generation is the caller's job. */
  onViewJsonSchema?: () => void;
  disabled?: boolean;
}

export interface BuilderLeftRailProps {
  name: string;
  onNameChange: (name: string) => void;
  /** Type code of the parent this model extends. Empty string means none. */
  extendsCode: string;
  onExtendsChange: (code: string) => void;
  extendsOptions: EntityOption[];
  extendsLoading?: boolean;
  /** Makes selecting a parent mandatory for constrained builder flows. */
  extendsRequired?: boolean;
  mode: BuilderMode;
  onModeChange: (mode: BuilderMode) => void;
  disabled?: boolean;
  /** The active mode's panel. */
  children?: ReactNode;
}

export interface DataModelBuilderModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * Surface the modal was opened from, e.g. "Configure event type". When set,
   * the header shows a provenance line and the footer promises a return trip
   * with the new model selected ("Create & use"). When absent the modal reads
   * as a standalone create ("Create").
   */
  originLabel?: string;
  name: string;
  onNameChange: (name: string) => void;
  extendsCode: string;
  onExtendsChange: (code: string) => void;
  extendsOptions: EntityOption[];
  extendsLoading?: boolean;
  /** Makes selecting a parent mandatory for constrained builder flows. */
  extendsRequired?: boolean;
  mode: BuilderMode;
  onModeChange: (mode: BuilderMode) => void;
  describe: DescribeModePanelProps;
  pasteSchema: PasteSchemaModePanelProps;
  sample: SampleModePanelProps;
  fields: FieldReviewTableProps;
  onSubmit: () => void;
  isSubmitting?: boolean;
  /** Progress text announced while the create and publish sequence runs. */
  statusMessage?: string;
  error?: string | null;
  /** Set when the daily AI allowance refused the proposal; shown instead of `error`. */
  aiLimit?: AiLimit | null;
}
