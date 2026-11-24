/**
 * What changed between two versions of one event rule, by field group, for the
 * read-only Version history dialog (fe#1933). Only content counts: ids,
 * version numbers, statuses, dates and trace settings never make a group
 * "changed". Values are normalized first, so a missing, null or empty list
 * equals another, set-like lists (programs, environments) ignore order, and
 * object key order never matters.
 */

import type { EntityRecord } from "../../entity-list.js";

export type EventRuleDiffGroupKey =
  | "basics"
  | "trigger"
  | "conditions"
  | "actions"
  | "targets"
  | "programs"
  | "environments"
  | "customFields";

export interface EventRuleDiffGroup {
  key: EventRuleDiffGroupKey;
  label: string;
  changed: boolean;
  /** The group's normalized fields on the older ("before") version. */
  before: Record<string, unknown>;
  /** The group's normalized fields on the newer ("after") version. */
  after: Record<string, unknown>;
}

const GROUP_FIELDS: Record<Exclude<EventRuleDiffGroupKey, "customFields">, readonly string[]> = {
  basics: ["name", "description"],
  trigger: ["eventTypeCode", "eventSubTypeIdentifier", "category"],
  conditions: ["eventExpression"],
  actions: ["eventActionsExpression", "processItemsIndividually", "rollUpEventRuleResults"],
  targets: [
    "promotionTargetId",
    "occurrenceTargets",
    "currencyTargets",
    "programCurrencyTargetsToExclude",
  ],
  programs: ["programIds"],
  environments: ["enabledInEnvironments"],
};

export const EVENT_RULE_DIFF_GROUP_LABELS: Record<EventRuleDiffGroupKey, string> = {
  basics: "Name and description",
  trigger: "Trigger",
  conditions: "Conditions",
  actions: "Actions",
  targets: "Targets",
  programs: "Programs",
  environments: "Environments",
  customFields: "Custom fields",
};

const GROUP_ORDER: readonly EventRuleDiffGroupKey[] = [
  "basics",
  "trigger",
  "conditions",
  "actions",
  "targets",
  "programs",
  "environments",
  "customFields",
];

/**
 * Fields that are never content: bookkeeping, embedded copies of other
 * entities, and response-only extras. Anything not here and not in a group is
 * an org's extended (custom) field.
 */
const NOT_CONTENT = new Set<string>([
  "code",
  "eventRuleId",
  "version",
  "versionStatus",
  "openDraftVersion",
  "createdDateTime",
  "modifiedDateTime",
  "createdBy",
  "modifiedBy",
  "traceMode",
  "traceRetentionDays",
  "traceEnabledAtDateTime",
  "eventType",
  "promotionTarget",
  "unsubscribedWebhookPushEventTypeCodes",
  "entityType",
  "entityId",
  "organizationId",
  "properties",
]);

const GROUPED = new Set(Object.values(GROUP_FIELDS).flat());

/**
 * Compares `before` (the older version) with `after` (the newer one) and
 * returns every group in a fixed order, each marked changed or not.
 */
export function diffEventRuleVersions(
  before: EntityRecord,
  after: EntityRecord
): EventRuleDiffGroup[] {
  return GROUP_ORDER.map((key) => {
    const beforeFields = groupFields(key, before, after);
    const afterFields = groupFields(key, after, before);
    return {
      key,
      label: EVENT_RULE_DIFF_GROUP_LABELS[key],
      changed: stableStringify(beforeFields) !== stableStringify(afterFields),
      before: beforeFields,
      after: afterFields,
    };
  });
}

/**
 * The pair the dialog compares first: the newest version against the one
 * before it, except that a draft is compared with the live (or paused)
 * version it will replace, when there is one below it.
 */
export function defaultComparePair(
  versions: EntityRecord[]
): { before: EntityRecord; after: EntityRecord } | null {
  const sorted = [...versions].sort((a, b) => versionOf(b) - versionOf(a));
  const after = sorted[0];
  if (!after || sorted.length < 2) return null;
  const older = sorted.slice(1);
  const live =
    after.versionStatus === "DRAFT"
      ? older.find((v) => v.versionStatus === "PUBLISHED" || v.versionStatus === "PAUSED")
      : undefined;
  const before = live ?? older[0];
  return before ? { before, after } : null;
}

export function versionOf(record: EntityRecord): number {
  const version = record.version;
  return typeof version === "number" ? version : 0;
}

function groupFields(
  key: EventRuleDiffGroupKey,
  record: EntityRecord,
  other: EntityRecord
): Record<string, unknown> {
  if (key === "customFields") {
    // Both sides list the same keys, so a field added on one side shows as
    // "none" on the other.
    const keys = new Set([...customFieldKeys(record), ...customFieldKeys(other)]);
    return Object.fromEntries(
      [...keys].sort().map((field) => [field, normalizeValue(field, record[field])])
    );
  }
  return Object.fromEntries(
    GROUP_FIELDS[key].map((field) => [field, normalizeValue(field, record[field])])
  );
}

function customFieldKeys(record: EntityRecord): string[] {
  return Object.keys(record).filter((field) => !GROUPED.has(field) && !NOT_CONTENT.has(field));
}

/** Null for anything empty; canonical forms for expressions and set-like lists. */
export function normalizeValue(field: string, value: unknown): unknown {
  if (isEmpty(value)) return null;
  // Expressions compare as stored, not through normalizeExpression: that drops
  // shapes it doesn't know, so two different unknown nodes would compare equal
  // and the diff would miss a change. A legacy field-name rename therefore
  // counts as a change, which is true of what is stored.
  if (field === "programIds" && Array.isArray(value)) {
    return [...value].map(String).sort();
  }
  if (field === "enabledInEnvironments" && Array.isArray(value)) {
    // One entry per environment, sorted so list order never counts, and the
    // enablement window kept because it decides when the rule is live there.
    const entries = value
      .map((env) => {
        const e = env as Record<string, unknown> | null;
        const code = String(e?.environmentCode ?? e?.organizationEnvironmentId ?? "");
        return code === "" ? "" : `${code}${describeWindow(e?.dateTimePeriod)}`;
      })
      .filter((entry) => entry !== "");
    return entries.length ? [...new Set(entries)].sort() : null;
  }
  if (field === "processItemsIndividually" || field === "rollUpEventRuleResults") {
    // The API defaults it to false; a missing value means the same.
    return value === true ? true : null;
  }
  return canonical(value);
}

function describeWindow(period: unknown): string {
  if (!period || typeof period !== "object") return "";
  const p = period as Record<string, unknown>;
  const start = typeof p.startDateTime === "string" ? p.startDateTime : "";
  const end = typeof p.endDateTime === "string" ? p.endDateTime : "";
  const zone = typeof p.timeZone === "string" ? p.timeZone : "";
  if (!start && !end) return "";
  const range = end ? `${start || "…"} to ${end}` : `from ${start}`;
  return ` (${range}${zone ? `, ${zone}` : ""})`;
}

function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "object") return Object.keys(value as object).length === 0;
  return false;
}

/** Drops empty object entries and sorts keys, recursively; array order is kept. */
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => !isEmpty(v))
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, v]) => [k, canonical(v)] as const);
    return Object.fromEntries(entries);
  }
  return value;
}

function stableStringify(value: unknown): string {
  return JSON.stringify(canonical(value));
}
