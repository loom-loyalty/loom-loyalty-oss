/**
 * Expression Tree Utilities
 *
 * Helper functions for tree manipulation, validation, categories, and factories.
 */

import { isPlaceholderJsonPath } from "@loom-loyalty/schema/expressions";

import type { Expression, ExpressionAction } from "./types";

// =============================================================================
// EXPRESSION TYPE UTILITIES
// =============================================================================

export function getExpressionType(expr: Expression): string {
  return Object.keys(expr)[0] ?? "";
}

export function isCompositeExpression(expr: Expression): boolean {
  const type = getExpressionType(expr);
  return ["and", "or", "not"].includes(type);
}

export function getExpressionChildren(expr: Expression): Expression[] | undefined {
  const type = getExpressionType(expr);
  const data = (expr as unknown as Record<string, Record<string, unknown>>)[type];
  if (isCompositeExpression(expr) && data) {
    return data.children as Expression[] | undefined;
  }
  return undefined;
}

export function getExpressionActions(expr: Expression): ExpressionAction[] | undefined {
  const type = getExpressionType(expr);
  const data = (expr as unknown as Record<string, Record<string, unknown>>)[type];
  return data?.actions as ExpressionAction[] | undefined;
}

export function getExpressionData(expr: Expression): Record<string, unknown> {
  const type = getExpressionType(expr);
  return (expr as unknown as Record<string, Record<string, unknown>>)[type] ?? {};
}

// =============================================================================
// TREE TRAVERSAL
// =============================================================================

export function getExpressionDepth(expr: Expression): number {
  const children = getExpressionChildren(expr);
  if (children && children.length > 0) {
    return 1 + Math.max(...children.map(getExpressionDepth));
  }
  return 1;
}

export function countExpressionNodes(expr: Expression): number {
  const children = getExpressionChildren(expr);
  let count = 1;
  if (children) {
    count += children.reduce((sum, child) => sum + countExpressionNodes(child), 0);
  }
  return count;
}

// =============================================================================
// VALIDATION
// =============================================================================

export interface ValidationError {
  path: string;
  field: string;
  message: string;
  severity: "error" | "warning";
}

const COMPARISON_OPS = new Set([
  "equals",
  "notEquals",
  "greaterThan",
  "lessThan",
  "greaterThanEquals",
  "lessThanEquals",
  "startsWith",
  "endsWith",
  "matches",
]);

const COLLECTION_OPS = new Set(["in", "notIn", "containsAny", "containsAll"]);

const PATH_ONLY_OPS = new Set(["empty", "notEmpty", "exists", "notExists"]);

// Event-window / aggregate ops (audience-only) that reference an event type.
const EVENT_WINDOW_OPS = new Set(["eventCount", "eventSum", "eventExists", "lastEventTime"]);
const METADATA_OPS = new Set(["isMetadataType", "inMetadataGroup", "isChildMetadata"]);

function hasValue(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string" && value.trim() === "") return false;
  return true;
}

function requireField(
  errors: ValidationError[],
  path: string,
  field: string,
  value: unknown,
  message: string
): void {
  if (!hasValue(value)) {
    errors.push({ path, field, message, severity: "error" });
  }
}

// A placeholder path (no field selected yet) is "$." or "$.eventData." — the
// two root prefixes `createDefaultExpression` seeds a new leaf condition with
// on the customer and event surfaces respectively. isPlaceholderJsonPath
// (reused from @loom-loyalty/schema/expressions, which packages/ui already
// depends on for the Expression types) is a schema-independent backstop: it
// only catches the placeholder SHAPE, not whether a filled-in path actually
// resolves against the schema (that's PropertyPicker's live-resolution job)
// or collides with an operator name (R2b's collision case) — so it stays
// safe to apply universally without auditing every consumer. Do not remove
// believing PropertyPicker's coverage makes this redundant: this is what still
// catches an unfilled path while PropertyPicker's schema fetch is pending,
// failed, or unavailable.
function requirePath(
  errors: ValidationError[],
  path: string,
  field: string,
  value: unknown,
  message: string
): void {
  if (!hasValue(value) || (typeof value === "string" && isPlaceholderJsonPath(value))) {
    errors.push({ path, field, message, severity: "error" });
  }
}

