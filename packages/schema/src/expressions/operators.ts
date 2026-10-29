/**
 * Expression operator schemas — the recursive boolean tree that decides whether
 * a rule fires / a customer is in a segment.
 *
 * Each operator serializes as a wrapper object: `{ "<opName>": { ...fields } }`.
 * (34 operators total.)
 *
 * Drift-kill strategy: the `Expression` type is hand-written and the recursive
 * Zod schema is annotated `z.ZodType<Expression>`, so `tsc` fails if the schema
 * stops producing the declared shape. `packages/ui/src/expressions/types.ts`
 * re-exports these inferred/declared types, making this the single source of
 * truth for both the builder and the validator.
 *
 * Fields marked `ASSUMPTION` are not confirmable from an in-repo source and are
 * modelled permissively.
 */

import { z } from "zod";

import { expressionActionSchema, type ExpressionAction } from "./actions.js";
import { preOperationSchema, type PreOperation } from "./pre-operations.js";

// A placeholder path (no field selected yet) is "$." or "$.eventData." — the
// two root prefixes the visual builder seeds a new leaf condition with before
// a field is chosen. Exported (via @loom-loyalty/schema/expressions) so
// packages/ui/src/expressions/utils.ts's own placeholder-path backstop reuses
// this instead of duplicating it — packages/ui already depends on this
// package for the Expression types, so this is just widening an existing
// dependency edge, not a new one. This is itself a backstop, not the primary
// gate for human-driven Hub saves — the Hub UI's interactive Save flow
// validates through validateExpressionTree (packages/ui), which never calls
// into this Zod schema at runtime. This schema's real runtime caller today is
// apps/ai-server's eval suite (expressionSchema.safeParse), so this closes
// the gap for AI-generated placeholder paths, not for a human leaving a
// field unpicked in the builder.
export function isPlaceholderJsonPath(value: string): boolean {
  if (!value.startsWith("$.")) return false;
  let rest = value.slice(2);
  if (rest === "eventData") {
    rest = "";
  } else if (rest.startsWith("eventData.")) {
    rest = rest.slice("eventData.".length);
  }
  return rest === "";
}

const jsonPathSchema = z
  .string()
  .regex(/^\$\./, "JsonPath must start with $.")
  .refine((value) => !isPlaceholderJsonPath(value), {
    message: "JsonPath must reference a real field, not just the root prefix",
  });

/**
 * A numeric comparand: a literal number, or a JsonPath string when
 * `extractValueFromPath` is set.
 */
export type NumericComparand = number | string;
const numericComparandSchema = z.union([z.number(), z.string()]);

/**
 * Customer funnel stages (audience-only `funnelStage` operator). Wire value =
 * enum name.
 */
export const FUNNEL_STAGES = [
  "AWARENESS",
  "ENGAGEMENT",
  "CONVERSION",
  "RETENTION",
  "LOYALTY",
  "ADVOCACY",
  "SUPPORT",
  "LAPSE",
  "INACTIVE",
] as const;
export type FunnelStage = (typeof FUNNEL_STAGES)[number];
const funnelStageSchema = z.enum(FUNNEL_STAGES);

// =============================================================================
// OPERATOR TYPES (hand-written; the Zod below must stay assignable to these)
// =============================================================================

// -- Composite (logical) --
export interface AndExpression {
  and: { children: Expression[]; actions?: ExpressionAction[] };
}
export interface OrExpression {
  or: { children: Expression[]; actions?: ExpressionAction[] };
}
export interface NotExpression {
  not: { children: Expression[]; actions?: ExpressionAction[] };
}

