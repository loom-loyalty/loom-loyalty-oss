/**
 * Expression & Action Type Definitions
 *
 * The DSL types now come from the backend-accurate single source of truth in
 * `@loom-loyalty/schema/expressions` — re-exported here so the visual builder,
 * its validator, and ai-server all speak the same shapes. This kills the old
 * type↔validator drift (the hand-written types that had silently diverged from
 * the backend).
 *
 * Only the UI-state prop types (which are NOT part of the DSL) are defined here.
 */

import type { AiLimit } from "@loom-loyalty/core";
import type { ReactNode } from "react";

// =============================================================================
// DSL TYPES (single source of truth: @loom-loyalty/schema/expressions)
// =============================================================================

export type {
  AddCounterDataAction,
  AddCustomerToAudienceAction,
  // Operator node types
  AndExpression,
  BetweenExpression,
  CancelCustomerCouponAction,
  CancelCustomerExternalOfferAction,
  CompleteTargetDataAction,
  ContainsAllExpression,
  ContainsAnyExpression,
  CurrentTierExpression,
  DateTimeOperand,
  EmptyExpression,
  EndsWithExpression,
  EqualsExpression,
  EventCountExpression,
  EventExistsExpression,
  EventSumExpression,
  ExistsExpression,
  // Unions + scalars
  Expression,
  ExpressionAction,
  FunnelStage,
  FunnelStageExpression,
  GreaterThanEqualsExpression,
  GreaterThanExpression,
  HasBadgeExpression,
  HasProgramCurrencyExpression,
  HoldCustomerCouponAction,
  InExpression,
  InMetadataGroupExpression,
  IsChildMetadataExpression,
  IsMetadataTypeExpression,
  IssueCustomerBadgeAction,
  IssueCustomerCouponAction,
  IssueCustomerExternalOfferAction,
  IssueCustomerTierAction,
  // Action node types
  IssueProgramCurrencyAction,
  LastEventTimeExpression,
  LessThanEqualsExpression,
  LessThanExpression,
  MatchesExpression,
  MetadataTaggingAction,
  NotEmptyExpression,
  NotEqualsExpression,
  NotExistsExpression,
  NotExpression,
  NotInExpression,
  NumericComparand,
  OrExpression,
  PreOperation,
  RegisterTargetAction,
  RemoveCustomerFromAudienceAction,
  ReturnCustomerCouponAction,
  RoundingAlgorithm,
  SendNotificationAction,
  StartsWithExpression,
  TargetCompletedExpression,
  TrueExpression,
  UseCustomerCouponAction,
  WithdrawProgramCurrencyAction,
} from "@loom-loyalty/schema/expressions";

import type { Expression, ExpressionAction } from "@loom-loyalty/schema/expressions";

import type { DataModelLike, ExpressionSurfaceMode } from "./expression-context.js";

// =============================================================================
// UI STATE / COMPONENT PROPS (feature-local; not part of the DSL)
// =============================================================================

export type ExpressionMode = "edit" | "display";

/**
 * Leaf/composite rendering style. `card` (the existing expandable-Card rows) is
 * the default for every current consumer of `ExpressionBuilder`/`ExpressionNode`.
 * `sentence` is opt-in and set only by `ExpressionModal` (R6a) — the sentence
 * rendering branch itself lands in a later unit; this prop is threaded now so
 * that unit only has to add the branch, not the plumbing.
 */
export type ExpressionPresentation = "sentence" | "card";

export interface ExpressionComponentProps<T> {
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
  mode?: ExpressionMode;
  className?: string;
  /** @default "card" */
  presentation?: ExpressionPresentation;
}

export interface ActionComponentProps<T> {
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
  error?: string;
  className?: string;
  /** @default "card" */
  presentation?: ExpressionPresentation;
}

export interface ExpressionNodeProps {
  expression: Expression;
  onChange: (expression: Expression) => void;
  depth: number;
  disabled?: boolean;
  onRemove?: () => void;
  showActions?: boolean;
  /** @default "card" */
  presentation?: ExpressionPresentation;
}

export interface ActionListProps {
  actions: ExpressionAction[];
  onChange: (actions: ExpressionAction[]) => void;
  disabled?: boolean;
  className?: string;
  /** @default "card" */
  presentation?: ExpressionPresentation;
}

// =============================================================================
// EXPRESSION MODAL (R1-R3, R6a, KTD5, KTD9, KTD11)
// =============================================================================

/** The non-tree half of an AI proposal, shown by the pinned AI bar. */
export interface ExpressionModalAiProposal {
  explanation: string;
  assumptions: string[];
  clarifyingQuestion: string | null;
}

/**
 * The minimal surface `ExpressionModal` needs from a hub-hosted AI "step" state
 * machine (e.g. `useExpressionAiStep`). Deliberately structural/transport-agnostic:
 * `@loom-loyalty/ui` is an open-source package and must not depend on an app
 * (`apps/hub`), so it cannot import that hook directly. Whatever the caller's hook
 * returns need only satisfy this shape.
 */