export function validateExpressionTree(expr: Expression, path = "root"): ValidationError[] {
  const errors: ValidationError[] = [];
  const type = getExpressionType(expr);
  const data = getExpressionData(expr);

  if (["and", "or", "not"].includes(type)) {
    const children = data.children as Expression[] | undefined;
    if (!children || children.length === 0) {
      const emptyGroupMessage =
        type === "and"
          ? "This group needs at least one condition to match all of."
          : type === "or"
            ? "This group needs at least one condition to match any of."
            : "This NOT group needs a condition to negate.";
      errors.push({
        path,
        field: "children",
        message: emptyGroupMessage,
        severity: "error",
      });
    } else {
      children.forEach((child, idx) => {
        errors.push(...validateExpressionTree(child, `${path}.children[${idx}]`));
      });
    }
  }

  // Friendly label for this node's operator, reusing the same names shown in
  // the type selector and card-mode badges — so a validation message never
  // speaks in raw DSL keys the user hasn't seen anywhere else in the UI.
  const name = EXPRESSION_TYPE_NAMES[type] ?? type;

  if ("path" in data && typeof data.path === "string" && data.path) {
    if (!data.path.startsWith("$.")) {
      errors.push({
        path,
        field: "path",
        message: "This field path looks incomplete — it should start with $.",
        severity: "error",
      });
    }
  }

  if (COMPARISON_OPS.has(type)) {
    requirePath(errors, path, "path", data.path, `${name} needs a field selected.`);
    if (!data.extractValueFromPath && !hasValue(data.value)) {
      errors.push({
        path,
        field: "value",
        message: `${name} needs a value (or compare it to another field).`,
        severity: "error",
      });
    }
  }

  if (type === "between") {
    requirePath(errors, path, "path", data.path, "Between needs a field selected.");
    if (!data.extractValueFromPath) {
      if (!hasValue(data.lowerBound)) {
        errors.push({
          path,
          field: "lowerBound",
          message: "Between needs a starting value.",
          severity: "error",
        });
      }
      if (!hasValue(data.upperBound)) {
        errors.push({
          path,
          field: "upperBound",
          message: "Between needs an ending value.",
          severity: "error",
        });
      }
    }
  }

  if (COLLECTION_OPS.has(type)) {
    requirePath(errors, path, "path", data.path, `${name} needs a field selected.`);
    const values = data.values as unknown[] | undefined;
    if (!data.extractValues && (!values || values.length === 0)) {
      errors.push({
        path,
        field: "values",
        message: `${name} needs at least one value (or compare it to another field).`,
        severity: "error",
      });
    }
  }

  if (PATH_ONLY_OPS.has(type)) {
    requirePath(errors, path, "path", data.path, `${name} needs a field selected.`);
  }

  if (type === "hasBadge") {
    requireField(errors, path, "badgeId", data.badgeId, "This condition needs a badge selected.");
  }
  if (type === "currentTier") {
    requireField(errors, path, "tierCode", data.tierCode, "This condition needs a tier selected.");
  }
  if (type === "targetCompleted") {
    requireField(
      errors,
      path,
      "targetId",
      data.targetId,
      "This condition needs a target selected."
    );
  }
  if (type === "hasProgramCurrency") {
    requireField(
      errors,
      path,
      "programCurrencyCode",
      data.programCurrencyCode,
      "This condition needs a currency selected."
    );
  }

  if (METADATA_OPS.has(type)) {
    requirePath(errors, path, "path", data.path, `${name} needs a field selected.`);
    // The event target is normally the customer, so the metadata code has to come
    // from an event-data field the event type declares (e.g. $.eventData.STORE).
    if (
      typeof data.path === "string" &&
      hasValue(data.path) &&
      !isPlaceholderJsonPath(data.path) &&
      !data.path.startsWith("$.eventData.")
    ) {
      errors.push({
        path,
        field: "path",
        message: `${name} must read an event data field ($.eventData.…) that holds the metadata code.`,
        severity: "error",
      });
    }
    requireField(
      errors,
      path,
      "metadataTypeCode",
      data.metadataTypeCode,
      `${name} needs a metadata type selected.`
    );
  }
  if (type === "inMetadataGroup") {
    requireField(
      errors,
      path,
      "metadataGroupCode",
      data.metadataGroupCode,
      "In Metadata Group needs a group code."
    );
  }
  if (type === "isChildMetadata") {
    requireField(
      errors,
      path,
      "parentTypeCode",
      data.parentTypeCode,
      "Is Under Metadata needs a parent metadata type selected."
    );
    requireField(
      errors,
      path,
      "parentCode",
      data.parentCode,
      "Is Under Metadata needs a parent metadata entry selected."
    );
  }

  // Event-window / aggregate ops (audience-only). Every one keys off an event
  // type code; the count/sum/time variants add their own required threshold.
  if (EVENT_WINDOW_OPS.has(type)) {
    requireField(
      errors,
      path,
      "eventTypeCode",
      data.eventTypeCode,
      `${name} needs an event type selected.`
    );
  }
  if (type === "eventCount") {
    requireField(errors, path, "minCount", data.minCount, "Event Count needs a minimum count.");
  }
  if (type === "eventSum") {
    requirePath(errors, path, "fieldPath", data.fieldPath, "Event Sum needs a field selected.");
    requireField(errors, path, "minSum", data.minSum, "Event Sum needs a minimum total.");
  }
  if (type === "lastEventTime") {
    requireField(
      errors,
      path,
      "maxDaysSinceLast",
      data.maxDaysSinceLast,
      "Last Event Within needs a number of days."
    );
  }
  if (type === "funnelStage") {
    requireField(errors, path, "stage", data.stage, "Funnel Stage needs a stage selected.");
  }

  const actions = getExpressionActions(expr);
  actions?.forEach((action, index) => {
    if (getActionType(action) !== "sendNotification") return;
    const actionData = getActionData(action);
    const actionPath = `${path}.actions[${index}]`;
    requireField(
      errors,
      actionPath,
      "channelCode",
      actionData.channelCode,
      "Send Notification needs a channel code."
    );
    requireField(
      errors,
      actionPath,
      "templateCode",
      actionData.templateCode,
      "Send Notification needs a template code."
    );
  });

  const depth = getExpressionDepth(expr);
  if (depth > 5) {
    errors.push({
      path,
      field: "depth",
      message: `Expression tree is ${depth} levels deep. Consider simplifying.`,
      severity: "warning",
    });
  }

  return errors;
}

