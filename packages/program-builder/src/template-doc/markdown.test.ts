import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { validateProgramSpec } from "../linter";
import type { ProgramSpec } from "../spec";
import {
  DuplicateCodeError,
  EmptyUploadError,
  FrontmatterParseError,
  SchemaVersionMismatchError,
  TableShapeError,
} from "./errors";
import { hydrateForExecution } from "./hydrate-for-execution";
import { markdownFormat, parseIntegerCell, parseMultiplierCell } from "./markdown";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = resolve(__dirname, "../../__fixtures__/templates");
const SHIPPED_STARTERS = resolve(__dirname, "../../templates");

function loadFixture(name: string): Uint8Array {
  const bytes = readFileSync(resolve(FIXTURES, name));
  return new Uint8Array(bytes);
}

function loadShippedStarter(name: string): Uint8Array {
  const bytes = readFileSync(resolve(SHIPPED_STARTERS, name));
  return new Uint8Array(bytes);
}

const ENCODER = new TextEncoder();
const DECODER = new TextDecoder();

describe("markdownFormat.parse", () => {
  it("parses a happy-path coffee shop template", async () => {
    const result = await markdownFormat.parse(loadFixture("happy-path-coffee-shop.md"));
    const p = result.partial;

    expect(p.program?.code).toBe("coffee-loyalty");
    expect(p.program?.name).toBe("Coffee Loyalty");
    expect(p.currency?.code).toBe("bean");
    expect(p.autoAwardBaseTier).toBe(true);
    expect(p.selectedFeatures?.tiers).toBe(true);
    expect(p.selectedFeatures?.promotions).toBe(true);
    expect(p.selectedFeatures?.birthdayBonus).toBe(true);
    expect(p.birthdayBonusConfig?.bonusPoints).toBe(100);
    expect(p.awardRule?.templateId).toBe("points-per-dollar");

    expect(p.tiers).toHaveLength(3);
    expect(p.tiers?.[0]).toMatchObject({ code: "green", name: "Green", pointsThreshold: 0 });
    expect(p.tiers?.[2]).toMatchObject({ code: "reserve", name: "Reserve", pointsThreshold: 0 });

    expect(p.badges).toHaveLength(1);
    expect(p.badges?.[0]).toMatchObject({ code: "first-order", name: "First Order" });

    const fields = result.pendingExtractions.map((e) => e.expectedField).sort();
    expect(fields).toContain("tiers[0].pointsThreshold");
    expect(fields).toContain("tiers[0].earnMultiplier");
    expect(fields).toContain("tiers[1].pointsThreshold");
    expect(fields).toContain("tiers[1].earnMultiplier");
    expect(fields).toContain("tiers[2].pointsThreshold");
    expect(fields).toContain("tiers[2].earnMultiplier");
    expect(fields).toContain("promotions[0]");
    expect(fields).toContain("promotions[4]");
    expect(fields).toContain("promotions[5]");
    // 6 tier extractions (3 thresholds + 3 multipliers) + 6 promotions.
    expect(result.pendingExtractions).toHaveLength(12);
  });

  it("declares the tier progression metadata required after template extraction", async () => {
    const result = await markdownFormat.parse(loadFixture("happy-path-coffee-shop.md"));
    const tierThresholds = [0, 500, 2500] as const;
    // The template deliberately leaves tier thresholds to the AI's prose
    // extraction. Complete those values as the upload path does before
    // checking the pre-execution explicit-metadata gate.
    const spec = hydrateForExecution({
      ...result.partial,
      tiers: result.partial.tiers?.map((tier, index) => ({
        ...tier,
        pointsThreshold: tierThresholds[index] ?? 0,
      })),
      skipTestRun: true,
    } as ProgramSpec);

    const lint = validateProgramSpec(spec, { requireExplicitMetadata: true });

    expect(lint.ok).toBe(true);
  });

  it("declares complete metadata on the shipped coffee-shop starter served to the AI chat", async () => {
    // packages/program-builder/templates/coffee-shop.md is the real starter
    // served by GET /api/templates/starters/coffee-shop and attachable in
    // the AI chat's template-upload path (which runs with
    // requireExplicitMetadata: true) — a separate file from the
    // __fixtures__ copy above. Both must independently declare every
    // metadata row the tiers they ship require.
    const result = await markdownFormat.parse(loadShippedStarter("coffee-shop.md"));
    const tierThresholds = [0, 500, 2500] as const;
    const spec = hydrateForExecution({
      ...result.partial,
      tiers: result.partial.tiers?.map((tier, index) => ({
        ...tier,
        pointsThreshold: tierThresholds[index] ?? 0,
      })),
      skipTestRun: true,
    } as ProgramSpec);

    const lint = validateProgramSpec(spec, { requireExplicitMetadata: true });

    expect(lint.ok).toBe(true);
  });

  it("parses a minimal points program with no tiers or badges", async () => {
    const result = await markdownFormat.parse(loadFixture("minimal-points-program.md"));
    const p = result.partial;

    expect(p.program?.code).toBe("tiny-rewards");
    expect(p.selectedFeatures?.tiers).toBe(false);
    expect(p.selectedFeatures?.badges).toBe(false);
    expect(p.tiers).toEqual([]);
    expect(p.badges).toEqual([]);
  });

  it("preserves freeform sections as pendingExtractions without modifying structured fields", async () => {
    const result = await markdownFormat.parse(loadFixture("with-freeform-sections.md"));
    const p = result.partial;

    expect(p.program?.code).toBe("freeform-demo");
    expect(p.badges).toHaveLength(1);
    expect(p.badges?.[0]).toMatchObject({ code: "early-bird", name: "Early Bird" });

    expect(result.pendingExtractions).toHaveLength(2);
    const fields = result.pendingExtractions.map((e) => e.expectedField).sort();
    expect(fields).toEqual(["description", "marketingNotes"]);

    const desc = result.pendingExtractions.find((e) => e.expectedField === "description");
    expect(desc?.sectionContent).toContain("round-trip");
    expect(desc?.sourceLocation?.line).toBeGreaterThan(0);
  });

  it("emits a deprecation warning when programTypeIsSuggested appears in frontmatter", async () => {
    const md = `---\nschemaVersion: program-spec.v1\nselectedFeatures:\n  programCurrency: true\n  expiry: false\n  pending: false\n  tiers: false\n  badges: false\n  programType: transactional\n  signupBonus: false\n  birthdayBonus: false\nprogramTypeIsSuggested: true\nprogram:\n  code: legacy-flag-test\n  name: Legacy Flag Test\n  typeCode: standard\ncurrency:\n  code: lft-pts\n  name: Points\n  currencyTypeCode: points\nawardRule:\n  templateId: points-per-dollar\n  templateConfig:\n    pointsPerDollar: 1\n---\n\n# Legacy Flag Test\n`;
    const buffer = new TextEncoder().encode(md);
    const result = await markdownFormat.parse(buffer);
    const dep = result.warnings.find(
      (w) => w.code === "deprecated-field" && w.field === "programTypeIsSuggested"
    );
    expect(dep).toBeDefined();
    expect(dep!.message).toContain("typeName");
    // The flag must NOT survive into the parsed partial spec — Zod strips it.
    expect((result.partial as Record<string, unknown>).programTypeIsSuggested).toBeUndefined();
  });

  it("emits a deprecation warning when currencyTypeIsSuggested appears in frontmatter", async () => {
    const md = `---\nschemaVersion: program-spec.v1\nselectedFeatures:\n  programCurrency: true\n  expiry: false\n  pending: false\n  tiers: false\n  badges: false\n  programType: transactional\n  signupBonus: false\n  birthdayBonus: false\nprogram:\n  code: legacy-currency-flag\n  name: Legacy Currency Flag\n  typeCode: standard\ncurrency:\n  code: lcf-pts\n  name: Points\n  currencyTypeCode: points\ncurrencyTypeIsSuggested: true\nawardRule:\n  templateId: points-per-dollar\n  templateConfig:\n    pointsPerDollar: 1\n---\n\n# Legacy Currency Flag\n`;
    const buffer = new TextEncoder().encode(md);
    const result = await markdownFormat.parse(buffer);
    const dep = result.warnings.find(
      (w) => w.code === "deprecated-field" && w.field === "currencyTypeIsSuggested"
    );
    expect(dep).toBeDefined();
    expect(dep!.message).toContain("currencyTypeName");
    expect((result.partial as Record<string, unknown>).currencyTypeIsSuggested).toBeUndefined();
  });

  it("rejects an unknown schemaVersion with SchemaVersionMismatchError", async () => {
    await expect(markdownFormat.parse(loadFixture("bad-schema-version.md"))).rejects.toThrow(
      SchemaVersionMismatchError
    );
  });

  it("throws DuplicateCodeError when two tiers share a code", async () => {
    const promise = markdownFormat.parse(loadFixture("duplicate-tier-code.md"));
    await expect(promise).rejects.toThrow(DuplicateCodeError);
    try {
      await promise;
    } catch (err) {
      expect(err).toBeInstanceOf(DuplicateCodeError);
      const e = err as DuplicateCodeError;
      expect(e.duplicateCode).toBe("gold");
      expect(e.entityType).toBe("tier");
      expect(e.firstLine).toBeDefined();
      expect(e.secondLine).toBeGreaterThan(e.firstLine ?? 0);
    }
  });

  it("auto-sorts unsorted tier thresholds and emits a tiers-unsorted warning", async () => {
    const result = await markdownFormat.parse(loadFixture("unsorted-thresholds.md"));
    const thresholds = result.partial.tiers?.map((t) => t!.pointsThreshold);
    expect(thresholds).toEqual([0, 500, 2500]);
    expect(result.warnings.some((w) => w.code === "tiers-unsorted")).toBe(true);
  });

  it("rejects an empty upload with EmptyUploadError", async () => {
    await expect(markdownFormat.parse(loadFixture("empty-file.md"))).rejects.toThrow(
      EmptyUploadError
    );
  });

  it("rejects a buffer with only whitespace", async () => {
    await expect(markdownFormat.parse(ENCODER.encode("   \n  \n"))).rejects.toThrow(
      EmptyUploadError
    );
  });

  it("surfaces an unknown-column warning without failing the parse", async () => {
    const md = [
      "---",
      "schemaVersion: program-spec.v1",
      "selectedFeatures:",
      "  programCurrency: true",
      "  expiry: false",
      "  pending: false",
      "  tiers: true",
      "  badges: false",
      "  programType: transactional",
      "  signupBonus: false",
      "  birthdayBonus: false",
      "program:",
      "  code: unknown-col-demo",
      "  name: Unknown Column Demo",
      "  typeCode: generic",
      "currency:",
      "  code: demo-points",
      "  name: Points",
      "  currencyTypeCode: points",
      "awardRule:",
      "  templateId: points-per-dollar",
      "  templateConfig:",
      "    pointsPerDollar: 1",
      "autoAwardBaseTier: true",
      "---",
      "",
      "## Tiers",
      "",
      "| code   | name   | pointsThreshold | someJunk |",
      "|--------|--------|-----------------|----------|",
      "| bronze | Bronze | 0               | x        |",
      "| gold   | Gold   | 500             | y        |",
      "",
    ].join("\n");

    const result = await markdownFormat.parse(ENCODER.encode(md));
    expect(result.partial.tiers).toHaveLength(2);
    expect(result.warnings.some((w) => w.code === "unknown-column")).toBe(true);
  });

  it("throws TableShapeError on a tier row with an empty code", async () => {
    const md = [
      "---",
      "schemaVersion: program-spec.v1",
      "selectedFeatures:",
      "  programCurrency: true",
      "  expiry: false",
      "  pending: false",
      "  tiers: true",
      "  badges: false",
      "  programType: transactional",
      "  signupBonus: false",
      "  birthdayBonus: false",
      "program:",
      "  code: empty-code",
      "  name: Empty Code",
      "  typeCode: generic",
      "currency:",
      "  code: ec-points",
      "  name: Points",
      "  currencyTypeCode: points",
      "awardRule:",
      "  templateId: points-per-dollar",
      "  templateConfig:",
      "    pointsPerDollar: 1",
      "autoAwardBaseTier: true",
      "---",
      "",
      "## Tiers",
      "",
      "| code | name   | pointsThreshold |",
      "|------|--------|-----------------|",
      "|      | Bronze | 0               |",
      "",
    ].join("\n");
    await expect(markdownFormat.parse(ENCODER.encode(md))).rejects.toThrow(TableShapeError);
  });

  it("throws TableShapeError on a badge row with an empty code", async () => {
    const md = [
      "---",
      "schemaVersion: program-spec.v1",
      "selectedFeatures:",
      "  programCurrency: true",
      "  expiry: false",
      "  pending: false",
      "  tiers: false",
      "  badges: true",
      "  programType: transactional",
      "  signupBonus: false",
      "  birthdayBonus: false",
      "program:",
      "  code: empty-badge",
      "  name: Empty Badge",
      "  typeCode: generic",
      "currency:",
      "  code: eb-points",
      "  name: Points",
      "  currencyTypeCode: points",
      "awardRule:",
      "  templateId: points-per-dollar",
      "  templateConfig:",
      "    pointsPerDollar: 1",
      "---",
      "",
      "## Badges",
      "",
      "| code | name  |",
      "|------|-------|",
      "|      | First |",
      "",
    ].join("\n");
    await expect(markdownFormat.parse(ENCODER.encode(md))).rejects.toThrow(TableShapeError);
  });

  it("emits missing-table warning when ## Tiers has no following table", async () => {
    const md = [
      "---",
      "schemaVersion: program-spec.v1",
      "selectedFeatures:",
      "  programCurrency: true",
      "  expiry: false",
      "  pending: false",
      "  tiers: true",
      "  badges: false",
      "  programType: transactional",
      "  signupBonus: false",
      "  birthdayBonus: false",
      "program:",
      "  code: no-table",
      "  name: No Table",
      "  typeCode: generic",
      "currency:",
      "  code: nt-points",
      "  name: Points",
      "  currencyTypeCode: points",
      "awardRule:",
      "  templateId: points-per-dollar",
      "  templateConfig:",
      "    pointsPerDollar: 1",
      "autoAwardBaseTier: true",
      "---",
      "",
      "## Tiers",
      "",
      "No table here — just prose where a table should be.",
      "",
    ].join("\n");
    const result = await markdownFormat.parse(ENCODER.encode(md));
    expect(result.warnings.some((w) => w.code === "missing-table")).toBe(true);
    expect(result.partial.tiers).toEqual([]);
  });

  it("emits a pending extraction when pointsThreshold is non-numeric", async () => {
    const md = [
      "---",
      "schemaVersion: program-spec.v1",
      "selectedFeatures:",
      "  programCurrency: true",
      "  expiry: false",
      "  pending: false",
      "  tiers: true",
      "  badges: false",
      "  programType: transactional",
      "  signupBonus: false",
      "  birthdayBonus: false",
      "program:",
      "  code: prose-threshold",
      "  name: Prose Threshold",
      "  typeCode: generic",
      "currency:",
      "  code: pt-points",
      "  name: Points",
      "  currencyTypeCode: points",
      "awardRule:",
      "  templateId: points-per-dollar",
      "  templateConfig:",
      "    pointsPerDollar: 1",
      "autoAwardBaseTier: true",
      "---",
      "",
      "## Tiers",
      "",
      "| code   | name   | pointsThreshold     |",
      "|--------|--------|---------------------|",
      "| bronze | Bronze | Members start here. |",
      "",
    ].join("\n");
    const result = await markdownFormat.parse(ENCODER.encode(md));
    expect(result.partial.tiers).toHaveLength(1);
    expect(result.partial.tiers?.[0]?.pointsThreshold).toBe(0);
    const fields = result.pendingExtractions.map((e) => e.expectedField);
    expect(fields).toContain("tiers[0].pointsThreshold");
    expect(result.pendingExtractions[0]?.sectionContent).toBe("Members start here.");
  });

  it("throws TableShapeError when a required column is missing", async () => {
    const md = [
      "---",
      "schemaVersion: program-spec.v1",
      "selectedFeatures:",
      "  programCurrency: true",
      "  expiry: false",
      "  pending: false",
      "  tiers: true",
      "  badges: false",
      "  programType: transactional",
      "  signupBonus: false",
      "  birthdayBonus: false",
      "program:",
      "  code: missing-col",
      "  name: Missing Column",
      "  typeCode: generic",
      "currency:",
      "  code: mc-points",
      "  name: Points",
      "  currencyTypeCode: points",
      "awardRule:",
      "  templateId: points-per-dollar",
      "  templateConfig:",
      "    pointsPerDollar: 1",
      "autoAwardBaseTier: true",
      "---",
      "",
      "## Tiers",
      "",
      "| name   | pointsThreshold |",
      "|--------|-----------------|",
      "| Bronze | 0               |",
      "",
    ].join("\n");
    await expect(markdownFormat.parse(ENCODER.encode(md))).rejects.toThrow(TableShapeError);
  });

  it("throws FrontmatterParseError when Zod validation fails", async () => {
    const md = [
      "---",
      "schemaVersion: program-spec.v1",
      "selectedFeatures:",
      "  programCurrency: true",
      "  expiry: false",
      "  pending: false",
      "  tiers: false",
      "  badges: false",
      "  programType: transactional",
      "  signupBonus: false",
      "  birthdayBonus: false",
      "program:",
      "  code: ab",
      "  name: Too Short Code",
      "  typeCode: generic",
      "currency:",
      "  code: ts-points",
      "  name: Points",
      "  currencyTypeCode: points",
      "awardRule:",
      "  templateId: points-per-dollar",
      "  templateConfig:",
      "    pointsPerDollar: 1",
      "---",
      "",
      "# Too Short",
      "",
    ].join("\n");
    await expect(markdownFormat.parse(ENCODER.encode(md))).rejects.toThrow(FrontmatterParseError);
  });

  it("throws DuplicateCodeError when two badges share a code", async () => {
    const md = [
      "---",
      "schemaVersion: program-spec.v1",
      "selectedFeatures:",
      "  programCurrency: true",
      "  expiry: false",
      "  pending: false",
      "  tiers: false",
      "  badges: true",
      "  programType: transactional",
      "  signupBonus: false",
      "  birthdayBonus: false",
      "program:",
      "  code: dup-badge",
      "  name: Dup Badge",
      "  typeCode: generic",
      "currency:",
      "  code: db-points",
      "  name: Points",
      "  currencyTypeCode: points",
      "awardRule:",
      "  templateId: points-per-dollar",
      "  templateConfig:",
      "    pointsPerDollar: 1",
      "---",
      "",
      "## Badges",
      "",
      "| code  | name       |",
      "|-------|------------|",
      "| first | First      |",
      "| first | First Copy |",
      "",
    ].join("\n");
    try {
      await markdownFormat.parse(ENCODER.encode(md));
      throw new Error("Expected DuplicateCodeError");
    } catch (err) {
      expect(err).toBeInstanceOf(DuplicateCodeError);
      expect((err as DuplicateCodeError).entityType).toBe("badge");
      expect((err as DuplicateCodeError).duplicateCode).toBe("first");
    }
  });

  it("surfaces an unknown-section warning when an unexpected H2 is present", async () => {
    const md = [
      "---",
      "schemaVersion: program-spec.v1",
      "selectedFeatures:",
      "  programCurrency: true",
      "  expiry: false",
      "  pending: false",
      "  tiers: false",
      "  badges: false",
      "  programType: transactional",
      "  signupBonus: false",
      "  birthdayBonus: false",
      "program:",
      "  code: unknown-h2",
      "  name: Unknown Section",
      "  typeCode: generic",
      "currency:",
      "  code: uh-points",
      "  name: Points",
      "  currencyTypeCode: points",
      "awardRule:",
      "  templateId: points-per-dollar",
      "  templateConfig:",
      "    pointsPerDollar: 1",
      "---",
      "",
      "## Random Section",
      "",
      "Some content here.",
      "",
    ].join("\n");
    const result = await markdownFormat.parse(ENCODER.encode(md));
    expect(result.warnings.some((w) => w.code === "unknown-section")).toBe(true);
  });

  it("blocks gray-matter JavaScript frontmatter engine via SAFE_ENGINES override", async () => {
    const md = "---js\n({injected: 1})\n---\n# body\n";
    await expect(markdownFormat.parse(ENCODER.encode(md))).rejects.toThrow(FrontmatterParseError);
  });

  it("rejects YAML billion-laughs frontmatter via shared-reference detection", async () => {
    const md = [
      "---",
      'schemaVersion: "program-spec.v1"',
      "program:",
      "  code: bomb",
      "  name: Bomb",
      "awardRule:",
      "  templateId: basic",
      "  templateConfig:",
      '    a: &a ["x","x","x","x","x","x","x","x","x","x"]',
      "    b: &b [*a,*a,*a,*a,*a,*a,*a,*a,*a,*a]",
      "    c: &c [*b,*b,*b,*b,*b,*b,*b,*b,*b,*b]",
      "    d: &d [*c,*c,*c,*c,*c,*c,*c,*c,*c,*c]",
      "    e: &e [*d,*d,*d,*d,*d,*d,*d,*d,*d,*d]",
      "    bomb: [*e,*e,*e,*e,*e,*e]",
      "---",
      "",
      "# body",
    ].join("\n");
    const t0 = Date.now();
    await expect(markdownFormat.parse(ENCODER.encode(md))).rejects.toThrow(FrontmatterParseError);
    expect(Date.now() - t0).toBeLessThan(500);
  });

  it("matches freeform heading case-insensitively", async () => {
    const md = [
      "---",
      "schemaVersion: program-spec.v1",
      "selectedFeatures:",
      "  programCurrency: true",
      "  expiry: false",
      "  pending: false",
      "  tiers: false",
      "  badges: false",
      "  programType: transactional",
      "  signupBonus: false",
      "  birthdayBonus: false",
      "program:",
      "  code: ci-freeform",
      "  name: CI Freeform",
      "  typeCode: generic",
      "currency:",
      "  code: ci-points",
      "  name: Points",
      "  currencyTypeCode: points",
      "awardRule:",
      "  templateId: points-per-dollar",
      "  templateConfig:",
      "    pointsPerDollar: 1",
      "---",
      "",
      "## freeform: description",
      "",
      "Some prose.",
      "",
    ].join("\n");
    const result = await markdownFormat.parse(ENCODER.encode(md));
    expect(result.pendingExtractions).toHaveLength(1);
    expect(result.pendingExtractions[0]?.expectedField).toBe("description");
  });

  it("accepts MAX_TIERS_PER_PROGRAM tiers at the boundary without a tiers-over-cap warning", async () => {
    const tiers: string[] = [];
    for (let i = 0; i < 50; i++) {
      tiers.push(`| t${i} | Tier ${i} | ${i * 10} |`);
    }
    const md = [
      "---",
      "schemaVersion: program-spec.v1",
      "selectedFeatures:",
      "  programCurrency: true",
      "  expiry: false",
      "  pending: false",
      "  tiers: true",
      "  badges: false",
      "  programType: transactional",
      "  signupBonus: false",
      "  birthdayBonus: false",
      "program:",
      "  code: fifty-tiers",
      "  name: Fifty Tiers",
      "  typeCode: generic",
      "currency:",
      "  code: fifty-points",
      "  name: Points",
      "  currencyTypeCode: points",
      "awardRule:",
      "  templateId: points-per-dollar",
      "  templateConfig:",
      "    pointsPerDollar: 1",
      "autoAwardBaseTier: true",
      "---",
      "",
      "## Tiers",
      "",
      "| code | name | pointsThreshold |",
      "|------|------|-----------------|",
      ...tiers,
      "",
    ].join("\n");
    const result = await markdownFormat.parse(ENCODER.encode(md));
    expect(result.partial.tiers).toHaveLength(50);
    expect(result.warnings.some((w) => w.code === "tiers-over-cap")).toBe(false);
  });

  it("accepts a UTF-8 BOM at the start of the file", async () => {
    const bom = new Uint8Array([0xef, 0xbb, 0xbf]);
    const content = loadFixture("minimal-points-program.md");
    const withBom = new Uint8Array(bom.length + content.length);
    withBom.set(bom, 0);
    withBom.set(content, bom.length);
    const result = await markdownFormat.parse(withBom);
    expect(result.partial.program?.code).toBe("tiny-rewards");
  });

  it("accepts CRLF line endings (Windows editors)", async () => {
    const text = DECODER.decode(loadFixture("minimal-points-program.md"));
    const crlf = text.replace(/\n/g, "\r\n");
    const result = await markdownFormat.parse(ENCODER.encode(crlf));
    expect(result.partial.program?.code).toBe("tiny-rewards");
  });

  it("truncates a freeform section exceeding 4KB and emits a freeform-truncated warning", async () => {
    const longProse = "x".repeat(5000);
    const md = [
      "---",
      "schemaVersion: program-spec.v1",
      "selectedFeatures:",
      "  programCurrency: true",
      "  expiry: false",
      "  pending: false",
      "  tiers: false",
      "  badges: false",
      "  programType: transactional",
      "  signupBonus: false",
      "  birthdayBonus: false",
      "program:",
      "  code: long-freeform",
      "  name: Long Freeform",
      "  typeCode: generic",
      "currency:",
      "  code: lf-points",
      "  name: Points",
      "  currencyTypeCode: points",
      "awardRule:",
      "  templateId: points-per-dollar",
      "  templateConfig:",
      "    pointsPerDollar: 1",
      "---",
      "",
      "## Freeform: description",
      "",
      longProse,
      "",
    ].join("\n");
    const result = await markdownFormat.parse(ENCODER.encode(md));
    expect(result.pendingExtractions).toHaveLength(1);
    const section = result.pendingExtractions[0]!;
    expect(Buffer.byteLength(section.sectionContent, "utf8")).toBeLessThanOrEqual(4096);
    expect(result.warnings.some((w) => w.code === "freeform-truncated")).toBe(true);
  });

  it("truncates a multi-byte freeform section by bytes, not code points", async () => {
    const emoji = "🎉";
    const longEmojiProse = emoji.repeat(1500);
    const md = [
      "---",
      "schemaVersion: program-spec.v1",
      "selectedFeatures:",
      "  programCurrency: true",
      "  expiry: false",
      "  pending: false",
      "  tiers: false",
      "  badges: false",
      "  programType: transactional",
      "  signupBonus: false",
      "  birthdayBonus: false",
      "program:",
      "  code: emoji-freeform",
      "  name: Emoji Freeform",
      "  typeCode: generic",
      "currency:",
      "  code: ef-points",
      "  name: Points",
      "  currencyTypeCode: points",
      "awardRule:",
      "  templateId: points-per-dollar",
      "  templateConfig:",
      "    pointsPerDollar: 1",
      "---",
      "",
      "## Freeform: description",
      "",
      longEmojiProse,
      "",
    ].join("\n");
    const result = await markdownFormat.parse(ENCODER.encode(md));
    expect(result.pendingExtractions).toHaveLength(1);
    const section = result.pendingExtractions[0]!;
    expect(Buffer.byteLength(section.sectionContent, "utf8")).toBeLessThanOrEqual(4096);
    expect(result.warnings.some((w) => w.code === "freeform-truncated")).toBe(true);
  });

  it("emits tiers-over-cap warning when tier count exceeds MAX_TIERS_PER_PROGRAM", async () => {
    const tiers: string[] = [];
    for (let i = 0; i < 51; i++) {
      tiers.push(`| t${i} | Tier ${i} | ${i * 10} |`);
    }
    const md = [
      "---",
      "schemaVersion: program-spec.v1",
      "selectedFeatures:",
      "  programCurrency: true",
      "  expiry: false",
      "  pending: false",
      "  tiers: true",
      "  badges: false",
      "  programType: transactional",
      "  signupBonus: false",
      "  birthdayBonus: false",
      "program:",
      "  code: too-many-tiers",
      "  name: Too Many Tiers",
      "  typeCode: generic",
      "currency:",
      "  code: many-points",
      "  name: Points",
      "  currencyTypeCode: points",
      "awardRule:",
      "  templateId: points-per-dollar",
      "  templateConfig:",
      "    pointsPerDollar: 1",
      "autoAwardBaseTier: true",
      "---",
      "",
      "## Tiers",
      "",
      "| code | name | pointsThreshold |",
      "|------|------|-----------------|",
      ...tiers,
      "",
    ].join("\n");

    const result = await markdownFormat.parse(ENCODER.encode(md));
    expect(result.partial.tiers).toHaveLength(51);
    const errOrWarn = result.warnings.find((w) => w.message.toLowerCase().includes("at most 50"));
    expect(errOrWarn).toBeDefined();
  });

  it("emits metadata-over-cap warning when metadata count exceeds MAX_METADATA_RECORDS_PER_PROGRAM", async () => {
    const rows: string[] = [];
    for (let i = 0; i < 201; i++) {
      rows.push(`| DATA_TYPE | TYPE_${i} |  | Type ${i} |  |`);
    }
    const md = [
      "---",
      "schemaVersion: program-spec.v1",
      "selectedFeatures:",
      "  programCurrency: true",
      "  expiry: false",
      "  pending: false",
      "  tiers: false",
      "  badges: false",
      "  programType: transactional",
      "  signupBonus: false",
      "  birthdayBonus: false",
      "program:",
      "  code: too-many-meta",
      "  name: Too Many Metadata",
      "  typeCode: generic",
      "awardRule:",
      "  templateId: points-per-dollar",
      "  templateConfig:",
      "    pointsPerDollar: 1",
      "---",
      "",
      "## Metadata",
      "",
      "| category   | typeCode | code | name | description |",
      "|------------|----------|------|------|-------------|",
      ...rows,
      "",
    ].join("\n");

    const result = await markdownFormat.parse(ENCODER.encode(md));
    const overCap = result.warnings.find((w) => w.code === "metadata-over-cap");
    expect(overCap).toBeDefined();
    expect(overCap?.message).toContain("201");
    expect(overCap?.message).toContain("200");
  });
});