export interface ExpressionModalAiStepApi {
  aiProposal: ExpressionModalAiProposal | null;
  aiAnnouncement: string | null;
  aiDrafted: boolean;
  isLoading: boolean;
  fixLoading: boolean;
  error: string | null;
  fixError: string | null;
  /** Set when the daily AI allowance refused the last generate (optional for older callers). */
  limit?: AiLimit | null;
  /** Set when the daily AI allowance refused the last fix. */
  fixLimit?: AiLimit | null;
  generate: (prompt: string) => void;
  fix: (prompt: string) => void;
  /** Wired to the builder's onChange: a human edit supersedes any in-flight AI run. */
  onBuilderChange: (expression: Expression | null) => void;
}

/**
 * What the modal hands to the caller's AI-step hook so its `apply` (and manual
 * edits) write the modal's local draft, never the caller's own store (KTD11).
 */
export interface ExpressionModalAiBridge {
  currentExpression: Expression | null;
  applyToDraft: (expression: Expression | null) => void;
}

export interface ExpressionModalAiBarProps {
  /** Drives default bar copy (see `ExpressionAiBuilder`'s `SURFACE_COPY`). */
  surface: "event" | "customer";
  labels: { built: string; updated: string };
  /**
   * Builds (or returns) the caller's AI state machine, called unconditionally on
   * every render of `ExpressionModal` — a "hook passed as a prop" bridge. The
   * caller is expected to call its own hook (e.g. `useExpressionAiStep`) inside
   * this function with `apply` bound to `bridge.applyToDraft` and
   * `currentExpression` bound to `bridge.currentExpression`, never its own
   * wizard/store setter. Because this is invoked every render in the same
   * position, the Rules of Hooks are satisfied as long as the function itself
   * calls its hooks unconditionally.
   */
  useAiStep: (bridge: ExpressionModalAiBridge) => ExpressionModalAiStepApi;
  /**
   * Additional loading gate beyond `isResolvingSchema` (e.g. the WHAT step's
   * currency/badge grounding loads) — ANDed into the AI bar's `isResolvingSchema`
   * so a request never fires on incomplete grounding (fix #13).
   */
  aiLoadingGate?: boolean;
  /**
   * WHAT-only: a predicate re-applied to the LIVE draft on every change to derive
   * Fix-availability (fix #3) — never a boolean captured once at open time.
   */
  isFlatReward?: (expression: Expression | null) => boolean;
  /** Copy overrides for the AI textarea; default derived from `surface`. */
  label?: string;
  placeholder?: string;
}

export interface ExpressionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The normalized working value. Null starts from a blank builder. */
  initialExpression: Expression | null;
  /**
   * The RAW persisted value, inspected by `ExpressionMigrationNotice` — normalize
   * deletes some corrupt fields before they can be surfaced.
   */
  rawInitialExpression?: unknown;
  /** Called with the new expression when the user clicks Save. */
  onSave: (expression: Expression | null) => void;
  disabled?: boolean;
  mode?: ExpressionSurfaceMode;
  dataModelCode?: string;
  /** The configured event type, retained when its data model resolves separately. */
  eventTypeCode?: string;
  fetchDataModel?: (code: string) => Promise<DataModelLike>;
  /** True while the caller is still resolving `dataModelCode`. */
  isResolvingSchema?: boolean;
  /** Forwarded to `ExpressionBuilder` — WHAT passes true (reward actions), WHEN false. */
  showActions?: boolean;
  /** The AI bar. Omit it on a surface the AI generator doesn't ground against, such as feeds. */
  aiBar?: ExpressionModalAiBarProps;
  /** Required visual and accessible header copy for the modal. */
  header: ExpressionModalHeader;
  /** Copy for the Save button; defaults to "Save condition". */
  saveLabel?: string;
  className?: string;
  /**
   * Additional surface-specific content rendered in the scrollable body, below
   * the builder and validation — e.g. a caller's own live data-preview panel
   * (counts, cost, samples) with no equivalent inside the generic builder.
   * Absent by default; no existing caller is affected.
   */
  bodyExtra?: ReactNode;
  /**
   * Fires whenever the modal's local draft changes (manual edit or AI
   * apply) — lets a caller mirror the in-progress draft into its own
   * surface-specific state (e.g. a live preview that must react to the draft,
   * not just the committed `onSave` value). Absent by default; no existing
   * caller is affected.
   */
  onDraftChange?: (expression: Expression | null) => void;
  /**
   * Starter expressions offered while the draft is empty. Picking one loads
   * it into the draft for the user to adjust; nothing is saved until Save.
   */
  templates?: ExpressionTemplate[];
  /**
   * Slot rendered beside each leaf condition — e.g. a live per-condition
   * match count. The caller owns the data fetching.
   */
  renderConditionAside?: (condition: Expression) => ReactNode;
}

/** A named starter expression offered by `ExpressionModal` on an empty draft. */
export interface ExpressionTemplate {
  id: string;
  label: string;
  /** One plain-language sentence on who or what the template matches. */
  description: string;
  expression: Expression;
}

export interface ExpressionModalHeader {
  /** Uppercase context label, e.g. "EVENT RULE". */
  eyebrow: string;
  /** Optional rule/entity name shown beside the eyebrow. */
  entity?: string;
  /** Serif question heading; also supplies the dialog's accessible name. */
  heading: string;
  /** Optional supporting copy. */
  subtitle?: string;
}
