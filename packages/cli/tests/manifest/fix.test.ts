import { describe, expect, it } from "vitest";

import type { PackageInstallationResult } from "../../src/api/types.js";
import { addMetadataValues, missingDependencies, valueName } from "../../src/manifest/fix.js";
import { parseManifest } from "../../src/manifest/load.js";

const PLAN: PackageInstallationResult = {
  packageCode: "directory-review",
  dryRun: true,
  applied: false,
  conflicted: true,
  packages: [
    {
      packageCode: "directory-review",
      records: [
        {
          kind: "PROGRAM",
          code: "coffee-club",
          action: "CONFLICT",
          missing: [{ kind: "METADATA", type: "PROGRAM_TYPE", code: "tiered", field: "typeCode" }],
        },
        {
          kind: "TARGET",
          code: "silver",
          action: "CONFLICT",
          missing: [
            {
              kind: "METADATA",
              type: "COUNTER_TARGET_TYPE",
              code: "POINTS",
              field: "counterTargetTypeCode",
            },
            { kind: "PROGRAM", code: "no-such", field: "programCodes" },
          ],
        },
        {
          kind: "TARGET",
          code: "gold",
          action: "CONFLICT",
          missing: [
            {
              kind: "METADATA",
              type: "COUNTER_TARGET_TYPE",
              code: "POINTS",
              field: "counterTargetTypeCode",
            },
          ],
        },
        { kind: "TIER", code: "bronze", action: "CREATE" },
      ],
    },
  ],
};

describe("valueName", () => {
  it("uses the standard program and currency type names", () => {
    expect(valueName("PROGRAM_TYPE", "tiered")).toBe("Tiered Loyalty Program");
    expect(valueName("CURRENCY_TYPE", "points")).toBe("Points");
  });

  it("names any other value after its code", () => {
    expect(valueName("COUNTER_TARGET_TYPE", "POINTS")).toBe("Points");
    expect(valueName("COMPLETION_TARGET_TYPE", "onboarding-step")).toBe("Onboarding step");
  });
});

describe("missingDependencies", () => {
  it("merges each missing value with every record that names it", () => {
    const missing = missingDependencies(PLAN);

    expect(missing.values).toEqual([
      {
        type: "PROGRAM_TYPE",
        code: "tiered",
        name: "Tiered Loyalty Program",
        neededBy: ["PROGRAM coffee-club (typeCode)"],
      },
      {
        type: "COUNTER_TARGET_TYPE",
        code: "POINTS",
        name: "Points",
        neededBy: ["TARGET silver (counterTargetTypeCode)", "TARGET gold (counterTargetTypeCode)"],
      },
    ]);
    expect(missing.records).toEqual([
      { kind: "PROGRAM", code: "no-such", neededBy: ["TARGET silver (programCodes)"] },
    ]);
  });

  it("finds nothing in a plan from a Platform that sends no missing list", () => {
    const old: PackageInstallationResult = {
      ...PLAN,
      packages: [
        {
          packageCode: "x",
          records: [{ kind: "PROGRAM", code: "p", action: "CONFLICT", reason: "r" }],
        },
      ],
    };
    expect(missingDependencies(old)).toEqual({ values: [], records: [] });
  });
});

describe("addMetadataValues", () => {
  const values = missingDependencies(PLAN).values;

  it("appends to the metadata list and keeps the file's comments", () => {
    const text = [
      "# The review tenant",
      "schema: loom-loyalty-config.v1",
      "code: directory-review",
      "metadata:",
      "  - type: CURRENCY_TYPE",
      "    code: points",
      "    name: Points # kept",
      "programs: []",
      "",
    ].join("\n");

    const fixed = addMetadataValues(text, values);

    expect(fixed).toContain("# The review tenant");
    expect(fixed).toContain("name: Points # kept");
    const loaded = parseManifest(fixed);
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    expect(loaded.manifest.metadata).toEqual([
      { type: "CURRENCY_TYPE", code: "points", name: "Points" },
      { type: "PROGRAM_TYPE", code: "tiered", name: "Tiered Loyalty Program" },
      { type: "COUNTER_TARGET_TYPE", code: "POINTS", name: "Points" },
    ]);
  });

  it("creates the metadata list when the file has none, and adds nothing twice", () => {
    const text = "schema: loom-loyalty-config.v1\ncode: directory-review\n";

    const once = addMetadataValues(text, values);
    const twice = addMetadataValues(once, values);

    expect(twice).toBe(once);
    const loaded = parseManifest(once);
    expect(loaded.ok && loaded.manifest.metadata?.length).toBe(2);
  });
});

describe("data type lookups", () => {
  const plan: PackageInstallationResult = {
    packageCode: "directory-review",
    dryRun: true,
    applied: false,
    conflicted: true,
    packages: [
      {
        packageCode: "directory-review",
        records: [
          {
            kind: "BADGE",
            code: "first-visit",
            action: "CONFLICT",
            missing: [
              { kind: "METADATA", type: "BADGE_TYPE", code: "ACHIEVEMENT", field: "typeCode" },
            ],
          },
        ],
      },
    ],
  };

  it("declares a badge type with its standard data model", () => {
    const values = missingDependencies(plan).values;
    expect(values[0]).toMatchObject({
      type: "BADGE_TYPE",
      code: "ACHIEVEMENT",
      dataModel: "badge",
    });

    const fixed = addMetadataValues(
      "schema: loom-loyalty-config.v1\ncode: directory-review\n",
      values
    );
    const loaded = parseManifest(fixed);
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    expect(loaded.manifest.metadata).toEqual([
      { type: "BADGE_TYPE", code: "ACHIEVEMENT", name: "Achievement", dataModel: "badge" },
    ]);
  });

  it("gives a plain metadata value no data model", () => {
    expect(missingDependencies(PLAN).values.every((value) => value.dataModel === undefined)).toBe(
      true
    );
  });
});
