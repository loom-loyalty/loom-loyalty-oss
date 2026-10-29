/**
 * CUSTOMER audit-side Zod schemas (L2).
 *
 * CUSTOMER's polymorphism is STRUCTURAL, not tagged: the BE manifest
 * discriminates on the PRESENCE of `identity` vs `corporateIdentity`
 * (CUSTOMER.json `jsonSchema.oneOf` requires exactly one). There is no `type`
 * field to key on, so a `z.discriminatedUnion` is the wrong tool — this uses a
 * plain `z.union([individualSchema, corporateSchema])`. Per playbook §5.11
 * (untagged union → hand-rolled), specialized for the presence-discriminated
 * case.
 *
 * `.catchall(z.unknown())` record variants model tenant extensions on the
 * base. No required field is a LOCALIZED_STRING (CUSTOMER has none), so the
 * shared `localizedString` refinement isn't imported.
 */

import { describe, expect, it } from "vitest";
import { z } from "zod";

// Shared base: every field optional except the identity block (modelled per
// variant below). emailAddresses / phoneNumbers entries require typeCode,
// status, and the value field itself, matching the real
// customer-create-customer.RequestSchema.json contract -- the FE wraps a
// single contact into a one-element array, but every field the backend
// requires on that array entry still has to be present.
const customerBaseShape = {
  customerId: z.string().optional(),
  externalId: z.string().optional(),
  statusCode: z.string().optional(),
  fraudStatusCode: z.string().optional(),
  enrollmentCode: z.string().optional(),
  emailAddresses: z
    .array(
      z.object({
        emailAddress: z.string(),
        typeCode: z.string(),
        status: z.string(),
        primary: z.boolean().optional(),
      })
    )
    .optional(),
  phoneNumbers: z
    .array(
      z.object({
        number: z.string(),
        typeCode: z.string(),
        status: z.string(),
        primary: z.boolean().optional(),
      })
    )
    .optional(),
  enabledInEnvironments: z.array(z.unknown()).optional(),
  createdDateTime: z.string().optional(),
  modifiedDateTime: z.string().optional(),
};

const individualSchema = z.object({
  identity: z.object({
    firstName: z.string().min(1),
    middleName: z.string().optional(),
    lastName: z.string().optional(),
    birthDate: z.string().optional(),
    genderCode: z.string().optional(),
  }),
  ...customerBaseShape,
});

const corporateSchema = z.object({
  corporateIdentity: z.object({
    companyName: z.string().min(1),
    companyCode: z.string().optional(),
  }),
  ...customerBaseShape,
});

// Structural (presence-based) union — NOT discriminatedUnion. A fixture must
// satisfy exactly one identity block; Zod tries each member in order.
const customerSchema = z.union([individualSchema, corporateSchema]);

const individualRecordSchema = individualSchema.catchall(z.unknown());
const corporateRecordSchema = corporateSchema.catchall(z.unknown());
const customerRecordSchema = z.union([individualRecordSchema, corporateRecordSchema]);

const happyIndividual = {
  identity: { firstName: "Jane", lastName: "Doe" },
  statusCode: "ACTIVE",
};

const happyCorporate = {
  corporateIdentity: { companyName: "Acme Corporation", companyCode: "acme-corp" },
  statusCode: "ACTIVE",
};