// -- Equality --
// `value` is optional: the schema uses `z.unknown()`, which Zod infers as
// optional, and an omitted value is a valid "compare against null/undefined".
export interface EqualsExpression {
  equals: {
    path: string;
    value?: unknown;
    extractValueFromPath: boolean;
    // Confirmed via the real persisted `birthday` segment: the backend accepts
    // and persists this on `equals` (e.g. `matchesCurrentDate`), even though the
    // visual builder doesn't yet expose it here (PreOperationSelector is only
    // rendered by the numeric/between components) -- schema round-trip fidelity
    // only, not a claim that the field is editable for this operator in the UI.
    preOperation?: PreOperation;
    defaultResult: boolean;
    actions?: ExpressionAction[];
  };
}
export interface NotEqualsExpression {
  notEquals: {
    path: string;
    value?: unknown;
    extractValueFromPath: boolean;
    // Symmetric with equals: openapi.yaml declares notEquals.preOperation
    // unconditionally, identical in shape to equals -- the same as every
    // other comparison operator. The spec's only preOperation-related
    // restriction (x-clickhouse-compilable: "conditional" on PreOperation's
    // matchesCurrentDate variant, "Compilable only when attached to
    // EqualsExpression") is a narrow ClickHouse-SQL-compiler limitation for
    // one PreOperation variant on the customer/segment surface -- not a
    // schema-level restriction on notEquals accepting preOperation at all.
    // Nothing in this repo enforces x-clickhouse-compilable at runtime; nor
    // does it apply to the event surface, which evaluates in-process rather
    // than via ClickHouse. An earlier revision of this schema removed this
    // field based on a misreading of that note as a blanket restriction --
    // restored after re-checking openapi.yaml directly (code review finding).
    preOperation?: PreOperation;
    defaultResult: boolean;
    actions?: ExpressionAction[];
  };
}

// -- Numeric comparison --
export interface GreaterThanExpression {
  greaterThan: {
    path: string;
    value: NumericComparand;
    extractValueFromPath: boolean;
    preOperation?: PreOperation;
    defaultResult?: boolean;
    actions?: ExpressionAction[];
  };
}
export interface GreaterThanEqualsExpression {
  greaterThanEquals: {
    path: string;
    value: NumericComparand;
    extractValueFromPath: boolean;
    preOperation?: PreOperation;
    defaultResult?: boolean;
    actions?: ExpressionAction[];
  };
}
export interface LessThanExpression {
  lessThan: {
    path: string;
    value: NumericComparand;
    extractValueFromPath: boolean;
    preOperation?: PreOperation;
    defaultResult?: boolean;
    actions?: ExpressionAction[];
  };
}
export interface LessThanEqualsExpression {
  lessThanEquals: {
    path: string;
    value: NumericComparand;
    extractValueFromPath: boolean;
    preOperation?: PreOperation;
    defaultResult?: boolean;
    actions?: ExpressionAction[];
  };
}
export interface BetweenExpression {
  between: {
    path: string;
    // Renamed from minValue/maxValue.
    lowerBound: number;
    upperBound: number;
    // Inclusivity flags (ASSUMPTION: default inclusive).
    includeLowerBound?: boolean;
    includeUpperBound?: boolean;
    extractValueFromPath: boolean;
    preOperation?: PreOperation;
    actions?: ExpressionAction[];
  };
}

// -- String --
export interface StartsWithExpression {
  startsWith: {
    path: string;
    value: string;
    ignoreCase: boolean;
    extractValueFromPath: boolean;
    defaultResult?: boolean;
    actions?: ExpressionAction[];
  };
}
export interface EndsWithExpression {
  endsWith: {
    path: string;
    value: string;
    ignoreCase: boolean;
    extractValueFromPath: boolean;
    defaultResult?: boolean;
    actions?: ExpressionAction[];
  };
}
export interface MatchesExpression {
  matches: {
    path: string;
    value: string;
    ignoreCase: boolean;
    extractValueFromPath: boolean;
    defaultResult?: boolean;
    actions?: ExpressionAction[];
  };
}
export interface EmptyExpression {
  empty: { path: string; defaultResult?: boolean; actions?: ExpressionAction[] };
}
export interface NotEmptyExpression {
  notEmpty: { path: string; defaultResult?: boolean; actions?: ExpressionAction[] };
}