// =============================================================================
// CATEGORIES & DISPLAY NAMES
// =============================================================================

export const EXPRESSION_CATEGORIES: Record<string, string[]> = {
  Logical: ["and", "or", "not"],
  Comparison: [
    "equals",
    "notEquals",
    "greaterThan",
    "lessThan",
    "greaterThanEquals",
    "lessThanEquals",
    "between",
  ],
  String: ["startsWith", "endsWith", "matches", "empty", "notEmpty"],
  Collection: ["in", "notIn", "containsAny", "containsAll"],
  Structural: ["exists", "notExists", "true"],
  Loyalty: ["hasBadge", "currentTier", "targetCompleted", "hasProgramCurrency"],
  // Event-only: the backend offers these on the event surface only, so
  // ExpressionTypeSelector gates them out of the customer vocabulary.
  Metadata: ["isMetadataType", "inMetadataGroup", "isChildMetadata"],
  // Audience-only aggregates. Surface-gated out of the event vocabulary by
  // ExpressionTypeSelector (the runtime evaluate() returns false for these on
  // the event surface, so emitting them there produces silent dead rules).
  "Event Behavior": ["eventCount", "eventSum", "eventExists", "lastEventTime", "funnelStage"],
};

// Adding a new action type touches FIVE places kept in sync by hand, not by
// the compiler (adversarial review finding — a miss here fails silently: an
// "Unknown action type" editor and a "Set action details" summary chip, not
// a build error). Update all five together:
//   1. ACTION_CATEGORIES (below) — the entry point via ActionTypePicker
//   2. ACTION_TYPE_NAMES (below) — display label
//   3. action-category-colors.ts's ACTION_COLOR_CLASSES — category accent color
//   4. action-row.tsx's renderActionComponent switch AND
//      action-summaries.tsx's getActionSummary switch — both must add a case
//   5. createDefaultAction (below) — required initial fields for a new draft
export const ACTION_CATEGORIES: Record<string, string[]> = {
  Currency: ["issueProgramCurrency", "withdrawProgramCurrency"],
  Coupons: [
    "issueCustomerCoupon",
    "useCustomerCoupon",
    "holdCustomerCoupon",
    "returnCustomerCoupon",
    "cancelCustomerCoupon",
  ],
  "Badges & Tiers": ["issueCustomerBadge", "issueCustomerTier"],
  Targets: ["registerTarget", "addCounterData", "completeTargetData"],
  Audiences: ["addCustomerToAudience", "removeCustomerFromAudience"],
  Metadata: ["metadataTagging"],
  Notifications: ["sendNotification"],
  "External Offers": ["issueCustomerExternalOffer", "cancelCustomerExternalOffer"],
};