describe("parseMultiplierCell", () => {
  it("parses a bare number", () => {
    expect(parseMultiplierCell("1.2")).toBe(1.2);
    expect(parseMultiplierCell("2")).toBe(2);
  });

  it("strips a trailing `x` (case-insensitive)", () => {
    expect(parseMultiplierCell("1.7x")).toBe(1.7);
    expect(parseMultiplierCell("2X")).toBe(2);
  });

  it("strips commas", () => {
    expect(parseMultiplierCell("1,000")).toBe(1000);
  });

  it("returns null for empty input", () => {
    expect(parseMultiplierCell("")).toBeNull();
  });

  it("returns null for non-numeric prose", () => {
    expect(parseMultiplierCell("double Beans")).toBeNull();
    expect(parseMultiplierCell("20% more")).toBeNull();
  });
});

describe("parseIntegerCell", () => {
  it("parses a bare integer", () => {
    expect(parseIntegerCell("500")).toBe(500);
    expect(parseIntegerCell("0")).toBe(0);
  });

  it("strips commas", () => {
    expect(parseIntegerCell("2,500")).toBe(2500);
  });

  it("does NOT strip a trailing `x` — the cell routes to the LLM as ambiguous prose", () => {
    // The regression #496 locks in: `500x` is not a valid integer
    // threshold. Excel's column auto-format or a typo must NOT silently
    // parse to 500; the cell should fail parsing and surface as prose.
    expect(parseIntegerCell("500x")).toBeNull();
    expect(parseIntegerCell("500X")).toBeNull();
  });

  it("rejects floats — the helper is named `Integer` for a reason", () => {
    // `100.5` is ambiguous prose for `pointsThreshold` since the
    // platform takes integer thresholds. Routes to the LLM instead of
    // silently coercing to a fractional value.
    expect(parseIntegerCell("100.5")).toBeNull();
    expect(parseIntegerCell("1.0")).toBeNull();
    expect(parseIntegerCell("-3.14")).toBeNull();
  });

  it("returns null for empty input", () => {
    expect(parseIntegerCell("")).toBeNull();
  });

  it("returns null for non-numeric prose", () => {
    expect(parseIntegerCell("Members start here.")).toBeNull();
    expect(parseIntegerCell("Earn 500 Beans")).toBeNull();
  });
});