describe("[audit] L2 — customerSchema (structural union, presence-discriminated)", () => {
  it("accepts a happy individual fixture with only required identity fields", () => {
    expect(customerSchema.safeParse(happyIndividual).success).toBe(true);
  });

  it("accepts a happy corporate fixture with only required corporateIdentity fields", () => {
    expect(customerSchema.safeParse(happyCorporate).success).toBe(true);
  });

  it("accepts an individual fixture with every optional field populated", () => {
    const result = customerSchema.safeParse({
      identity: {
        firstName: "Jane",
        middleName: "Q",
        lastName: "Doe",
        birthDate: "1985-03-15",
        genderCode: "FEMALE",
      },
      customerId: "cust_550e8400e29b41d4a716446655440010",
      externalId: "CUST-2024-00123",
      statusCode: "ACTIVE",
      fraudStatusCode: "CLEAR",
      enrollmentCode: "WEBSITE",
      emailAddresses: [
        { emailAddress: "jane@example.com", typeCode: "OTHER", status: "ACTIVE", primary: true },
      ],
      phoneNumbers: [
        { number: "+15551234567", typeCode: "OTHER", status: "ACTIVE", primary: true },
      ],
      enabledInEnvironments: [],
      createdDateTime: "2024-01-01T00:00:00Z",
      modifiedDateTime: "2024-01-02T00:00:00Z",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a fixture carrying NEITHER identity nor corporateIdentity", () => {
    const result = customerSchema.safeParse({ statusCode: "ACTIVE", externalId: "X-1" });
    expect(result.success).toBe(false);
  });

  it("rejects an individual fixture missing identity.firstName", () => {
    const result = customerSchema.safeParse({
      identity: { lastName: "Doe" },
      statusCode: "ACTIVE",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an individual fixture with an empty identity.firstName", () => {
    const result = customerSchema.safeParse({
      identity: { firstName: "" },
      statusCode: "ACTIVE",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a corporate fixture missing corporateIdentity.companyName", () => {
    const result = customerSchema.safeParse({
      corporateIdentity: { companyCode: "acme-corp" },
      statusCode: "ACTIVE",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a corporate fixture with an empty corporateIdentity.companyName", () => {
    const result = customerSchema.safeParse({
      corporateIdentity: { companyName: "" },
      statusCode: "ACTIVE",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a malformed emailAddresses entry (missing emailAddress)", () => {
    const result = customerSchema.safeParse({
      ...happyIndividual,
      emailAddresses: [{ typeCode: "OTHER", status: "ACTIVE", primary: true }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects an emailAddresses entry missing the required status field", () => {
    const result = customerSchema.safeParse({
      ...happyIndividual,
      emailAddresses: [{ emailAddress: "jane@example.com", typeCode: "OTHER", primary: true }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a phoneNumbers entry missing the required status field", () => {
    const result = customerSchema.safeParse({
      ...happyIndividual,
      phoneNumbers: [{ number: "+15551234567", typeCode: "OTHER", primary: true }],
    });
    expect(result.success).toBe(false);
  });

  it("strips unknown keys on the individual variant (Zod default .strip() mode)", () => {
    const result = customerSchema.safeParse({
      ...happyIndividual,
      futureField: "unmapped",
      mysteryFlag: true,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toHaveProperty("futureField");
      expect(result.data).not.toHaveProperty("mysteryFlag");
    }
  });
});

describe("[audit] L2 — customerRecordSchema (catchall per variant, tenant extensions)", () => {
  it("preserves tenant extension keys on individual records", () => {
    const result = customerRecordSchema.safeParse({
      ...happyIndividual,
      sourceSystem: "CRM-01",
      riskTier: "LOW",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toMatchObject({ sourceSystem: "CRM-01", riskTier: "LOW" });
    }
  });

  it("preserves tenant extension keys on corporate records", () => {
    const result = customerRecordSchema.safeParse({
      ...happyCorporate,
      ownerTeam: "growth",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toMatchObject({ ownerTeam: "growth" });
    }
  });

  it("still enforces required identity validation through the catchall", () => {
    const result = customerRecordSchema.safeParse({
      identity: { lastName: "Doe" },
      sourceSystem: "CRM-01",
    });
    expect(result.success).toBe(false);
  });

  it("survives an extension roundtrip end-to-end (parse → re-parse)", () => {
    const fixture = {
      ...happyIndividual,
      emailAddresses: [
        { emailAddress: "jane@example.com", typeCode: "OTHER", status: "ACTIVE", primary: true },
      ],
      ownerTeam: "growth",
      customNested: { foo: "bar" },
    };
    const first = customerRecordSchema.parse(fixture);
    const second = customerRecordSchema.parse(first);
    expect(second).toEqual(first);
  });

  it("still enforces strict base-field types when extensions are present", () => {
    // A `z.union` aggregates member errors under `unionErrors`, so the failing
    // `externalId` path isn't flat at the top level — assert rejection only.
    const valid = customerRecordSchema.parse({ ...happyIndividual, sourceSystem: "CRM-01" });
    const broken = { ...valid, externalId: 42 };
    const result = customerRecordSchema.safeParse(broken);
    expect(result.success).toBe(false);
  });
});
