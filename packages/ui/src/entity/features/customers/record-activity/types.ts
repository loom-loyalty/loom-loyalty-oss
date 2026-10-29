/**
 * Types for the Record activity surface.
 *
 * Operator-facing copy in this surface names activities and their consequences
 * in customer-care language. The registry's dotted activity code travels on the
 * request but is never rendered. `code` below is an identifier, never a label.
 */

import type { ParsedField } from "@loom-loyalty/schema";

/** An activity a care agent may be offered, as the picker presents it. */
export interface CareActivityOption {
  /**
   * The registry activity code. Carried on the request; never rendered to an
   * operator.
   */
  code: string;
  /** Plain operator-facing name, e.g. "Hotel stay". */
  name: string;
  /** Optional one-line explanation shown beneath the name. */
  description?: string;
  /**
   * Heading this activity sits under in the picker. Derived from the activity's
   * domain so the list reads the way operators think.
   */
  group?: string;
}

/** A single detail value, as the check panel restates it. */
export interface ActivityDetailValue {
  /** Field name from the data model. Used as a key, not shown. */
  name: string;
  /** Operator-facing field label. */
  label: string;
  /**
   * The value in plain language, or null when the agent has not set it. Unset
   * details are rendered explicitly rather than omitted, so the agent can see
   * what they have left blank.
   */
  value: string | null;
}

/**
 * An earlier record of the same activity on the same calendar date.
 *
 * Advisory only. It names the earlier record so the agent can judge whether
 * this is a genuine repeat, and never blocks applying.
 */
export interface EarlierRecordWarning {
  /** The activity's plain name, as the earlier record carried it. */
  activityName: string;
  /** The earlier record's date, already formatted for display. */
  recordedOn: string;
}

/**
 * A detail field on the selected activity's form.
 *
 * The parsed shape comes from the app's live data-model path; this package only
 * renders it.
 */
export interface ActivityDetailField {
  /** Payload key this field writes to. */
  name: string;
  /** Operator-facing label. */
  label: string;
  /** Parsed shape from the data model. */
  field: ParsedField;
}

/** Values the agent has entered, keyed by payload field name. */
export type ActivityDetailValues = Record<string, unknown>;

/** Per-field validation messages, keyed by payload field name. */
export type ActivityFieldErrors = Record<string, string | undefined>;

/** One thing the engine actually did in response to a recorded activity. */
export interface RecordedActivityAction {
  /** Plain-language description, e.g. "Awarded 250 Bean Points". */
  summary: string;
  /** Optional detail line, e.g. the rule that produced it. */
  detail?: string;
}