describe("parsePromotionsTable — error paths", () => {
  function withPromotionsTable(rows: string[]): string {
    return [
      "---",
      "schemaVersion: program-spec.v1",
      "selectedFeatures:",
      "  programCurrency: true",
      "  expiry: false",
      "  pending: false",
      "  tiers: false",
      "  badges: false",
      "  promotions: true",
      "  programType: transactional",
      "  signupBonus: false",
      "  birthdayBonus: false",
      "program:",
      "  code: promo-tests",
      "  name: Promo Tests",
      "  typeCode: standard",
      "currency:",
      "  code: pt-points",
      "  name: Points",
      "  currencyTypeCode: points",
      "awardRule:",
      "  templateId: points-per-dollar",
      "  templateConfig:",
      "    pointsPerDollar: 1",
      "---",
      "",
      "## Promotions",
      "",
      "| name | description |",
      "|------|-------------|",
      ...rows,
      "",
    ].join("\n");
  }

  it("throws TableShapeError when a promotion row has an empty name", async () => {
    const md = withPromotionsTable(["|      | A description |"]);
    await expect(markdownFormat.parse(ENCODER.encode(md))).rejects.toThrow(TableShapeError);
  });

  it("throws TableShapeError when a promotion row has an empty description", async () => {
    const md = withPromotionsTable(["| Free Drink |  |"]);
    await expect(markdownFormat.parse(ENCODER.encode(md))).rejects.toThrow(TableShapeError);
  });

  it("throws TableShapeError when the Promotions table is missing a required column", async () => {
    const md = [
      "---",
      "schemaVersion: program-spec.v1",
      "selectedFeatures:",
      "  programCurrency: true",
      "  expiry: false",
      "  pending: false",
      "  tiers: false",
      "  badges: false",
      "  promotions: true",
      "  programType: transactional",
      "  signupBonus: false",
      "  birthdayBonus: false",
      "program:",
      "  code: missing-col",
      "  name: Missing Col",
      "  typeCode: standard",
      "currency:",
      "  code: mc-points",
      "  name: Points",
      "  currencyTypeCode: points",
      "awardRule:",
      "  templateId: points-per-dollar",
      "  templateConfig:",
      "    pointsPerDollar: 1",
      "---",
      "",
      "## Promotions",
      "",
      // Missing the `description` column.
      "| name |",
      "|------|",
      "| One |",
      "",
    ].join("\n");
    await expect(markdownFormat.parse(ENCODER.encode(md))).rejects.toThrow(TableShapeError);
  });

  it("queues one pendingExtraction per non-empty row with `promotions[i]` field paths", async () => {
    const md = withPromotionsTable([
      "| Free Drink Day | First Monday of the month |",
      "| Birthday Reward | Members get a free pastry on their birthday |",
    ]);
    const result = await markdownFormat.parse(ENCODER.encode(md));
    const promoFields = result.pendingExtractions
      .map((e) => e.expectedField)
      .filter((f) => f.startsWith("promotions["))
      .sort();
    expect(promoFields).toEqual(["promotions[0]", "promotions[1]"]);
  });
});