// -- Collection --
export interface InExpression {
  in: {
    path: string;
    values: unknown[];
    extractValues: boolean;
    valuesPath?: string;
    defaultResult?: boolean;
    actions?: ExpressionAction[];
  };
}
export interface NotInExpression {
  notIn: {
    path: string;
    values: unknown[];
    extractValues: boolean;
    valuesPath?: string;
    defaultResult?: boolean;
    actions?: ExpressionAction[];
  };
}
export interface ContainsAnyExpression {
  containsAny: {
    path: string;
    values: unknown[];
    extractValues: boolean;
    valuesPath?: string;
    defaultResult?: boolean;
    actions?: ExpressionAction[];
  };
}
export interface ContainsAllExpression {
  containsAll: {
    path: string;
    values: unknown[];
    extractValues: boolean;
    valuesPath?: string;
    defaultResult?: boolean;
    actions?: ExpressionAction[];
  };
}

// -- Structural / meta --
export interface ExistsExpression {
  exists: { path: string; actions?: ExpressionAction[] };
}
export interface NotExistsExpression {
  notExists: { path: string; actions?: ExpressionAction[] };
}
export interface TrueExpression {
  true: { actions?: ExpressionAction[] };
}

// -- Domain (loyalty) --
export interface HasBadgeExpression {
  hasBadge: { badgeId: string; revalidateBadge: boolean; actions?: ExpressionAction[] };
}
export interface CurrentTierExpression {
  currentTier: {
    tierId?: string;
    tierCode?: string;
    // Event-rule fields.
    validateLifetimeTier: boolean;
    validateTrialTier: boolean;
    revalidateTier: boolean;
    // Segment-only fields. `minRank` is reserved for audience segmentation;
    // kept in the type for forward-compat but must not be emitted on the event
    // surface.
    minRank?: number;
    requireActive?: boolean;
    actions?: ExpressionAction[];
  };
}
export interface TargetCompletedExpression {
  targetCompleted: { targetId: string; revalidateTarget: boolean; actions?: ExpressionAction[] };
}
export interface HasProgramCurrencyExpression {
  hasProgramCurrency: {
    // `path`, `programId`, `programCode` are derived server-side from the
    // currency code and are NOT client-supplied. `comparisonAmount` replaces
    // the drifted `minimumBalance`.
    programCurrencyCode: string;
    comparisonAmount?: number;
    comparisonAmountPath?: string;
    revalidateCurrencies?: boolean;
    actions?: ExpressionAction[];
  };
}

// -- Metadata hierarchy (event-only) --
// Backed by the event engine's metadata resolvers, so the backend offers them on
// the event surface only (`@ExpressionMeta(surfaces = EVENT)`). Each is a
// JsonPath-based expression: `path` selects the event field holding the
// metadata code to test: an event-data field such as `$.eventData.STORE`.
/** Backend `IsMetadataExpression` — JSON type id `isMetadataType`. */
export interface IsMetadataTypeExpression {
  isMetadataType: {
    path: string;
    metadataTypeCode: string;
    /** Optional: when set, the value at `path` must also equal this code. */
    metadataCode?: string;
    defaultResult?: boolean;
    actions?: ExpressionAction[];
  };
}
/** Backend `InMetadataGroupExpression` — JSON type id `inMetadataGroup`. */
export interface InMetadataGroupExpression {
  inMetadataGroup: {
    path: string;
    metadataGroupCode: string;
    metadataTypeCode: string;
    defaultResult?: boolean;
    actions?: ExpressionAction[];
  };
}
/** Backend `IsChildMetadataExpression` — JSON type id `isChildMetadata`. */
export interface IsChildMetadataExpression {
  isChildMetadata: {
    path: string;
    /** Type of the metadata at `path` (e.g. STORE). */
    metadataTypeCode: string;
    /** The ancestor node it must sit below (e.g. REGION / WEST). */
    parentTypeCode: string;
    parentCode: string;
    /** Only an immediate child matches when true; any depth otherwise. */
    directOnly?: boolean;
    defaultResult?: boolean;
    actions?: ExpressionAction[];
  };
}