export const EXPRESSION_TYPE_NAMES: Record<string, string> = {
  and: "AND",
  or: "OR",
  not: "NOT",
  equals: "Equals",
  notEquals: "Not Equals",
  greaterThan: "Greater Than",
  greaterThanEquals: "Greater Than or Equal",
  lessThan: "Less Than",
  lessThanEquals: "Less Than or Equal",
  between: "Between",
  startsWith: "Starts With",
  endsWith: "Ends With",
  matches: "Matches (Regex)",
  empty: "Is Empty",
  notEmpty: "Is Not Empty",
  in: "In",
  notIn: "Not In",
  containsAny: "Contains Any",
  containsAll: "Contains All",
  exists: "Exists",
  notExists: "Not Exists",
  true: "Always True",
  hasBadge: "Has Badge",
  currentTier: "Current Tier",
  targetCompleted: "Target Completed",
  hasProgramCurrency: "Has Program Currency",
  isMetadataType: "Is Metadata",
  inMetadataGroup: "In Metadata Group",
  isChildMetadata: "Is Under Metadata",
  eventCount: "Event Count",
  eventSum: "Event Sum",
  eventExists: "Event Occurred",
  lastEventTime: "Last Event Within",
  funnelStage: "Funnel Stage",
};

export const ACTION_TYPE_NAMES: Record<string, string> = {
  issueProgramCurrency: "Issue Currency",
  withdrawProgramCurrency: "Withdraw Currency",
  issueCustomerCoupon: "Issue Coupon",
  useCustomerCoupon: "Use Coupon",
  holdCustomerCoupon: "Hold Coupon",
  returnCustomerCoupon: "Return Coupon",
  cancelCustomerCoupon: "Cancel Coupon",
  issueCustomerBadge: "Issue Badge",
  issueCustomerTier: "Issue Tier",
  registerTarget: "Register Target",
  addCounterData: "Add Counter Data",
  completeTargetData: "Complete Target",
  addCustomerToAudience: "Add to Audience",
  removeCustomerFromAudience: "Remove from Audience",
  metadataTagging: "Tag Metadata",
  sendNotification: "Send Notification",
  issueCustomerExternalOffer: "Issue External Offer",
  cancelCustomerExternalOffer: "Cancel External Offer",
};

// =============================================================================
// FACTORY FUNCTIONS
// =============================================================================

/**
 * Create a default expression for a given type.
 * @param type - The expression type name (e.g., "equals", "greaterThan", "and")
 * @param rootPath - The default path prefix for path-based expressions. Defaults to "$.eventData." for backward compatibility. Customer segments should pass "$.".
 */