describe("renderPromotionsTable — round-trip", () => {
  const specWithPromotions = (): ProgramSpec => ({
    selectedFeatures: {
      programCurrency: true,
      expiry: false,
      pending: false,
      tiers: false,
      badges: false,
      promotions: true,
      programType: "transactional",
      signupBonus: false,
      birthdayBonus: false,
    },
    program: { code: "rt-promo", name: "RT Promo", typeCode: "generic" },
    currency: { code: "rt-points", name: "Points", currencyTypeCode: "points" },
    tiers: [],
    badges: [],
    promotions: [
      {
        code: "free-modification-day",
        name: "Free Modification Day",
        description:
          "On the first Monday of every month, every member receives one free drink modification.",
        eventType: { code: "purchase", name: "Purchase" },
        targets: [],
        eventRules: [{ award: { type: "FREE_ITEM", value: "modification" } }],
      },
      {
        code: "double-bean-day",
        name: "Double Bean Day",
        description: "On flagged calendar dates, members earn double Beans on every purchase.",
        eventType: { code: "purchase", name: "Purchase" },
        targets: [],
        eventRules: [{ award: { type: "MULTIPLIER", value: 2 } }],
      },
    ],
    metadata: [],
    awardRule: {
      templateId: "points-per-dollar",
      templateConfig: { pointsPerDollar: 1 },
      rulePayload: { code: "rt-earn", name: "Earn Points" },
    },
    skipTestRun: true,
  });

  it("renders a non-empty promotions list that re-parses with the same shape", async () => {
    const original = specWithPromotions();
    const rendered = await markdownFormat.render!(original);
    const reparsed = await markdownFormat.parse(rendered.buffer);
    const promoFields = reparsed.pendingExtractions
      .map((e) => e.expectedField)
      .filter((f) => f.startsWith("promotions["))
      .sort();
    // Each rendered row queues one extraction by name — the parser
    // doesn't preserve the original code/eventType structural fields,
    // only the prose. Round-trip via re-extraction is the contract.
    expect(promoFields).toEqual(["promotions[0]", "promotions[1]"]);
    // The rendered markdown contains the description text from the
    // original spec.
    const decoded = DECODER.decode(rendered.buffer);
    expect(decoded).toContain("Free Modification Day");
    expect(decoded).toContain("Double Bean Day");
  });
});