// -- Event-window / aggregate (audience-only) --
// These aggregate operators are only valid for audience segmentation, not
// single-event evaluation.
export interface EventCountExpression {
  eventCount: {
    eventTypeCode: string;
    windowDays?: number;
    minCount: number;
    actions?: ExpressionAction[];
  };
}
export interface EventSumExpression {
  eventSum: {
    eventTypeCode: string;
    fieldPath: string;
    windowDays?: number;
    minSum: number;
    actions?: ExpressionAction[];
  };
}
export interface EventExistsExpression {
  eventExists: {
    eventTypeCode: string;
    windowDays?: number;
    actions?: ExpressionAction[];
  };
}
export interface LastEventTimeExpression {
  lastEventTime: {
    eventTypeCode: string;
    maxDaysSinceLast: number;
    actions?: ExpressionAction[];
  };
}
export interface FunnelStageExpression {
  funnelStage: {
    stage: FunnelStage;
    actions?: ExpressionAction[];
  };
}

/**
 * Expression — the recursive union of all 34 operator subtypes.
 */
export type Expression =
  | AndExpression
  | OrExpression
  | NotExpression
  | EqualsExpression
  | NotEqualsExpression
  | GreaterThanExpression
  | GreaterThanEqualsExpression
  | LessThanExpression
  | LessThanEqualsExpression
  | BetweenExpression
  | StartsWithExpression
  | EndsWithExpression
  | MatchesExpression
  | EmptyExpression
  | NotEmptyExpression
  | InExpression
  | NotInExpression
  | ContainsAnyExpression
  | ContainsAllExpression
  | ExistsExpression
  | NotExistsExpression
  | TrueExpression
  | HasBadgeExpression
  | CurrentTierExpression
  | TargetCompletedExpression
  | HasProgramCurrencyExpression
  | IsMetadataTypeExpression
  | InMetadataGroupExpression
  | IsChildMetadataExpression
  | EventCountExpression
  | EventSumExpression
  | EventExistsExpression
  | LastEventTimeExpression
  | FunnelStageExpression;

// =============================================================================
// RECURSIVE ZOD SCHEMA (annotated against the hand-written type)
// =============================================================================

/**
 * Builds the recursive Expression validator. `z.lazy` breaks the self-reference;
 * the `z.ZodType<Expression>` annotation forces the union to stay structurally
 * identical to the declared `Expression` type.
 *
 * `includeActions` controls whether operator nodes carry the (large) `actions`
 * union. The full schema keeps it; the condition-only schema omits it entirely.
 * A node without `actions` is still a valid `Expression` (the field is optional),
 * so the condition schema's outputs validate against the full schema too.
 */