export function createDefaultExpression(type: string, rootPath = "$.eventData."): Expression {
  switch (type) {
    case "and":
      return { and: { children: [] } };
    case "or":
      return { or: { children: [] } };
    case "not":
      return { not: { children: [] } };
    case "equals":
      return {
        equals: {
          path: rootPath,
          value: "",
          extractValueFromPath: false,
          defaultResult: false,
        },
      };
    case "notEquals":
      return {
        notEquals: {
          path: rootPath,
          value: "",
          extractValueFromPath: false,
          defaultResult: false,
        },
      };
    case "greaterThan":
      return {
        greaterThan: {
          path: rootPath,
          value: 0,
          extractValueFromPath: false,
        },
      };
    case "greaterThanEquals":
      return {
        greaterThanEquals: {
          path: rootPath,
          value: 0,
          extractValueFromPath: false,
        },
      };
    case "lessThan":
      return {
        lessThan: {
          path: rootPath,
          value: 0,
          extractValueFromPath: false,
        },
      };
    case "lessThanEquals":
      return {
        lessThanEquals: {
          path: rootPath,
          value: 0,
          extractValueFromPath: false,
        },
      };
    case "between":
      return {
        between: {
          path: rootPath,
          lowerBound: 0,
          upperBound: 100,
          extractValueFromPath: false,
        },
      };
    case "startsWith":
      return {
        startsWith: {
          path: rootPath,
          value: "",
          ignoreCase: false,
          extractValueFromPath: false,
        },
      };
    case "endsWith":
      return {
        endsWith: {
          path: rootPath,
          value: "",
          ignoreCase: false,
          extractValueFromPath: false,
        },
      };
    case "matches":
      return {
        matches: {
          path: rootPath,
          value: "",
          ignoreCase: false,
          extractValueFromPath: false,
        },
      };
    case "empty":
      return { empty: { path: rootPath } };
    case "notEmpty":
      return { notEmpty: { path: rootPath } };
    case "in":
      return {
        in: {
          path: rootPath,
          values: [],
          extractValues: false,
        },
      };
    case "notIn":
      return {
        notIn: {
          path: rootPath,
          values: [],
          extractValues: false,
        },
      };
    case "containsAny":
      return {
        containsAny: {
          path: rootPath,
          values: [],
          extractValues: false,
        },
      };
    case "containsAll":
      return {
        containsAll: {
          path: rootPath,
          values: [],
          extractValues: false,
        },
      };
    case "exists":
      return { exists: { path: rootPath } };
    case "notExists":
      return { notExists: { path: rootPath } };
    case "true":
      return { true: {} };
    case "hasBadge":
      return { hasBadge: { badgeId: "", revalidateBadge: false } };
    case "currentTier":
      return {
        currentTier: {
          tierCode: "",
          validateLifetimeTier: false,
          validateTrialTier: false,
          revalidateTier: false,
        },
      };
    case "targetCompleted":
      return {
        targetCompleted: { targetId: "", revalidateTarget: false },
      };
    case "hasProgramCurrency":
      return {
        hasProgramCurrency: { programCurrencyCode: "" },
      };
    case "isMetadataType":
      return { isMetadataType: { path: rootPath, metadataTypeCode: "", metadataCode: "" } };
    case "inMetadataGroup":
      return { inMetadataGroup: { path: rootPath, metadataGroupCode: "", metadataTypeCode: "" } };
    case "isChildMetadata":
      return {
        isChildMetadata: {
          path: rootPath,
          metadataTypeCode: "",
          parentTypeCode: "",
          parentCode: "",
          directOnly: false,
        },
      };
    case "eventCount":
      return { eventCount: { eventTypeCode: "", minCount: 1 } };
    case "eventSum":
      return { eventSum: { eventTypeCode: "", fieldPath: "$.", minSum: 0 } };
    case "eventExists":
      return { eventExists: { eventTypeCode: "" } };
    case "lastEventTime":
      return { lastEventTime: { eventTypeCode: "", maxDaysSinceLast: 30 } };
    case "funnelStage":
      return { funnelStage: { stage: "AWARENESS" } };
    default:
      return { true: {} };
  }
}

export function createDefaultAction(type: string): ExpressionAction {
  switch (type) {
    case "issueProgramCurrency":
      return {
        issueProgramCurrency: {
          defaultResult: 0,
          isFixedAmount: true,
          programCurrencyCode: "POINTS",
        },
      };
    case "withdrawProgramCurrency":
      return {
        withdrawProgramCurrency: {
          defaultResult: 0,
          isFixedAmount: true,
          programCurrencyCode: "POINTS",
        },
      };
    case "issueCustomerCoupon":
      return { issueCustomerCoupon: {} };
    case "useCustomerCoupon":
      return { useCustomerCoupon: {} };
    case "holdCustomerCoupon":
      return { holdCustomerCoupon: {} };
    case "returnCustomerCoupon":
      return { returnCustomerCoupon: {} };
    case "cancelCustomerCoupon":
      return { cancelCustomerCoupon: {} };
    case "issueCustomerBadge":
      return { issueCustomerBadge: {} };
    case "issueCustomerTier":
      return {
        issueCustomerTier: {
          issueLifetimeTier: false,
          issueTrialTier: false,
        },
      };
    case "registerTarget":
      return { registerTarget: {} };
    case "addCounterData":
      return {
        addCounterData: {
          defaultResult: 1,
          isFixedAmount: true,
        },
      };
    case "completeTargetData":
      return { completeTargetData: {} };
    case "addCustomerToAudience":
      return { addCustomerToAudience: {} };
    case "removeCustomerFromAudience":
      return { removeCustomerFromAudience: {} };
    case "metadataTagging":
      return { metadataTagging: { metadataTypeCode: "", metadataCode: "" } };
    case "sendNotification":
      return { sendNotification: { channelCode: "", templateCode: "" } };
    case "issueCustomerExternalOffer":
      return { issueCustomerExternalOffer: {} };
    case "cancelCustomerExternalOffer":
      return { cancelCustomerExternalOffer: {} };
    default:
      return {
        issueProgramCurrency: {
          defaultResult: 0,
          isFixedAmount: true,
          programCurrencyCode: "POINTS",
        },
      };
  }
}

export function getActionType(action: ExpressionAction): string {
  return Object.keys(action)[0] ?? "";
}

export function getActionData(action: ExpressionAction): Record<string, unknown> {
  const type = getActionType(action);
  return (action as unknown as Record<string, Record<string, unknown>>)[type] ?? {};
}