describe("markdownFormat.render", () => {
  const validSpec = (): ProgramSpec => ({
    selectedFeatures: {
      programCurrency: true,
      expiry: false,
      pending: false,
      tiers: true,
      badges: true,
      programType: "transactional",
      signupBonus: false,
      birthdayBonus: false,
    },
    program: { code: "round-trip", name: "Round Trip", typeCode: "generic" },
    currency: { code: "rt-points", name: "Points", currencyTypeCode: "points" },
    tiers: [
      { code: "bronze", name: "Bronze", pointsThreshold: 0 },
      { code: "silver", name: "Silver", pointsThreshold: 100 },
    ],
    badges: [{ code: "first", name: "First" }],
    promotions: [],
    metadata: [],
    awardRule: {
      templateId: "points-per-dollar",
      templateConfig: { pointsPerDollar: 1 },
      rulePayload: { code: "rt-earn", name: "Earn" },
    },
    autoAwardBaseTier: true,
  });

  it("round-trips a structured backbone (parse → render → parse equals)", async () => {
    const spec = validSpec();
    const rendered = await markdownFormat.render!(spec);
    const text = DECODER.decode(rendered.buffer);
    expect(text).toContain("schemaVersion: program-spec.v1");
    expect(text).toContain("## Tiers");
    expect(text).toContain("## Badges");

    const reparsed = await markdownFormat.parse(rendered.buffer);
    expect(reparsed.partial.program?.code).toBe(spec.program.code);
    expect(reparsed.partial.tiers).toHaveLength(spec.tiers.length);
    expect(reparsed.partial.badges).toHaveLength(spec.badges.length);
    expect(reparsed.partial.selectedFeatures?.tiers).toBe(true);
    expect(reparsed.partial.autoAwardBaseTier).toBe(true);
    expect(reparsed.partial.awardRule?.templateId).toBe(spec.awardRule.templateId);
  });

  it("round-trips a spec with an empty awardRule.templateId (hydrator output from /render)", async () => {
    const spec = validSpec();
    spec.awardRule = { templateId: "", templateConfig: {}, rulePayload: {} };
    const rendered = await markdownFormat.render!(spec);
    // The render/parse contract must accept empty templateId so that templates
    // downloaded from programs whose award rule isn't fully hydratable can be
    // re-uploaded. The executor enforces completeness downstream.
    const reparsed = await markdownFormat.parse(rendered.buffer);
    expect(reparsed.partial.program?.code).toBe(spec.program.code);
  });

  it("emits a Uint8Array that decodes to UTF-8 markdown", async () => {
    const { buffer } = await markdownFormat.render!(validSpec());
    expect(buffer).toBeInstanceOf(Uint8Array);
    const text = DECODER.decode(buffer);
    expect(text.startsWith("---")).toBe(true);
  });

  it("includes sample tier rows when includeSampleData is true", async () => {
    const spec = validSpec();
    spec.selectedFeatures.tiers = false;
    spec.tiers = [];
    spec.selectedFeatures.badges = false;
    spec.badges = [];
    const { buffer } = await markdownFormat.render!(spec, { includeSampleData: true });
    const text = DECODER.decode(buffer);
    expect(text).toContain("## Tiers");
    expect(text).toContain("bronze");
    expect(text).toContain("first-order");
  });

  it("omits empty sections by default (no sample data)", async () => {
    const spec = validSpec();
    spec.tiers = [];
    spec.badges = [];
    const { buffer } = await markdownFormat.render!(spec);
    const text = DECODER.decode(buffer);
    expect(text).not.toContain("## Tiers");
    expect(text).not.toContain("## Badges");
  });

  it("renders a spec containing undefined nested fields without throwing", async () => {
    const spec = validSpec();
    (spec.program as Record<string, unknown>).description = undefined;
    (spec.program as Record<string, unknown>).typeName = undefined;
    (spec.currency as Record<string, unknown>).description = undefined;
    spec.expiryRule = undefined;
    spec.testCustomer = undefined;

    const rendered = await markdownFormat.render!(spec);
    const text = DECODER.decode(rendered.buffer);
    expect(typeof text).toBe("string");
    expect(text).toContain("schemaVersion: program-spec.v1");
    expect(text).not.toContain("undefined");
  });
});

