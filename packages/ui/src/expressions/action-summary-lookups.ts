import { useMemo } from "react";

import { useBadgeField } from "../forms/badge-field/use-badge-field.js";
import { useCustomerAudienceField } from "../forms/customer-audience-field/use-customer-audience-field.js";
import { useEventRuleField } from "../forms/event-rule-field/use-event-rule-field.js";
import { useOfferField } from "../forms/offer-field/use-offer-field.js";
import { useProgramField } from "../forms/program-field/use-program-field.js";
import { useTargetField } from "../forms/target-field/use-target-field.js";
import { useTierField } from "../forms/tier-field/use-tier-field.js";
import { useActionSchemaFieldNames } from "./action-schema-field-names.js";
import type { ExpressionAction } from "./types.js";

export interface ActionSummaryLookups {
  programName: (id?: string, code?: string) => string | undefined;
  offerName: (id?: string, code?: string) => string | undefined;
  badgeName: (id?: string, code?: string) => string | undefined;
  tierName: (id?: string, code?: string) => string | undefined;
  targetName: (id?: string, code?: string) => string | undefined;
  eventRuleName: (id?: string, code?: string) => string | undefined;
  audienceName: (id?: string, code?: string) => string | undefined;
  fieldName: (path: string) => string | undefined;
}

/** Exported for direct unit testing — not part of this package's public API. */
export function nameFrom<T extends { name?: string; code?: string }>(
  items: T[],
  id: string | undefined,
  code: string | undefined,
  idKey: keyof T
): string | undefined {
  if (!id && !code) return undefined;
  const match = items.find(
    (item) => (id !== undefined && item[idKey] === id) || (code !== undefined && item.code === code)
  );
  return match?.name ?? code;
}

// Field names each resolver's `id`/`code` pair can appear under across the
// action types that use it (see action-summaries.tsx's `resolved()` call
// sites) — used to skip fetching a collection no action in the current band
// actually references (adversarial review finding: this hook fired all 7
// entity-list queries unconditionally on every mount).
const PROGRAM_KEYS = ["programId", "programCode"];
const OFFER_KEYS = ["couponOfferId", "couponOfferCode", "offerId", "offerCode"];
const BADGE_KEYS = ["badgeId", "badgeCode"];
const TIER_KEYS = ["tierId", "tierCode"];
const TARGET_KEYS = ["targetId", "targetCode"];
const EVENT_RULE_KEYS = ["eventRuleId", "eventRuleCode"];
const AUDIENCE_KEYS = ["customerAudienceId", "customerAudienceCode"];

function collectActionKeys(actions: ExpressionAction[]): Set<string> {
  const keys = new Set<string>();
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (value && typeof value === "object") {
      Object.entries(value as Record<string, unknown>).forEach(([key, entryValue]) => {
        keys.add(key);
        visit(entryValue);
      });
    }
  };
  actions.forEach(visit);
  return keys;
}

function hasAny(keys: Set<string>, candidates: string[]): boolean {
  return candidates.some((key) => keys.has(key));
}

/** Loads each action-reference collection once for the full action band. */
export function useActionSummaryLookups(actions: ExpressionAction[]): ActionSummaryLookups {
  const keys = useMemo(() => collectActionKeys(actions), [actions]);
  const { programs } = useProgramField({ enabled: hasAny(keys, PROGRAM_KEYS) });
  const { offers } = useOfferField({ enabled: hasAny(keys, OFFER_KEYS) });
  const { badges } = useBadgeField({ enabled: hasAny(keys, BADGE_KEYS) });
  const { tiers } = useTierField({ enabled: hasAny(keys, TIER_KEYS) });
  const { targets } = useTargetField({ enabled: hasAny(keys, TARGET_KEYS) });
  const { eventRules } = useEventRuleField({ enabled: hasAny(keys, EVENT_RULE_KEYS) });
  const { audiences } = useCustomerAudienceField({ enabled: hasAny(keys, AUDIENCE_KEYS) });
  const { fieldName } = useActionSchemaFieldNames(actions);

  return useMemo(
    () => ({
      programName: (id, code) => nameFrom(programs, id, code, "programId"),
      offerName: (id, code) => nameFrom(offers, id, code, "offerId"),
      badgeName: (id, code) => nameFrom(badges, id, code, "badgeId"),
      tierName: (id, code) => nameFrom(tiers, id, code, "tierId"),
      targetName: (id, code) => nameFrom(targets, id, code, "targetId"),
      eventRuleName: (id, code) => nameFrom(eventRules, id, code, "eventRuleId"),
      audienceName: (id, code) => nameFrom(audiences, id, code, "customerAudienceId"),
      fieldName,
    }),
    [programs, offers, badges, tiers, targets, eventRules, audiences, fieldName]
  );
}
