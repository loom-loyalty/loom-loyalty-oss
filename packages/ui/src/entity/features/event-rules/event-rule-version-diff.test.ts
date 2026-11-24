import { describe, expect, it } from "vitest";

import type { EntityRecord } from "../../entity-list.js";
import {
  defaultComparePair,
  diffEventRuleVersions,
  type EventRuleDiffGroupKey,
} from "./event-rule-version-diff.js";

const condition = (value: number) => ({ greaterThan: { field: "$.amount", value } });

function rule(overrides: EntityRecord = {}): EntityRecord {
  return {
    eventRuleId: "id-1",
    code: "free-wash",
    version: 1,
    versionStatus: "PUBLISHED",
    name: "Free Wash",
    description: "One free wash",
    category: "EARN",
    eventTypeCode: "PURCHASE",
    eventExpression: condition(10),
    eventActionsExpression: { issueCoupon: { offerCode: "wash" } },
    programIds: ["p1", "p2"],
    enabledInEnvironments: [{ environmentCode: "development" }, { environmentCode: "production" }],
    createdDateTime: "2026-11-18T10:00:00Z",
    modifiedDateTime: "2026-11-18T10:00:00Z",
    ...overrides,
  };
}

const changed = (groups: ReturnType<typeof diffEventRuleVersions>): EventRuleDiffGroupKey[] =>
  groups.filter((g) => g.changed).map((g) => g.key);

describe("diffEventRuleVersions", () => {
  it("V1: a conditions-only change marks only Conditions, with before and after", () => {
    const v1 = rule();
    const v2 = rule({ eventRuleId: "id-2", version: 2, eventExpression: condition(20) });

    const groups = diffEventRuleVersions(v1, v2);

    expect(changed(groups)).toEqual(["conditions"]);
    const conditions = groups.find((g) => g.key === "conditions");
    expect(conditions?.before.eventExpression).toEqual(condition(10));
    expect(conditions?.after.eventExpression).toEqual(condition(20));
  });

  it("V2: comparing v3 with v1 shows changes across both steps", () => {
    const v1 = rule();
    const v3 = rule({ version: 3, name: "Free Wash+", eventExpression: condition(30) });

    expect(changed(diffEventRuleVersions(v1, v3))).toEqual(["basics", "conditions"]);
  });

  it("V3: identical content changes nothing", () => {
    expect(changed(diffEventRuleVersions(rule(), rule({ version: 2 })))).toEqual([]);
  });

  it("V5: environment and program order never counts as a change", () => {
    const v2 = rule({
      version: 2,
      programIds: ["p2", "p1"],
      enabledInEnvironments: [
        { environmentCode: "production" },
        { environmentCode: "development" },
      ],
    });
    expect(changed(diffEventRuleVersions(rule(), v2))).toEqual([]);
  });

  it("V5: a dropped environment is a change", () => {
    const v2 = rule({ version: 2, enabledInEnvironments: [{ environmentCode: "development" }] });
    expect(changed(diffEventRuleVersions(rule(), v2))).toEqual(["environments"]);
  });

  it("a changed enablement window is an Environments change; the same window in another order is not", () => {
    const window = (start: string, end?: string) => ({
      startDateTime: start,
      ...(end ? { endDateTime: end } : {}),
      timeZone: "America/Chicago",
    });
    const v1 = rule({
      enabledInEnvironments: [
        { environmentCode: "development", dateTimePeriod: window("2026-11-01T00:00:00Z") },
        { environmentCode: "production", dateTimePeriod: window("2026-12-01T00:00:00Z") },
      ],
    });
    const reordered = rule({
      version: 2,
      enabledInEnvironments: [
        { environmentCode: "production", dateTimePeriod: window("2026-12-01T00:00:00Z") },
        { environmentCode: "development", dateTimePeriod: window("2026-11-01T00:00:00Z") },
      ],
    });
    const newEnd = rule({
      version: 2,
      enabledInEnvironments: [
        { environmentCode: "development", dateTimePeriod: window("2026-11-01T00:00:00Z") },
        {
          environmentCode: "production",
          dateTimePeriod: window("2026-12-01T00:00:00Z", "2027-01-01T00:00:00Z"),
        },
      ],
    });
    expect(changed(diffEventRuleVersions(v1, reordered))).toEqual([]);
    expect(changed(diffEventRuleVersions(v1, newEnd))).toEqual(["environments"]);
  });

  it("a changed roll-up setting is an Actions change; false and missing are the same", () => {
    expect(changed(diffEventRuleVersions(rule(), rule({ rollUpEventRuleResults: true })))).toEqual([
      "actions",
    ]);
    expect(changed(diffEventRuleVersions(rule(), rule({ rollUpEventRuleResults: false })))).toEqual(
      []
    );
  });

  it("V6: bookkeeping alone is never a change", () => {
    const v2 = rule({
      eventRuleId: "id-2",
      version: 2,
      versionStatus: "DRAFT",
      createdDateTime: "2026-11-21T10:00:00Z",
      modifiedDateTime: "2026-11-21T11:00:00Z",
      traceMode: "ALL",
      traceEnabledAtDateTime: "2026-11-21T11:00:00Z",
      openDraftVersion: 3,
      eventType: { code: "PURCHASE", name: "Purchase" },
    });
    expect(changed(diffEventRuleVersions(rule(), v2))).toEqual([]);
  });

  it("V9: a custom field added, removed or changed marks Custom fields", () => {
    const withTier = rule({ tierCode: "gold" });
    expect(changed(diffEventRuleVersions(rule(), withTier))).toEqual(["customFields"]);
    expect(changed(diffEventRuleVersions(withTier, rule()))).toEqual(["customFields"]);
    expect(changed(diffEventRuleVersions(withTier, rule({ tierCode: "silver" })))).toEqual([
      "customFields",
    ]);
    const custom = diffEventRuleVersions(rule(), withTier).find((g) => g.key === "customFields");
    expect(custom?.before).toEqual({ tierCode: null });
    expect(custom?.after).toEqual({ tierCode: "gold" });
  });

  it("V10: null, missing and empty compare equal; null against a value is a change", () => {
    const empty = rule({ programIds: [], description: "", occurrenceTargets: null });
    const missing = rule();
    delete missing.programIds;
    delete missing.description;
    expect(changed(diffEventRuleVersions(empty, missing))).toEqual([]);
    expect(changed(diffEventRuleVersions(rule({ eventExpression: null }), rule()))).toEqual([
      "conditions",
    ]);
  });

  it("an expression shape the normalizer doesn't know still shows as a change", () => {
    const v1 = rule({ eventExpression: { futureOperator: { field: "$.a", value: 1 } } });
    const v2 = rule({ eventExpression: { futureOperator: { field: "$.a", value: 2 } } });
    expect(changed(diffEventRuleVersions(v1, v2))).toEqual(["conditions"]);
  });

  it("returns every group in a fixed order", () => {
    expect(diffEventRuleVersions(rule(), rule()).map((g) => g.key)).toEqual([
      "basics",
      "trigger",
      "conditions",
      "actions",
      "targets",
      "programs",
      "environments",
      "customFields",
    ]);
  });
});