describe("markdownFormat — Metadata section", () => {
  const validSpec = (): ProgramSpec => ({
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
    program: { code: "meta-test", name: "Meta Test", typeCode: "retail" },
    currency: { code: "pts", name: "Points", currencyTypeCode: "points" },
    tiers: [],
    badges: [],
    promotions: [],
    metadata: [
      { category: "DATA_TYPE", typeCode: "PROGRAM_TYPE", code: "retail", name: "Retail" },
      {
        category: "DATA_TYPE",
        typeCode: "CURRENCY_TYPE",
        code: "points",
        name: "Points",
        description: "Standard point currency",
      },
    ],
    awardRule: {
      templateId: "points-per-dollar",
      templateConfig: { pointsPerDollar: 1 },
      rulePayload: { code: "earn", name: "Earn" },
    },
  });

  it("round-trips a populated metadata array", async () => {
    const spec = validSpec();
    const rendered = await markdownFormat.render!(spec);
    const text = DECODER.decode(rendered.buffer);
    expect(text).toContain("## Metadata");
    expect(text).toContain("category");
    expect(text).toContain("retail");

    const reparsed = await markdownFormat.parse(rendered.buffer);
    expect(reparsed.partial.metadata).toHaveLength(2);
    expect(reparsed.partial.metadata?.[0]).toMatchObject({
      category: "DATA_TYPE",
      typeCode: "PROGRAM_TYPE",
      code: "retail",
      name: "Retail",
    });
    expect(reparsed.partial.metadata?.[1]).toMatchObject({
      category: "DATA_TYPE",
      typeCode: "CURRENCY_TYPE",
      code: "points",
      name: "Points",
      description: "Standard point currency",
    });
  });

  it("omits the ## Metadata section when the array is empty", async () => {
    const spec = validSpec();
    spec.metadata = [];
    const rendered = await markdownFormat.render!(spec);
    const text = DECODER.decode(rendered.buffer);
    expect(text).not.toContain("## Metadata");
  });

  it("renders a TYPE-only row (code blank)", async () => {
    const spec = validSpec();
    spec.metadata = [{ category: "DATA_TYPE", typeCode: "EVENT_TYPE", name: "Event Type" }];
    const rendered = await markdownFormat.render!(spec);
    const reparsed = await markdownFormat.parse(rendered.buffer);
    expect(reparsed.partial.metadata).toHaveLength(1);
    expect(reparsed.partial.metadata?.[0]?.code).toBeUndefined();
    expect(reparsed.partial.metadata?.[0]?.name).toBe("Event Type");
  });

  it("treats whitespace-only `code` cell as TYPE row (not INSTANCE)", async () => {
    const md = ENCODER.encode(`---
schemaVersion: program-spec.v1
selectedFeatures:
  programCurrency: true
  expiry: false
  pending: false
  tiers: false
  badges: false
  programType: transactional
  signupBonus: false
  birthdayBonus: false
program:
  code: meta-ws
  name: Meta WS
  typeCode: standard
awardRule:
  templateId: points-per-dollar
  templateConfig:
    pointsPerDollar: 1
---

## Metadata

| category   | typeCode     | code | name     | description |
|------------|--------------|------|----------|-------------|
| DATA_TYPE  | PROGRAM_TYPE |      | Standard |             |
`);
    const result = await markdownFormat.parse(md);
    expect(result.partial.metadata).toHaveLength(1);
    expect(result.partial.metadata?.[0]?.code).toBeUndefined();
    expect(result.partial.metadata?.[0]?.name).toBe("Standard");
  });

  it("throws TableShapeError when a required Metadata column is missing", async () => {
    const md = ENCODER.encode(`---
schemaVersion: program-spec.v1
selectedFeatures:
  programCurrency: true
  expiry: false
  pending: false
  tiers: false
  badges: false
  programType: transactional
  signupBonus: false
  birthdayBonus: false
program:
  code: meta-test
  name: Meta Test
  typeCode: standard
awardRule:
  templateId: points-per-dollar
  templateConfig:
    pointsPerDollar: 1
---

## Metadata

| typeCode      | code   | name   |
|---------------|--------|--------|
| PROGRAM_TYPE  | retail | Retail |
`);
    await expect(markdownFormat.parse(md)).rejects.toThrow(TableShapeError);
  });

  it("makes the description column optional", async () => {
    const md = ENCODER.encode(`---
schemaVersion: program-spec.v1
selectedFeatures:
  programCurrency: true
  expiry: false
  pending: false
  tiers: false
  badges: false
  programType: transactional
  signupBonus: false
  birthdayBonus: false
program:
  code: meta-test
  name: Meta Test
  typeCode: standard
awardRule:
  templateId: points-per-dollar
  templateConfig:
    pointsPerDollar: 1
---

## Metadata

| category   | typeCode      | code   | name   |
|------------|---------------|--------|--------|
| DATA_TYPE  | PROGRAM_TYPE  | retail | Retail |
`);
    const result = await markdownFormat.parse(md);
    expect(result.partial.metadata).toHaveLength(1);
    expect(result.partial.metadata?.[0]?.description).toBeUndefined();
  });

  it("emits a missing-table warning when ## Metadata has no following table", async () => {
    const md = ENCODER.encode(`---
schemaVersion: program-spec.v1
selectedFeatures:
  programCurrency: true
  expiry: false
  pending: false
  tiers: false
  badges: false
  programType: transactional
  signupBonus: false
  birthdayBonus: false
program:
  code: meta-test
  name: Meta Test
  typeCode: standard
awardRule:
  templateId: points-per-dollar
  templateConfig:
    pointsPerDollar: 1
---

## Metadata

`);
    const result = await markdownFormat.parse(md);
    const warning = result.warnings.find((w) => w.code === "missing-table");
    expect(warning).toBeDefined();
  });
});