function makeExpressionSchema(includeActions: boolean): z.ZodType<Expression> {
  const actionsInclude = includeActions
    ? { actions: z.array(expressionActionSchema).optional() }
    : {};
  const schema: z.ZodType<Expression> = z.lazy(
    () =>
      z.union([
        // Composite
        z.object({
          and: z.object({
            children: z.array(schema).min(1, "AND requires at least one child"),
            ...actionsInclude,
          }),
        }),
        z.object({
          or: z.object({
            children: z.array(schema).min(1, "OR requires at least one child"),
            ...actionsInclude,
          }),
        }),
        z.object({
          not: z.object({
            children: z.array(schema).min(1, "NOT requires at least one child"),
            ...actionsInclude,
          }),
        }),
        // Equality
        z.object({
          equals: z.object({
            path: jsonPathSchema,
            value: z.unknown(),
            extractValueFromPath: z.boolean(),
            preOperation: preOperationSchema.optional(),
            defaultResult: z.boolean(),
            ...actionsInclude,
          }),
        }),
        z.object({
          notEquals: z.object({
            path: jsonPathSchema,
            value: z.unknown(),
            extractValueFromPath: z.boolean(),
            preOperation: preOperationSchema.optional(),
            defaultResult: z.boolean(),
            ...actionsInclude,
          }),
        }),
        // Numeric comparison
        z.object({
          greaterThan: z.object({
            path: jsonPathSchema,
            value: numericComparandSchema,
            extractValueFromPath: z.boolean(),
            preOperation: preOperationSchema.optional(),
            defaultResult: z.boolean().optional(),
            ...actionsInclude,
          }),
        }),
        z.object({
          greaterThanEquals: z.object({
            path: jsonPathSchema,
            value: numericComparandSchema,
            extractValueFromPath: z.boolean(),
            preOperation: preOperationSchema.optional(),
            defaultResult: z.boolean().optional(),
            ...actionsInclude,
          }),
        }),
        z.object({
          lessThan: z.object({
            path: jsonPathSchema,
            value: numericComparandSchema,
            extractValueFromPath: z.boolean(),
            preOperation: preOperationSchema.optional(),
            defaultResult: z.boolean().optional(),
            ...actionsInclude,
          }),
        }),
        z.object({
          lessThanEquals: z.object({
            path: jsonPathSchema,
            value: numericComparandSchema,
            extractValueFromPath: z.boolean(),
            preOperation: preOperationSchema.optional(),
            defaultResult: z.boolean().optional(),
            ...actionsInclude,
          }),
        }),
        z.object({
          between: z.object({
            path: jsonPathSchema,
            lowerBound: z.number(),
            upperBound: z.number(),
            includeLowerBound: z.boolean().optional(),
            includeUpperBound: z.boolean().optional(),
            extractValueFromPath: z.boolean(),
            preOperation: preOperationSchema.optional(),
            ...actionsInclude,
          }),
        }),
        // String
        z.object({
          startsWith: z.object({
            path: jsonPathSchema,
            value: z.string(),
            ignoreCase: z.boolean(),
            extractValueFromPath: z.boolean(),
            defaultResult: z.boolean().optional(),
            ...actionsInclude,
          }),
        }),
        z.object({
          endsWith: z.object({
            path: jsonPathSchema,
            value: z.string(),
            ignoreCase: z.boolean(),
            extractValueFromPath: z.boolean(),
            defaultResult: z.boolean().optional(),
            ...actionsInclude,
          }),
        }),
        z.object({
          matches: z.object({
            path: jsonPathSchema,
            value: z.string(),
            ignoreCase: z.boolean(),
            extractValueFromPath: z.boolean(),
            defaultResult: z.boolean().optional(),
            ...actionsInclude,
          }),
        }),
        z.object({
          empty: z.object({
            path: jsonPathSchema,
            defaultResult: z.boolean().optional(),
            ...actionsInclude,
          }),
        }),
        z.object({
          notEmpty: z.object({
            path: jsonPathSchema,
            defaultResult: z.boolean().optional(),
            ...actionsInclude,
          }),
        }),
        // Collection
        z.object({
          in: z.object({
            path: jsonPathSchema,
            values: z.array(z.unknown()),
            extractValues: z.boolean(),
            valuesPath: jsonPathSchema.optional(),
            defaultResult: z.boolean().optional(),
            ...actionsInclude,
          }),
        }),
        z.object({
          notIn: z.object({
            path: jsonPathSchema,
            values: z.array(z.unknown()),
            extractValues: z.boolean(),
            valuesPath: jsonPathSchema.optional(),
            defaultResult: z.boolean().optional(),
            ...actionsInclude,
          }),
        }),
        z.object({
          containsAny: z.object({
            path: jsonPathSchema,
            values: z.array(z.unknown()),
            extractValues: z.boolean(),
            valuesPath: jsonPathSchema.optional(),
            defaultResult: z.boolean().optional(),
            ...actionsInclude,
          }),
        }),
        z.object({
          containsAll: z.object({
            path: jsonPathSchema,
            values: z.array(z.unknown()),
            extractValues: z.boolean(),
            valuesPath: jsonPathSchema.optional(),
            defaultResult: z.boolean().optional(),
            ...actionsInclude,
          }),
        }),
        // Structural / meta
        z.object({
          exists: z.object({ path: jsonPathSchema, ...actionsInclude }),
        }),
        z.object({
          notExists: z.object({ path: jsonPathSchema, ...actionsInclude }),
        }),
        z.object({
          true: z.object({ ...actionsInclude }),
        }),
        // Domain (loyalty)
        z.object({
          hasBadge: z.object({
            badgeId: z.string().min(1),
            revalidateBadge: z.boolean(),
            ...actionsInclude,
          }),
        }),
        z.object({
          currentTier: z.object({
            tierId: z.string().optional(),
            tierCode: z.string().optional(),
            validateLifetimeTier: z.boolean(),
            validateTrialTier: z.boolean(),
            revalidateTier: z.boolean(),
            minRank: z.number().optional(),
            requireActive: z.boolean().optional(),
            ...actionsInclude,
          }),
        }),
        z.object({
          targetCompleted: z.object({
            targetId: z.string().min(1),
            revalidateTarget: z.boolean(),
            ...actionsInclude,
          }),
        }),
        z.object({
          hasProgramCurrency: z.object({
            programCurrencyCode: z.string().min(1),
            comparisonAmount: z.number().optional(),
            comparisonAmountPath: jsonPathSchema.optional(),
            revalidateCurrencies: z.boolean().optional(),
            ...actionsInclude,
          }),
        }),
        // Metadata hierarchy (event-only)
        z.object({
          isMetadataType: z.object({
            path: jsonPathSchema,
            metadataTypeCode: z.string().min(1),
            metadataCode: z.string().optional(),
            defaultResult: z.boolean().optional(),
            ...actionsInclude,
          }),
        }),
        z.object({
          inMetadataGroup: z.object({
            path: jsonPathSchema,
            metadataGroupCode: z.string().min(1),
            metadataTypeCode: z.string().min(1),
            defaultResult: z.boolean().optional(),
            ...actionsInclude,
          }),
        }),
        z.object({
          isChildMetadata: z.object({
            path: jsonPathSchema,
            metadataTypeCode: z.string().min(1),
            parentTypeCode: z.string().min(1),
            parentCode: z.string().min(1),
            directOnly: z.boolean().optional(),
            defaultResult: z.boolean().optional(),
            ...actionsInclude,
          }),
        }),
        // Event-window / aggregate (audience-only)
        z.object({
          eventCount: z.object({
            eventTypeCode: z.string().min(1),
            windowDays: z.number().int().optional(),
            minCount: z.number().int(),
            ...actionsInclude,
          }),
        }),
        z.object({
          eventSum: z.object({
            eventTypeCode: z.string().min(1),
            // jsonPathSchema (not a bare min(1) string, code review finding): fieldPath
            // is conceptually a JsonPath in practice (the existing valid-operator fixture
            // below uses "$.amount"), and packages/ui's validateExpressionTree already
            // applies its own placeholder-aware check to it -- this schema was the one
            // path-bearing field in the file not getting the same treatment.
            fieldPath: jsonPathSchema,
            windowDays: z.number().int().optional(),
            minSum: z.number(),
            ...actionsInclude,
          }),
        }),
        z.object({
          eventExists: z.object({
            eventTypeCode: z.string().min(1),
            windowDays: z.number().int().optional(),
            ...actionsInclude,
          }),
        }),
        z.object({
          lastEventTime: z.object({
            eventTypeCode: z.string().min(1),
            maxDaysSinceLast: z.number().int(),
            ...actionsInclude,
          }),
        }),
        z.object({
          funnelStage: z.object({
            stage: funnelStageSchema,
            ...actionsInclude,
          }),
        }),
        // The conditional `...actionsInclude` spread widens `actions` to `unknown` at
        // the type level; the runtime shape is exact and `expressions.test.ts` asserts
        // every operator/action shape, so we assert the declared Expression type here.
      ]) as unknown as z.ZodType<Expression>
  );
  return schema;
}

/** Full Expression validator (operators + actions) — used for validation + the builder. */
export const expressionSchema: z.ZodType<Expression> = makeExpressionSchema(true);

/**
 * Condition-only Expression validator (no `actions`). A structural subset of
 * `expressionSchema` — every value it accepts is a valid `Expression` — used as
 * the structured-output target for NL → condition generation. Omitting the
 * 17-action union (inlined on all 34 operators) keeps the generated tool schema
 * hundreds of times smaller than the full one, well within the model's context.
 */
export const conditionExpressionSchema: z.ZodType<Expression> = makeExpressionSchema(false);