describe("diffEventRuleVersions properties (V11)", () => {
  // Seeded generator, so a failure reproduces.
  function rng(seed: number) {
    let state = seed;
    return () => {
      state = (state * 1103515245 + 12345) % 2147483648;
      return state / 2147483648;
    };
  }
  const pick = <T>(random: () => number, options: readonly T[]): T =>
    options[Math.floor(random() * options.length)] as T;

  function randomRule(random: () => number): EntityRecord {
    const record: EntityRecord = {
      eventRuleId: String(random()),
      version: Math.floor(random() * 9) + 1,
      versionStatus: pick(random, ["DRAFT", "PUBLISHED", "PAUSED", "ARCHIVED"]),
      modifiedDateTime: String(random()),
      name: pick(random, ["A", "B"]),
      description: pick(random, [undefined, "", "d"]),
      eventTypeCode: pick(random, ["PURCHASE", "CHECK_IN"]),
      eventExpression: pick(random, [null, condition(1), condition(2)]),
      programIds: pick(random, [[], ["p1"], ["p1", "p2"], ["p2", "p1"], undefined]),
      enabledInEnvironments: pick(random, [
        [],
        [{ environmentCode: "development" }],
        [{ environmentCode: "production" }, { environmentCode: "development" }],
      ]),
    };
    if (random() < 0.3) record.tierCode = pick(random, ["gold", "silver"]);
    return record;
  }

  it("diff(a, a) is empty; changed groups are symmetric; changed iff normalized fields differ", () => {
    const random = rng(20261121);
    for (let i = 0; i < 300; i++) {
      const a = randomRule(random);
      const b = randomRule(random);
      expect(changed(diffEventRuleVersions(a, a))).toEqual([]);
      const ab = diffEventRuleVersions(a, b);
      expect(changed(ab)).toEqual(changed(diffEventRuleVersions(b, a)));
      for (const group of ab) {
        expect(group.changed).toBe(JSON.stringify(group.before) !== JSON.stringify(group.after));
      }
    }
  });

  // Independent oracle: each edit below says by hand which group it touches (or none), so the expected
  // set of changed groups never comes from the diff's own normalization.
  const EDITS: readonly { edit: (r: EntityRecord) => void; group: EventRuleDiffGroupKey | null }[] =
    [
      { edit: (r) => (r.name = "Renamed"), group: "basics" },
      { edit: (r) => (r.description = "New words"), group: "basics" },
      { edit: (r) => (r.eventTypeCode = "CHECK_IN"), group: "trigger" },
      { edit: (r) => (r.category = "BONUS"), group: "trigger" },
      { edit: (r) => (r.eventExpression = condition(99)), group: "conditions" },
      {
        edit: (r) => (r.eventActionsExpression = { issueCoupon: { offerCode: "x" } }),
        group: "actions",
      },
      { edit: (r) => (r.processItemsIndividually = true), group: "actions" },
      { edit: (r) => (r.rollUpEventRuleResults = true), group: "actions" },
      {
        edit: (r) =>
          (r.enabledInEnvironments = [
            {
              environmentCode: "development",
              dateTimePeriod: { startDateTime: "2027-01-01T00:00:00Z" },
            },
            { environmentCode: "production" },
          ]),
        group: "environments",
      },
      { edit: (r) => (r.occurrenceTargets = [{ targetCode: "visits" }]), group: "targets" },
      { edit: (r) => (r.programIds = ["p9"]), group: "programs" },
      {
        edit: (r) => (r.enabledInEnvironments = [{ environmentCode: "production" }]),
        group: "environments",
      },
      { edit: (r) => (r.tierCode = "gold"), group: "customFields" },
      // Bookkeeping and order-only edits change nothing.
      { edit: (r) => (r.versionStatus = "ARCHIVED"), group: null },
      { edit: (r) => (r.modifiedDateTime = "2030-01-01T00:00:00Z"), group: null },
      { edit: (r) => (r.eventRuleId = "id-other"), group: null },
      { edit: (r) => (r.openDraftVersion = 7), group: null },
      {
        edit: (r) => (r.programIds = [...((r.programIds as string[]) ?? [])].reverse()),
        group: null,
      },
    ];

  it("changed groups are exactly the groups the applied edits touch", () => {
    const random = rng(1121);
    for (let i = 0; i < 300; i++) {
      const base = rule({ programIds: ["p1", "p2"] });
      const after = structuredClone(base);
      const expected = new Set<EventRuleDiffGroupKey>();
      for (const { edit, group } of EDITS) {
        if (random() < 0.25) {
          edit(after);
          if (group) expected.add(group);
        }
      }
      const order = diffEventRuleVersions(base, after).map((g) => g.key);
      expect(changed(diffEventRuleVersions(base, after))).toEqual(
        order.filter((k) => expected.has(k))
      );
    }
  });
});

describe("defaultComparePair", () => {
  it("compares the newest version with the one before it", () => {
    const pair = defaultComparePair([
      rule({ version: 1, versionStatus: "ARCHIVED" }),
      rule({ version: 3, versionStatus: "PUBLISHED" }),
      rule({ version: 2, versionStatus: "ARCHIVED" }),
    ]);
    expect([pair?.before.version, pair?.after.version]).toEqual([2, 3]);
  });

  it("V12: compares an open draft with the live version it replaces", () => {
    const pair = defaultComparePair([
      rule({ version: 1, versionStatus: "PUBLISHED" }),
      rule({ version: 2, versionStatus: "DRAFT" }), // legacy, replaced
      rule({ version: 3, versionStatus: "DRAFT" }),
    ]);
    expect([pair?.before.version, pair?.after.version]).toEqual([1, 3]);
  });

  it("V4: one version has nothing to compare", () => {
    expect(defaultComparePair([rule()])).toBeNull();
  });
});