describe("markdownFormat — metadata consistency warnings", () => {
  function frontmatterFor(extras: string): Uint8Array {
    return ENCODER.encode(`---
schemaVersion: program-spec.v1
selectedFeatures:
  programCurrency: true
  expiry: false
  pending: false
  tiers: false
  badges: false
  programType: transactional
  signupBonus: false
  birthdayBonus: false
program:
  code: meta-consist
  name: Meta Consist
  typeCode: retail
${extras}awardRule:
  templateId: points-per-dollar
  templateConfig:
    pointsPerDollar: 1
---
`);
  }

  it("warns when program.typeCode has no matching PROGRAM_TYPE metadata row", async () => {
    const result = await markdownFormat.parse(frontmatterFor(""));
    const warning = result.warnings.find((w) => w.code === "metadata-missing-program-type");
    expect(warning).toBeDefined();
    expect(warning?.message).toContain("retail");
    expect(warning?.message).toContain("PROGRAM_TYPE");
  });

  it("does NOT warn when a PROGRAM_TYPE metadata row matches program.typeCode", async () => {
    const md = ENCODER.encode(`---
schemaVersion: program-spec.v1
selectedFeatures:
  programCurrency: true
  expiry: false
  pending: false
  tiers: false
  badges: false
  programType: transactional
  signupBonus: false
  birthdayBonus: false
program:
  code: meta-consist
  name: Meta Consist
  typeCode: retail
awardRule:
  templateId: points-per-dollar
  templateConfig:
    pointsPerDollar: 1
---

## Metadata

| category   | typeCode      | code   | name   | description |
|------------|---------------|--------|--------|-------------|
| DATA_TYPE  | PROGRAM_TYPE  | retail | Retail |             |
`);
    const result = await markdownFormat.parse(md);
    expect(result.warnings.find((w) => w.code === "metadata-missing-program-type")).toBeUndefined();
  });

  it("warns metadata-missing-currency-type when program is matched but currency lacks its row", async () => {
    const md = ENCODER.encode(`---
schemaVersion: program-spec.v1
selectedFeatures:
  programCurrency: true
  expiry: false
  pending: false
  tiers: false
  badges: false
  programType: transactional
  signupBonus: false
  birthdayBonus: false
program:
  code: meta-consist
  name: Meta Consist
  typeCode: retail
currency:
  code: pts
  name: Points
  currencyTypeCode: points
awardRule:
  templateId: points-per-dollar
  templateConfig:
    pointsPerDollar: 1
---

## Metadata

| category   | typeCode      | code   | name   | description |
|------------|---------------|--------|--------|-------------|
| DATA_TYPE  | PROGRAM_TYPE  | retail | Retail |             |
`);
    const result = await markdownFormat.parse(md);
    expect(result.warnings.find((w) => w.code === "metadata-missing-program-type")).toBeUndefined();
    const cur = result.warnings.find((w) => w.code === "metadata-missing-currency-type");
    expect(cur).toBeDefined();
    expect(cur?.message).toContain("points");
    expect(cur?.message).toContain("CURRENCY_TYPE");
  });

  it("warns metadata-orphan-instance when an instance row references an unknown typeCode", async () => {
    const md = ENCODER.encode(`---
schemaVersion: program-spec.v1
selectedFeatures:
  programCurrency: true
  expiry: false
  pending: false
  tiers: false
  badges: false
  programType: transactional
  signupBonus: false
  birthdayBonus: false
program:
  code: meta-consist
  name: Meta Consist
  typeCode: standard
awardRule:
  templateId: points-per-dollar
  templateConfig:
    pointsPerDollar: 1
---

## Metadata

| category   | typeCode       | code     | name      | description |
|------------|----------------|----------|-----------|-------------|
| DATA_TYPE  | PROGRAM_TYPE   | standard | Standard  |             |
| DATA_TYPE  | EMPLOYEE_RANK  | senior   | Senior    |             |
`);
    const result = await markdownFormat.parse(md);
    const orphan = result.warnings.find((w) => w.code === "metadata-orphan-instance");
    expect(orphan).toBeDefined();
    expect(orphan?.message).toContain("EMPLOYEE_RANK");
    expect(orphan?.message).toContain("senior");
  });

  it("does NOT warn metadata-orphan-instance when a TYPE row in the same spec defines the typeCode", async () => {
    const md = ENCODER.encode(`---
schemaVersion: program-spec.v1
selectedFeatures:
  programCurrency: true
  expiry: false
  pending: false
  tiers: false
  badges: false
  programType: transactional
  signupBonus: false
  birthdayBonus: false
program:
  code: meta-consist
  name: Meta Consist
  typeCode: standard
awardRule:
  templateId: points-per-dollar
  templateConfig:
    pointsPerDollar: 1
---

## Metadata

| category   | typeCode       | code     | name              | description |
|------------|----------------|----------|-------------------|-------------|
| DATA_TYPE  | PROGRAM_TYPE   | standard | Standard          |             |
| DATA_TYPE  | EMPLOYEE_RANK  |          | Employee Rank     |             |
| DATA_TYPE  | EMPLOYEE_RANK  | senior   | Senior            |             |
`);
    const result = await markdownFormat.parse(md);
    expect(result.warnings.find((w) => w.code === "metadata-orphan-instance")).toBeUndefined();
  });

  it("warns unknown-metadata-category when category is outside the SDK enum", async () => {
    const md = ENCODER.encode(`---
schemaVersion: program-spec.v1
selectedFeatures:
  programCurrency: true
  expiry: false
  pending: false
  tiers: false
  badges: false
  programType: transactional
  signupBonus: false
  birthdayBonus: false
program:
  code: meta-cat
  name: Meta Cat
  typeCode: standard
awardRule:
  templateId: points-per-dollar
  templateConfig:
    pointsPerDollar: 1
---

## Metadata

| category    | typeCode     | code     | name     | description |
|-------------|--------------|----------|----------|-------------|
| UNKNOWN_CAT | PROGRAM_TYPE | standard | Standard |             |
`);
    const result = await markdownFormat.parse(md);
    const warn = result.warnings.find((w) => w.code === "unknown-metadata-category");
    expect(warn).toBeDefined();
    expect(warn?.message).toContain("UNKNOWN_CAT");
  });

  it("does NOT warn unknown-metadata-category for known SDK categories (DATA_TYPE)", async () => {
    const md = ENCODER.encode(`---
schemaVersion: program-spec.v1
selectedFeatures:
  programCurrency: true
  expiry: false
  pending: false
  tiers: false
  badges: false
  programType: transactional
  signupBonus: false
  birthdayBonus: false
program:
  code: meta-cat-ok
  name: Meta Cat OK
  typeCode: standard
awardRule:
  templateId: points-per-dollar
  templateConfig:
    pointsPerDollar: 1
---

## Metadata

| category  | typeCode     | code     | name     | description |
|-----------|--------------|----------|----------|-------------|
| DATA_TYPE | PROGRAM_TYPE | standard | Standard |             |
`);
    const result = await markdownFormat.parse(md);
    expect(result.warnings.find((w) => w.code === "unknown-metadata-category")).toBeUndefined();
  });
});
