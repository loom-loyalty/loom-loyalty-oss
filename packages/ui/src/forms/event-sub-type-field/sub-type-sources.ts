/**
 * What an event type's sub type names (`subTypeSource` on an EVENT_TYPE data
 * type). The platform sets it for its own event types (target.achieved →
 * TARGET) and a tenant may set it on a custom one. A value this list doesn't
 * know (a newer platform release) is treated as no source: the caller falls
 * back to the free-text sub type.
 */

export const EVENT_SUB_TYPE_SOURCES = [
  "TARGET",
  "TIER",
  "BADGE",
  "COUPON",
  "OFFER",
  "CUSTOMER_AUDIENCE",
  "PROGRAM",
  "EVENT_RULE",
] as const;

export type EventSubTypeSource = (typeof EVENT_SUB_TYPE_SOURCES)[number];

/** Singular, lower-case noun for a source, for "Any target" and "Sub type comes from". */
export const EVENT_SUB_TYPE_SOURCE_LABELS: Record<EventSubTypeSource, string> = {
  TARGET: "target",
  TIER: "tier",
  BADGE: "badge",
  COUPON: "coupon code",
  OFFER: "offer",
  CUSTOMER_AUDIENCE: "audience",
  PROGRAM: "program",
  EVENT_RULE: "reward rule",
};

export function toEventSubTypeSource(value: unknown): EventSubTypeSource | undefined {
  return typeof value === "string" && (EVENT_SUB_TYPE_SOURCES as readonly string[]).includes(value)
    ? (value as EventSubTypeSource)
    : undefined;
}
