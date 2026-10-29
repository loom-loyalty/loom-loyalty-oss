/**
 * The shape of `loom-loyalty-config.yaml`, schema `loom-loyalty-config.v1`: the Platform's `TenantManifest`.
 *
 * The CLI checks the structure the server would otherwise reject with a less helpful message: the schema
 * name, the manifest code, known top-level sections, and a `code` on every record. Each record's fields are
 * the API's create body and are validated by the Platform when it plans the manifest.
 */

import { z } from "zod";

export const SCHEMA_V1 = "loom-loyalty-config.v1";

export const DEFAULT_MANIFEST_FILE = "loom-loyalty-config.yaml";

/** Most records one section may hold; the Platform rejects more. */
export const MAX_RECORDS_PER_SECTION = 500;

/** The Platform's resource code: lower-case letters, digits and single hyphens, at most 63 characters. */
const RESOURCE_CODE = /^(?=.{1,63}$)[a-z0-9]+(?:-[a-z0-9]+)*$/;

const resourceCode = z
  .string()
  .regex(
    RESOURCE_CODE,
    "use lower-case letters, digits and single hyphens (at most 63 characters)"
  );

/** A display string, or one per locale such as `{ en: "Points" }`. */
const localized = z.union([z.string(), z.record(z.string(), z.string())]);

const section = <T extends z.ZodType>(entry: T) =>
  z
    .array(entry)
    .max(MAX_RECORDS_PER_SECTION, `at most ${MAX_RECORDS_PER_SECTION} records`)
    .optional();

/** A program-level record: the API's create body, matched by its code, with references written as codes. */
const record = z.looseObject({ code: resourceCode });

const metadataType = z.strictObject({
  code: z.string().min(1),
  name: z.string().optional(),
  description: localized.optional(),
  category: z.string().optional(),
});

const metadata = z.strictObject({
  type: z.string().min(1),
  code: z.string().min(1),
  name: z.string().optional(),
  description: localized.optional(),
  properties: z.record(z.string(), z.unknown()).optional(),
});

const eventType = z.strictObject({
  code: z.string().min(1),
  name: z.string().optional(),
  description: localized.optional(),
  dataModel: z.string().optional(),
});

const settings = z.record(z.string(), z.unknown());

const hubSettings = {
  theme: settings.optional(),
  uiSettings: settings.optional(),
  entityOverrides: z.record(z.string(), settings).optional(),
  featureFlags: z.record(z.string(), z.boolean()).optional(),
};

/** The settings a `hub` section may declare; everything else about a hub belongs to its environment. */
export const HUB_KEYS = Object.keys(hubSettings) as (keyof typeof hubSettings)[];

/**
 * The hub of the environment the manifest is applied in. A declared setting replaces the live one and a
 * setting left out keeps its value. The subdomain, custom domain, name and custom components are each
 * environment's own and are set in Hub, so the section can't declare them; a loose object with its own
 * check names them all in one message, where a strict one would report each as unrecognized.
 */
const hub = z.looseObject(hubSettings).superRefine((value, context) => {
  const unmanaged = Object.keys(value).filter((key) => !(key in hubSettings));
  if (unmanaged.length > 0) {
    context.addIssue({
      code: "custom",
      message: `can't manage ${unmanaged.join(", ")}: a manifest manages the hub's ${HUB_KEYS.join(", ")} only; the subdomain, custom domain, name and custom components are set in Hub`,
    });
  }
});

const identifierType = z.strictObject({
  code: z.string().min(1),
  name: z.string().optional(),
  description: localized.optional(),
});

export const manifestSchema = z.strictObject({
  schema: z.literal(SCHEMA_V1, { error: `schema must be ${SCHEMA_V1}` }),
  code: resourceCode,
  name: z.string().optional(),
  dataModels: section(z.record(z.string(), z.unknown())),
  metadataTypes: section(metadataType),
  metadata: section(metadata),
  eventTypes: section(eventType),
  identifierTypes: section(identifierType),
  programs: section(record),
  expiryRules: section(record),
  pendingRules: section(record),
  programCurrencies: section(record),
  tiers: section(record),
  badges: section(record),
  targets: section(record),
  eventRules: section(record),
  customerAudiences: section(record),
  offers: section(record),
  flows: section(record),
  hub: hub.optional(),
});

export type TenantManifest = z.infer<typeof manifestSchema>;

/** The program-level sections, each a list of records keyed by `code`. */
export const RECORD_SECTIONS = [
  "programs",
  "expiryRules",
  "pendingRules",
  "programCurrencies",
  "tiers",
  "badges",
  "targets",
  "eventRules",
  "customerAudiences",
  "offers",
  "flows",
] as const;

/** Every section of a manifest, in the order the schema declares them and `treadle pull` writes them. */
export const MANIFEST_SECTIONS = [
  "dataModels",
  "metadataTypes",
  "metadata",
  "eventTypes",
  "identifierTypes",
  ...RECORD_SECTIONS,
  "hub",
] as const;

export type ManifestSection = (typeof MANIFEST_SECTIONS)[number];

/**
 * How many records a section's value holds: a list's length, 1 for a hub that sets anything, else 0.
 * `hub` is the one section that is an object rather than a list.
 */
export function sectionRecordCount(value: unknown): number {
  if (Array.isArray(value)) return value.length;
  return value !== null && typeof value === "object" && Object.keys(value).length > 0 ? 1 : 0;
}
