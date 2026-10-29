import addFormats from "ajv-formats";
import Ajv2020 from "ajv/dist/2020";
import { describe, expect, it } from "vitest";

import { emitProgramSpecFrontmatterSchema, frontmatterSchema } from "./schema";

const ajv = new Ajv2020({ strict: false, allErrors: true });
addFormats(ajv);
const schema = emitProgramSpecFrontmatterSchema();
const validate = ajv.compile(schema);

const goodBase = {
  schemaVersion: "program-spec.v1",
  selectedFeatures: {
    programCurrency: true,
    expiry: false,
    pending: false,
    tiers: false,
    badges: false,
    programType: "transactional",
    signupBonus: false,
    birthdayBonus: false,
  },
  program: { code: "abc-demo", name: "Demo", typeCode: "generic" },
  currency: { code: "demo-pts", name: "Points", currencyTypeCode: "points" },
  awardRule: {
    templateId: "points-per-dollar",
    templateConfig: { pointsPerDollar: 1 },
  },
};

describe("emitProgramSpecFrontmatterSchema", () => {
  it("emits a schema that ajv accepts", () => {
    expect(schema.type).toBe("object");
    expect(schema.required).toContain("schemaVersion");
    expect(schema.required).toContain("awardRule");
  });

  it("injects $id when a publicHostUrl is provided", () => {
    const s = emitProgramSpecFrontmatterSchema("https://loom.example");
    expect(s.$id).toBe("https://loom.example/api/templates/schema/program-spec.v1.json");
  });

  it("strips trailing slash from publicHostUrl", () => {
    const s = emitProgramSpecFrontmatterSchema("https://loom.example/");
    expect(s.$id).toBe("https://loom.example/api/templates/schema/program-spec.v1.json");
  });

  it("accepts 5 known-good frontmatters", () => {
    const cases: Array<Record<string, unknown>> = [
      goodBase,
      {
        ...goodBase,
        program: { ...goodBase.program, code: "coffee-loyalty", name: "Coffee Loyalty" },
      },
      { ...goodBase, autoAwardBaseTier: true },
      {
        ...goodBase,
        birthdayBonusConfig: { bonusPoints: 100 },
        selectedFeatures: { ...goodBase.selectedFeatures, birthdayBonus: true },
      },
      {
        ...goodBase,
        signupBonusConfig: { bonusPoints: 50 },
        selectedFeatures: { ...goodBase.selectedFeatures, signupBonus: true },
      },
    ];
    for (const c of cases) {
      const ok = validate(c);
      expect(ok, JSON.stringify(validate.errors ?? {}, null, 2)).toBe(true);
    }
  });

  it("rejects 3 known-bad frontmatters", () => {
    const cases: Array<Record<string, unknown>> = [
      { ...goodBase, schemaVersion: "program-spec.v99" },
      { ...goodBase, program: { code: "x", name: "Too Short", typeCode: "g" } },
      { ...goodBase, awardRule: { templateId: "" } },
    ];
    for (const c of cases) {
      expect(validate(c)).toBe(false);
    }
  });
});

describe("frontmatterSchema Zod", () => {
  it("parses the base-case object", () => {
    const res = frontmatterSchema.safeParse(goodBase);
    expect(res.success).toBe(true);
  });

  it("rejects a missing schemaVersion", () => {
    const bad = { ...goodBase } as Record<string, unknown>;
    delete bad["schemaVersion"];
    expect(frontmatterSchema.safeParse(bad).success).toBe(false);
  });
});
