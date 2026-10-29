/**
 * OFFER audit-side Zod schemas (L2).
 *
 * Hand-constructed because the orval-generated `Offer = CouponOffer | ExternalOffer`
 * union is untagged (BE issue #658). Each variant declares `type` as the full
 * enum, so TypeScript narrowing on the orval types is broken — but the runtime
 * data DOES discriminate, so a hand-rolled `z.discriminatedUnion("type", [...])`
 * is the right shape. Per playbook §5.11.
 */

import { localizedString } from "@loom-loyalty/test-utils/zod";
import { describe, expect, it } from "vitest";
import { z } from "zod";

const offerBaseShape = {
  offerId: z.string().optional(),
  code: z.string().min(1),
  name: z.string().min(1),
  programIds: z.array(z.string().min(1)).min(1),
  description: localizedString.optional(),
  maxOfferUses: z.number().int().nonnegative().optional(),
  maxOfferRedemptions: z.number().int().nonnegative().optional(),
  durationPeriod: z
    .object({
      durationPeriod: z.string().optional(),
      durationPeriodType: z.string().optional(),
      durationPeriodValue: z.number().int().positive().optional(),
      fixedDurationDateTimePeriod: z
        .object({
          startDateTime: z.string().optional(),
          endDateTime: z.string().optional(),
        })
        .optional(),
      timeZone: z.string().optional(),
    })
    .optional(),
  setDateTimePeriodOnIssue: z.boolean().optional(),
  enabledInEnvironments: z.array(z.unknown()).optional(),
  createdDateTime: z.string().optional(),
  modifiedDateTime: z.string().optional(),
};

const couponOfferBaseSchema = z.object({
  type: z.literal("COUPON"),
  maxDiscountValue: z.number().nonnegative().optional(),
  ...offerBaseShape,
});

const externalOfferBaseSchema = z.object({
  type: z.literal("EXTERNAL"),
  ...offerBaseShape,
});

const offerSchema = z.discriminatedUnion("type", [couponOfferBaseSchema, externalOfferBaseSchema]);

const couponOfferRecordSchema = couponOfferBaseSchema.catchall(z.unknown());
const externalOfferRecordSchema = externalOfferBaseSchema.catchall(z.unknown());
const offerRecordSchema = z.discriminatedUnion("type", [
  couponOfferRecordSchema,
  externalOfferRecordSchema,
]);

const happyCoupon = {
  type: "COUPON" as const,
  code: "summer-sale-20",
  name: "Summer Sale 20% Off",
  programIds: ["prog_550e8400e29b41d4a716446655440000"],
  maxDiscountValue: 50,
};

const happyExternal = {
  type: "EXTERNAL" as const,
  code: "partner-reward",
  name: "Partner Reward",
  programIds: ["prog_550e8400e29b41d4a716446655440001"],
};

