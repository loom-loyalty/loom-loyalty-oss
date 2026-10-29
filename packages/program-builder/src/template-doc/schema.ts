import { z } from "zod";
import { currencyStepSchema, programStepSchema, selectedFeaturesSchema } from "../spec.js";
import { SchemaVersionMismatchError, SchemaVersionMissingError } from "./errors.js";

export const TEMPLATE_SCHEMA_VERSION = "program-spec.v1";

/** Shared between markdown and excel parsers — both enforce identical strictness. */
export function assertSchemaVersion(value: unknown): void {
  if (value === undefined || value === null || value === "") {
    throw new SchemaVersionMissingError();
  }
  if (typeof value !== "string") {
    throw new SchemaVersionMismatchError(String(value));
  }
  if (value !== TEMPLATE_SCHEMA_VERSION) {
    throw new SchemaVersionMismatchError(value);
  }
}

const awardRuleFrontmatterSchema = z.object({
  // Optional so templates downloaded from programs whose award rule isn't
  // hydratable via the current SDK round-trip cleanly. Completeness is enforced
  // downstream by the executor, which is the correct gate.
  templateId: z.string().optional(),
  templateConfig: z.record(z.string(), z.unknown()).default({}),
  rulePayload: z
    .object({
      code: z.string().min(1),
      name: z.string().min(1),
    })
    .loose()
    .optional(),
});

const bonusConfigFrontmatterSchema = z.object({
  bonusPoints: z.number().int().positive(),
});

const eventTypeFrontmatterSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  dataFields: z
    .array(
      z.object({
        name: z.string().min(1),
        type: z.enum(["string", "number", "boolean", "date"]),
        required: z.boolean(),
      })
    )
    .min(1),
});

const expiryRuleFrontmatterSchema = z
  .object({
    type: z.enum(["FIXED_DATE", "FIXED_PERIOD", "ROLLING_PERIOD"]),
    expiryPeriod: z.enum(["DAYS", "WEEKS", "MONTHS", "YEARS"]).optional(),
    expiryPeriodValue: z.number().int().positive().optional(),
    expiryDate: z.string().optional(),
  })
  .loose();

const pendingRuleFrontmatterSchema = z
  .object({
    type: z.enum(["FIXED_DATE", "FIXED_PERIOD", "ROLLING_PERIOD", "MANUAL", "PENDING_ON_ITEM"]),
    pendingPeriod: z.enum(["DAYS", "WEEKS", "MONTHS", "YEARS"]).optional(),
    pendingPeriodValue: z.number().int().positive().optional(),
    pendingDate: z.string().optional(),
  })
  .loose();

const testCustomerFrontmatterSchema = z.object({
  email: z.email(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  externalId: z.string().optional(),
});

/**
 * Covers every singleton field of ProgramSpec; arrays (tiers, badges)
 * live in markdown tables.
 */
export const frontmatterSchema = z.object({
  schemaVersion: z.literal(TEMPLATE_SCHEMA_VERSION),
  selectedFeatures: selectedFeaturesSchema,
  program: programStepSchema,
  currency: currencyStepSchema.optional(),
  existingCurrencyCode: z.string().optional(),
  existingCurrencyId: z.string().optional(),
  expiryRule: expiryRuleFrontmatterSchema.optional(),
  pendingRule: pendingRuleFrontmatterSchema.optional(),
  autoAwardBaseTier: z.boolean().optional(),
  eventType: eventTypeFrontmatterSchema.optional(),
  awardRule: awardRuleFrontmatterSchema,
  signupBonusConfig: bonusConfigFrontmatterSchema.optional(),
  birthdayBonusConfig: bonusConfigFrontmatterSchema.optional(),
  testCustomer: testCustomerFrontmatterSchema.optional(),
});

export type ProgramSpecFrontmatter = z.infer<typeof frontmatterSchema>;

export function emitProgramSpecFrontmatterSchema(publicHostUrl?: string): Record<string, unknown> {
  const schema = z.toJSONSchema(frontmatterSchema) as Record<string, unknown>;
  if (publicHostUrl) {
    schema.$id = `${publicHostUrl.replace(/\/$/, "")}/api/templates/schema/program-spec.v1.json`;
  }
  schema.title = "Loom Loyalty Program Spec — v1 (frontmatter)";
  return schema;
}