describe("[audit] L2 — offerSchema (discriminated union, base variants)", () => {
  it("accepts a happy COUPON fixture with only required fields", () => {
    const result = offerSchema.safeParse(happyCoupon);
    expect(result.success).toBe(true);
  });

  it("accepts a happy EXTERNAL fixture with only required fields", () => {
    const result = offerSchema.safeParse(happyExternal);
    expect(result.success).toBe(true);
  });

  it("accepts a COUPON fixture with every optional field populated", () => {
    const result = offerSchema.safeParse({
      ...happyCoupon,
      offerId: "ofr_550e8400e29b41d4a716446655440010",
      description: { en: "Summer sale", es: "Venta de verano" },
      maxOfferUses: 1000,
      maxOfferRedemptions: 5000,
      durationPeriod: {
        durationPeriodType: "ROLLING",
        durationPeriodValue: 30,
        timeZone: "America/Chicago",
      },
      setDateTimePeriodOnIssue: true,
      enabledInEnvironments: [],
      createdDateTime: "2024-01-01T00:00:00Z",
      modifiedDateTime: "2024-01-02T00:00:00Z",
      maxDiscountValue: 99.99,
    });
    expect(result.success).toBe(true);
  });

  it("rejects a fixture missing the discriminator", () => {
    const result = offerSchema.safeParse({
      code: "broken",
      name: "Broken",
      programIds: ["prog_550e8400e29b41d4a716446655440000"],
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues.some((i) => i.path[0] === "type")).toBe(true);
  });

  it("rejects a fixture with an unknown discriminator value", () => {
    const result = offerSchema.safeParse({
      ...happyCoupon,
      type: "MYSTERY",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues.some((i) => i.path[0] === "type")).toBe(true);
  });

  it("rejects a COUPON fixture missing `name`", () => {
    const { name: _name, ...withoutName } = happyCoupon;
    const result = offerSchema.safeParse(withoutName);
    expect(result.success).toBe(false);
    expect(result.error?.issues.some((i) => i.path[0] === "name")).toBe(true);
  });

  it("rejects an empty `code`", () => {
    const result = offerSchema.safeParse({ ...happyCoupon, code: "" });
    expect(result.success).toBe(false);
    expect(result.error?.issues.some((i) => i.path[0] === "code")).toBe(true);
  });

  it("rejects empty `programIds`", () => {
    const result = offerSchema.safeParse({ ...happyCoupon, programIds: [] });
    expect(result.success).toBe(false);
    expect(result.error?.issues.some((i) => i.path[0] === "programIds")).toBe(true);
  });

  it("rejects a negative maxDiscountValue", () => {
    const result = offerSchema.safeParse({ ...happyCoupon, maxDiscountValue: -5 });
    expect(result.success).toBe(false);
    expect(result.error?.issues.some((i) => i.path[0] === "maxDiscountValue")).toBe(true);
  });

  it("strips unknown keys on the COUPON variant (Zod default .strip() mode)", () => {
    const result = offerSchema.safeParse({
      ...happyCoupon,
      futureField: "unmapped",
      mysteryFlag: true,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toHaveProperty("futureField");
      expect(result.data).not.toHaveProperty("mysteryFlag");
    }
  });

  it("Zod default-strips `maxDiscountValue` on the EXTERNAL variant (documents .strip() behavior, not a guard)", () => {
    // EXTERNAL variant does not declare maxDiscountValue. Zod's default mode
    // for z.object is .strip() — unknown keys are silently dropped. This test
    // documents that behavior; it does NOT catch cross-variant contamination
    // at the audit layer. The L5 contract spec's enum-equality check is the
    // real drift detector. To convert this into a true guard, swap the
    // strict variants to z.object(...).strict() (rejects unknown keys) — but
    // that breaks the symmetry with the catchall variants below.
    const result = offerSchema.safeParse({ ...happyExternal, maxDiscountValue: 25 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toHaveProperty("maxDiscountValue");
    }
  });

  it("rejects an `en`-less localized description (shared refinement)", () => {
    const result = offerSchema.safeParse({
      ...happyCoupon,
      description: { es: "Solo español" },
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues.some((i) => i.path.includes("description"))).toBe(true);
  });
});

describe("[audit] L2 — offerRecordSchema (catchall per variant, tenant extensions)", () => {
  it("preserves tenant extension keys on COUPON records", () => {
    const result = offerRecordSchema.safeParse({
      ...happyCoupon,
      supplierCode: "SUP-001",
      riskCategory: "LOW",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toMatchObject({
        type: "COUPON",
        supplierCode: "SUP-001",
        riskCategory: "LOW",
      });
    }
  });

  it("preserves tenant extension keys on EXTERNAL records", () => {
    const result = offerRecordSchema.safeParse({
      ...happyExternal,
      thirdPartyId: "xyz-123",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toMatchObject({
        type: "EXTERNAL",
        thirdPartyId: "xyz-123",
      });
    }
  });

  it("still enforces base-field validation through the catchall", () => {
    const result = offerRecordSchema.safeParse({
      type: "COUPON",
      code: "broken",
      programIds: ["prog_550e8400e29b41d4a716446655440000"],
      supplierCode: "SUP-001",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues.some((i) => i.path[0] === "name")).toBe(true);
  });

  it("survives an extension roundtrip end-to-end (parse → re-parse)", () => {
    const fixture = {
      ...happyCoupon,
      description: { en: "Top tier" },
      supplierCode: "SUP-001",
      customNested: { foo: "bar" },
    };
    const first = offerRecordSchema.parse(fixture);
    const second = offerRecordSchema.parse(first);
    expect(second).toEqual(first);
  });

  it("still enforces strict base-field types when extensions are present", () => {
    const valid = offerRecordSchema.parse({ ...happyCoupon, supplierCode: "SUP-001" });
    const broken = { ...valid, code: 42 };
    const result = offerRecordSchema.safeParse(broken);
    expect(result.success).toBe(false);
    expect(result.error?.issues.some((i) => i.path[0] === "code")).toBe(true);
  });
});
