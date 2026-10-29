import ExcelJS from "exceljs";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import type { ProgramSpec } from "../spec";
import {
  DuplicateCodeError,
  EmptyUploadError,
  SchemaVersionMismatchError,
  SchemaVersionMissingError,
  TableShapeError,
  TemplateParseError,
} from "./errors";
import { excelFormat, parseExcelIntegerCell, parseExcelMultiplierCell } from "./excel";
import { markdownFormat } from "./markdown";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = resolve(__dirname, "../../__fixtures__/templates");
const EXCEL_FIXTURES = resolve(FIXTURES, "excel");

function loadFixture(name: string): Uint8Array {
  const bytes = readFileSync(resolve(FIXTURES, name));
  return new Uint8Array(bytes);
}

function loadExcelFixture(name: string): Uint8Array {
  const bytes = readFileSync(resolve(EXCEL_FIXTURES, name));
  return new Uint8Array(bytes);
}

function happyPathSpec(): ProgramSpec {
  return {
    selectedFeatures: {
      programCurrency: true,
      expiry: false,
      pending: false,
      tiers: true,
      badges: true,
      programType: "transactional",
      signupBonus: false,
      birthdayBonus: true,
    },
    program: {
      code: "coffee-loyalty",
      name: "Coffee Loyalty",
      typeCode: "retail",
      typeName: "Retail",
    },
    currency: { code: "bean", name: "Bean", currencyTypeCode: "points" },
    tiers: [
      { code: "bronze", name: "Bronze", pointsThreshold: 0 },
      { code: "silver", name: "Silver", pointsThreshold: 500 },
      { code: "gold", name: "Gold", pointsThreshold: 2500 },
    ],
    badges: [{ code: "first-order", name: "First Order" }],
    promotions: [],
    metadata: [],
    awardRule: {
      templateId: "points-per-dollar",
      templateConfig: { pointsPerDollar: 1 },
      rulePayload: {},
    },
    autoAwardBaseTier: true,
    birthdayBonusConfig: { bonusPoints: 100 },
  };
}

function fullySpec(): ProgramSpec {
  return {
    selectedFeatures: {
      programCurrency: true,
      expiry: true,
      pending: true,
      tiers: true,
      badges: true,
      programType: "event-based",
      signupBonus: true,
      birthdayBonus: true,
    },
    program: {
      code: "full-spec",
      name: "Full Spec",
      typeCode: "retail",
      typeName: "Retail",
      description: { en: "English description", "zh-Hant": "Traditional Chinese" },
    },
    currency: {
      code: "fs-pts",
      name: "Full Spec Points",
      currencyTypeCode: "points",
      currencyTypeName: "Points",
    },
    expiryRule: {
      type: "FIXED_PERIOD",
      expiryPeriod: "MONTHS",
      expiryPeriodValue: 12,
    },
    pendingRule: {
      type: "ROLLING_PERIOD",
      pendingPeriod: "DAYS",
      pendingPeriodValue: 7,
    },
    tiers: [
      { code: "base", name: "Base", pointsThreshold: 0 },
      { code: "elite", name: "Elite", pointsThreshold: 1000, description: "Top tier" },
    ],
    badges: [
      { code: "starter", name: "Starter" },
      { code: "pro", name: "Pro", description: "Pro user" },
    ],
    promotions: [],
    metadata: [],
    eventType: {
      code: "purchase",
      name: "Purchase",
      description: "A customer purchase",
      dataFields: [
        { name: "amount", type: "number", required: true },
        { name: "currency", type: "string", required: false },
      ],
    },
    awardRule: {
      templateId: "points-per-dollar",
      templateConfig: { pointsPerDollar: 2 },
      rulePayload: { code: "earn-rule", name: "Earn Rule" },
    },
    autoAwardBaseTier: true,
    signupBonusConfig: { bonusPoints: 50 },
    birthdayBonusConfig: { bonusPoints: 100 },
    testCustomer: {
      email: "test@example.com",
      firstName: "Test",
      lastName: "Customer",
      externalId: "ext-123",
    },
    existingCurrencyCode: "legacy",
    existingCurrencyId: "legacy-id-1",
  };
}

describe("excelFormat.parse", () => {
  it("parses happy-path-coffee-shop.xlsx fixture into a partial that matches the .md fixture's parsed partial", async () => {
    const xlsxResult = await excelFormat.parse(loadExcelFixture("happy-path-coffee-shop.xlsx"));
    const mdResult = await markdownFormat.parse(loadFixture("happy-path-coffee-shop.md"));

    const x = xlsxResult.partial;
    const m = mdResult.partial;

    expect(x.program?.code).toBe(m.program?.code);
    expect(x.program?.name).toBe(m.program?.name);
    expect(x.program?.typeCode).toBe(m.program?.typeCode);
    expect(x.currency?.code).toBe(m.currency?.code);
    expect(x.currency?.name).toBe(m.currency?.name);
    expect(x.autoAwardBaseTier).toBe(m.autoAwardBaseTier);
    expect(x.selectedFeatures?.tiers).toBe(m.selectedFeatures?.tiers);
    expect(x.selectedFeatures?.birthdayBonus).toBe(m.selectedFeatures?.birthdayBonus);
    expect(x.birthdayBonusConfig?.bonusPoints).toBe(m.birthdayBonusConfig?.bonusPoints);
    expect(x.awardRule?.templateId).toBe(m.awardRule?.templateId);
    expect(x.awardRule?.templateConfig?.["pointsPerDollar"]).toBe(1);

    expect(x.tiers).toHaveLength(3);
    expect(x.tiers?.[0]).toMatchObject({
      code: "green",
      name: "Green",
      pointsThreshold: 0,
      earnMultiplier: 1.0,
    });
    expect(x.tiers?.[2]).toMatchObject({
      code: "reserve",
      name: "Reserve",
      pointsThreshold: 2500,
      earnMultiplier: 1.7,
    });

    expect(x.badges).toHaveLength(1);
    expect(x.badges?.[0]).toMatchObject({ code: "first-order", name: "First Order" });

    const fields = xlsxResult.pendingExtractions.map((e) => e.expectedField).sort();
    expect(fields).toContain("promotions[0]");
    expect(fields).toContain("promotions[4]");
    expect(fields).toContain("promotions[5]");
    expect(xlsxResult.pendingExtractions).toHaveLength(6);
  });

  it("parse(render(spec)) round-trips all structured-backbone fields for a fully populated spec", async () => {
    const spec = fullySpec();
    const rendered = await excelFormat.render!(spec);
    const reparsed = await excelFormat.parse(rendered.buffer);
    const p = reparsed.partial;

    expect(p.program?.code).toBe(spec.program.code);
    expect(p.program?.name).toBe(spec.program.name);
    expect(p.program?.typeCode).toBe(spec.program.typeCode);
    expect(p.program?.description?.["en"]).toBe("English description");
    expect(p.program?.description?.["zh-Hant"]).toBe("Traditional Chinese");

    expect(p.currency?.code).toBe(spec.currency!.code);
    expect(p.currency?.currencyTypeCode).toBe(spec.currency!.currencyTypeCode);

    expect(p.expiryRule?.type).toBe("FIXED_PERIOD");
    expect(p.expiryRule?.expiryPeriod).toBe("MONTHS");
    expect(p.expiryRule?.expiryPeriodValue).toBe(12);

    expect(p.pendingRule?.type).toBe("ROLLING_PERIOD");
    expect(p.pendingRule?.pendingPeriod).toBe("DAYS");
    expect(p.pendingRule?.pendingPeriodValue).toBe(7);

    expect(p.tiers).toHaveLength(2);
    expect(p.badges).toHaveLength(2);

    expect(p.eventType?.code).toBe("purchase");
    expect(p.eventType?.dataFields).toHaveLength(2);
    expect(p.eventType?.dataFields?.[0]).toMatchObject({
      name: "amount",
      type: "number",
      required: true,
    });
    expect(p.eventType?.dataFields?.[1]).toMatchObject({
      name: "currency",
      type: "string",
      required: false,
    });

    expect(p.awardRule?.templateId).toBe("points-per-dollar");
    expect(p.awardRule?.templateConfig?.["pointsPerDollar"]).toBe(2);
    expect(p.awardRule?.rulePayload?.code).toBe("earn-rule");
    expect(p.awardRule?.rulePayload?.name).toBe("Earn Rule");

    expect(p.signupBonusConfig?.bonusPoints).toBe(50);
    expect(p.birthdayBonusConfig?.bonusPoints).toBe(100);

    expect(p.testCustomer?.email).toBe("test@example.com");
    expect(p.testCustomer?.firstName).toBe("Test");
    expect(p.testCustomer?.lastName).toBe("Customer");
    expect(p.testCustomer?.externalId).toBe("ext-123");

    expect(p.existingCurrencyCode).toBe("legacy");
    expect(p.existingCurrencyId).toBe("legacy-id-1");
    expect(p.autoAwardBaseTier).toBe(true);
  });

  it("throws EmptyUploadError when Spec sheet is absent", async () => {
    const wb = new ExcelJS.Workbook();
    wb.addWorksheet("Program");
    const buffer = await wb.xlsx.writeBuffer();
    await expect(excelFormat.parse(new Uint8Array(buffer))).rejects.toThrow(EmptyUploadError);
  });

  it("throws a clear migration error when Spec is absent and a pre-M3c key/value Metadata sheet is present", async () => {
    const wb = new ExcelJS.Workbook();
    const meta = wb.addWorksheet("Metadata");
    meta.addRow(["key", "value", "example"]);
    meta.addRow(["schemaVersion", "program-spec.v1", ""]);
    meta.addRow(["autoAwardBaseTier", "true", ""]);
    const buffer = await wb.xlsx.writeBuffer();
    let caught: unknown = undefined;
    try {
      await excelFormat.parse(new Uint8Array(buffer));
    } catch (err) {
      caught = err;
    }
    // It must NOT be the generic EmptyUploadError — that would hide the migration.
    expect(caught).toBeInstanceOf(TemplateParseError);
    expect(caught).not.toBeInstanceOf(EmptyUploadError);
    const msg = (caught as TemplateParseError).message;
    expect(msg).toMatch(/pre-M3c|rename/i);
    expect(msg).toContain("Spec");
    expect(msg).toContain("Metadata");
  });

  it("throws SchemaVersionMissingError when Spec schemaVersion row is absent", async () => {
    const wb = new ExcelJS.Workbook();
    const meta = wb.addWorksheet("Spec");
    meta.addRow(["key", "value", "example"]);
    meta.addRow(["autoAwardBaseTier", "true", ""]);
    const buffer = await wb.xlsx.writeBuffer();
    await expect(excelFormat.parse(new Uint8Array(buffer))).rejects.toThrow(
      SchemaVersionMissingError
    );
  });

  it("throws SchemaVersionMismatchError when Spec schemaVersion row has wrong value", async () => {
    const wb = new ExcelJS.Workbook();
    const meta = wb.addWorksheet("Spec");
    meta.addRow(["key", "value", "example"]);
    meta.addRow(["schemaVersion", "program-spec.v0", ""]);
    const buffer = await wb.xlsx.writeBuffer();
    await expect(excelFormat.parse(new Uint8Array(buffer))).rejects.toThrow(
      SchemaVersionMismatchError
    );
  });

  it("parses ExpiryRule sheet into spec.expiryRule correctly", async () => {
    const spec = happyPathSpec();
    spec.selectedFeatures.expiry = true;
    spec.expiryRule = {
      type: "FIXED_PERIOD",
      expiryPeriod: "MONTHS",
      expiryPeriodValue: 18,
    };
    const rendered = await excelFormat.render!(spec);
    const reparsed = await excelFormat.parse(rendered.buffer);
    expect(reparsed.partial.expiryRule?.type).toBe("FIXED_PERIOD");
    expect(reparsed.partial.expiryRule?.expiryPeriod).toBe("MONTHS");
    expect(reparsed.partial.expiryRule?.expiryPeriodValue).toBe(18);
  });

  it("parses PendingRule sheet into spec.pendingRule correctly", async () => {
    const spec = happyPathSpec();
    spec.selectedFeatures.pending = true;
    spec.pendingRule = {
      type: "FIXED_PERIOD",
      pendingPeriod: "DAYS",
      pendingPeriodValue: 30,
    };
    const rendered = await excelFormat.render!(spec);
    const reparsed = await excelFormat.parse(rendered.buffer);
    expect(reparsed.partial.pendingRule?.type).toBe("FIXED_PERIOD");
    expect(reparsed.partial.pendingRule?.pendingPeriod).toBe("DAYS");
    expect(reparsed.partial.pendingRule?.pendingPeriodValue).toBe(30);
  });

  it("parses EventType sheet including dataFields sub-table (multiple field rows, mix of required/optional)", async () => {
    const spec = happyPathSpec();
    spec.selectedFeatures.programType = "event-based";
    spec.eventType = {
      code: "visit",
      name: "Visit",
      description: "Customer visit",
      dataFields: [
        { name: "storeId", type: "string", required: true },
        { name: "amount", type: "number", required: true },
        { name: "isPromo", type: "boolean", required: false },
        { name: "occurredAt", type: "date", required: false },
      ],
    };
    const rendered = await excelFormat.render!(spec);
    const reparsed = await excelFormat.parse(rendered.buffer);
    const et = reparsed.partial.eventType;
    expect(et?.code).toBe("visit");
    expect(et?.name).toBe("Visit");
    expect(et?.description).toBe("Customer visit");
    expect(et?.dataFields).toHaveLength(4);
    expect(et?.dataFields?.[0]).toMatchObject({ name: "storeId", type: "string", required: true });
    expect(et?.dataFields?.[2]).toMatchObject({
      name: "isPromo",
      type: "boolean",
      required: false,
    });
    expect(et?.dataFields?.[3]).toMatchObject({
      name: "occurredAt",
      type: "date",
      required: false,
    });
  });

  it("parses AwardRule: templateId + templateConfig.* rows + rulePayload.* (with JSON-coerced numeric value)", async () => {
    const spec = happyPathSpec();
    spec.awardRule = {
      templateId: "points-per-dollar",
      templateConfig: { pointsPerDollar: 5, bonusFlag: true, label: "earn" },
      rulePayload: { code: "rp-code", name: "RP Name" },
    };
    const rendered = await excelFormat.render!(spec);
    const reparsed = await excelFormat.parse(rendered.buffer);
    expect(reparsed.partial.awardRule?.templateId).toBe("points-per-dollar");
    expect(reparsed.partial.awardRule?.templateConfig?.["pointsPerDollar"]).toBe(5);
    expect(reparsed.partial.awardRule?.templateConfig?.["bonusFlag"]).toBe(true);
    expect(reparsed.partial.awardRule?.templateConfig?.["label"]).toBe("earn");
    expect(reparsed.partial.awardRule?.rulePayload?.code).toBe("rp-code");
    expect(reparsed.partial.awardRule?.rulePayload?.name).toBe("RP Name");
  });

  it("parses SignupBonus/BirthdayBonus bonusPoints as integer", async () => {
    const spec = happyPathSpec();
    spec.selectedFeatures.signupBonus = true;
    spec.signupBonusConfig = { bonusPoints: 250 };
    spec.birthdayBonusConfig = { bonusPoints: 100 };
    const rendered = await excelFormat.render!(spec);
    const reparsed = await excelFormat.parse(rendered.buffer);
    expect(reparsed.partial.signupBonusConfig?.bonusPoints).toBe(250);
    expect(typeof reparsed.partial.signupBonusConfig?.bonusPoints).toBe("number");
    expect(reparsed.partial.birthdayBonusConfig?.bonusPoints).toBe(100);
  });

  it("parses TestCustomer sheet into spec.testCustomer", async () => {
    const spec = happyPathSpec();
    spec.testCustomer = {
      email: "qa@example.com",
      firstName: "QA",
      lastName: "User",
      externalId: "qa-1",
    };
    const rendered = await excelFormat.render!(spec);
    const reparsed = await excelFormat.parse(rendered.buffer);
    expect(reparsed.partial.testCustomer?.email).toBe("qa@example.com");
    expect(reparsed.partial.testCustomer?.firstName).toBe("QA");
    expect(reparsed.partial.testCustomer?.lastName).toBe("User");
    expect(reparsed.partial.testCustomer?.externalId).toBe("qa-1");
  });

  it("omits optional sheets when spec fields are absent (no ExpiryRule sheet rendered when spec.expiryRule undefined)", async () => {
    const spec = happyPathSpec();
    delete spec.expiryRule;
    delete spec.pendingRule;
    const rendered = await excelFormat.render!(spec);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(Buffer.from(rendered.buffer));
    expect(wb.getWorksheet("ExpiryRule")).toBeUndefined();
    expect(wb.getWorksheet("PendingRule")).toBeUndefined();
  });

  it("renders Program.description as per-locale rows (description.en, description.es) and parses them back into a Record<string, string>", async () => {
    const spec = happyPathSpec();
    spec.program.description = { en: "English desc", es: "Descripción" };
    const rendered = await excelFormat.render!(spec);
    const reparsed = await excelFormat.parse(rendered.buffer);
    expect(reparsed.partial.program?.description?.["en"]).toBe("English desc");
    expect(reparsed.partial.program?.description?.["es"]).toBe("Descripción");
  });

  it("auto-sorts unsorted tier thresholds and emits tiers-unsorted warning", async () => {
    const spec = happyPathSpec();
    spec.tiers = [
      { code: "gold", name: "Gold", pointsThreshold: 2500 },
      { code: "bronze", name: "Bronze", pointsThreshold: 0 },
      { code: "silver", name: "Silver", pointsThreshold: 500 },
    ];
    const rendered = await excelFormat.render!(spec);
    const reparsed = await excelFormat.parse(rendered.buffer);
    const thresholds = reparsed.partial.tiers?.map((t) => t!.pointsThreshold);
    expect(thresholds).toEqual([0, 500, 2500]);
    expect(reparsed.warnings.some((w) => w.code === "tiers-unsorted")).toBe(true);
  });

  it("throws DuplicateCodeError on duplicate tier code in Tiers sheet", async () => {
    const wb = new ExcelJS.Workbook();
    const meta = wb.addWorksheet("Spec");
    meta.addRow(["key", "value", "example"]);
    meta.addRow(["schemaVersion", "program-spec.v1", ""]);
    const sf = wb.addWorksheet("SelectedFeatures");
    sf.addRow(["key", "value", "example"]);
    sf.addRow(["programCurrency", "true", ""]);
    sf.addRow(["expiry", "false", ""]);
    sf.addRow(["pending", "false", ""]);
    sf.addRow(["tiers", "true", ""]);
    sf.addRow(["badges", "false", ""]);
    sf.addRow(["programType", "transactional", ""]);
    sf.addRow(["signupBonus", "false", ""]);
    sf.addRow(["birthdayBonus", "false", ""]);
    const prog = wb.addWorksheet("Program");
    prog.addRow(["key", "value", "example"]);
    prog.addRow(["code", "dup-tiers", ""]);
    prog.addRow(["name", "Dup Tiers", ""]);
    prog.addRow(["typeCode", "generic", ""]);
    const award = wb.addWorksheet("AwardRule");
    award.addRow(["key", "value", "example"]);
    award.addRow(["templateId", "points-per-dollar", ""]);
    award.addRow(["templateConfig.pointsPerDollar", "1", ""]);
    const tiers = wb.addWorksheet("Tiers");
    tiers.addRow(["code", "name", "pointsThreshold"]);
    tiers.addRow(["bronze", "Bronze", 0]);
    tiers.addRow(["bronze", "Bronze 2", 100]);
    const buffer = await wb.xlsx.writeBuffer();
    await expect(excelFormat.parse(new Uint8Array(buffer))).rejects.toThrow(DuplicateCodeError);
  });

  it("throws TableShapeError when Tiers sheet missing pointsThreshold column", async () => {
    const wb = new ExcelJS.Workbook();
    const meta = wb.addWorksheet("Spec");
    meta.addRow(["key", "value", "example"]);
    meta.addRow(["schemaVersion", "program-spec.v1", ""]);
    const sf = wb.addWorksheet("SelectedFeatures");
    sf.addRow(["key", "value", "example"]);
    sf.addRow(["programCurrency", "true", ""]);
    sf.addRow(["expiry", "false", ""]);
    sf.addRow(["pending", "false", ""]);
    sf.addRow(["tiers", "true", ""]);
    sf.addRow(["badges", "false", ""]);
    sf.addRow(["programType", "transactional", ""]);
    sf.addRow(["signupBonus", "false", ""]);
    sf.addRow(["birthdayBonus", "false", ""]);
    const prog = wb.addWorksheet("Program");
    prog.addRow(["key", "value", "example"]);
    prog.addRow(["code", "tiers-missing-col", ""]);
    prog.addRow(["name", "Tiers Missing Col", ""]);
    prog.addRow(["typeCode", "generic", ""]);
    const award = wb.addWorksheet("AwardRule");
    award.addRow(["key", "value", "example"]);
    award.addRow(["templateId", "points-per-dollar", ""]);
    const tiers = wb.addWorksheet("Tiers");
    tiers.addRow(["code", "name"]);
    tiers.addRow(["bronze", "Bronze"]);
    const buffer = await wb.xlsx.writeBuffer();
    await expect(excelFormat.parse(new Uint8Array(buffer))).rejects.toThrow(TableShapeError);
  });

  it("emits unknown-section warning for unrecognized sheet name without failing", async () => {
    const spec = happyPathSpec();
    const rendered = await excelFormat.render!(spec);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(Buffer.from(rendered.buffer));
    const extra = wb.addWorksheet("MysteryStuff");
    extra.addRow(["a", "b", "c"]);
    extra.addRow([1, 2, 3]);
    const buffer = await wb.xlsx.writeBuffer();
    const result = await excelFormat.parse(new Uint8Array(buffer));
    expect(result.warnings.some((w) => w.code === "unknown-section")).toBe(true);
  });

  it("emits formula-cell warning when a Tiers cell contains a formula and uses cell.result", async () => {
    const spec = happyPathSpec();
    const rendered = await excelFormat.render!(spec);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(Buffer.from(rendered.buffer));
    const tiers = wb.getWorksheet("Tiers");
    if (!tiers) throw new Error("Tiers sheet not present in fixture render");
    const headerRow = tiers.getRow(1);
    const headers: string[] = [];
    for (let i = 1; i <= headerRow.cellCount; i++) headers.push(headerRow.getCell(i).text);
    const ptCol = headers.indexOf("pointsThreshold") + 1;
    const cell = tiers.getRow(3).getCell(ptCol);
    cell.value = { formula: "100+400", result: 500 };
    const buffer = await wb.xlsx.writeBuffer();
    const result = await excelFormat.parse(new Uint8Array(buffer));
    expect(result.warnings.some((w) => w.code === "formula-cell")).toBe(true);
    const silver = result.partial.tiers?.find((t) => t?.code === "silver");
    expect(silver?.pointsThreshold).toBe(500);
  });

  it("throws TableShapeError on merged cells in Tiers header row", async () => {
    const wb = new ExcelJS.Workbook();
    const meta = wb.addWorksheet("Spec");
    meta.addRow(["key", "value", "example"]);
    meta.addRow(["schemaVersion", "program-spec.v1", ""]);
    const sf = wb.addWorksheet("SelectedFeatures");
    sf.addRow(["key", "value", "example"]);
    sf.addRow(["programCurrency", "true", ""]);
    sf.addRow(["expiry", "false", ""]);
    sf.addRow(["pending", "false", ""]);
    sf.addRow(["tiers", "true", ""]);
    sf.addRow(["badges", "false", ""]);
    sf.addRow(["programType", "transactional", ""]);
    sf.addRow(["signupBonus", "false", ""]);
    sf.addRow(["birthdayBonus", "false", ""]);
    const prog = wb.addWorksheet("Program");
    prog.addRow(["key", "value", "example"]);
    prog.addRow(["code", "merged-tiers", ""]);
    prog.addRow(["name", "Merged Tiers", ""]);
    prog.addRow(["typeCode", "generic", ""]);
    const award = wb.addWorksheet("AwardRule");
    award.addRow(["key", "value", "example"]);
    award.addRow(["templateId", "points-per-dollar", ""]);
    const tiers = wb.addWorksheet("Tiers");
    tiers.addRow(["code", "name", "pointsThreshold"]);
    tiers.addRow(["bronze", "Bronze", 0]);
    tiers.mergeCells("A1:B1");
    const buffer = await wb.xlsx.writeBuffer();
    await expect(excelFormat.parse(new Uint8Array(buffer))).rejects.toThrow(TableShapeError);
  });

  it("throws TableShapeError on merged cells in EventType header row", async () => {
    const spec = fullySpec();
    const rendered = await excelFormat.render!(spec);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(Buffer.from(rendered.buffer));
    const eventType = wb.getWorksheet("EventType");
    expect(eventType).toBeDefined();
    eventType!.mergeCells("A1:B1");
    const buffer = await wb.xlsx.writeBuffer();
    await expect(excelFormat.parse(new Uint8Array(buffer))).rejects.toThrow(TableShapeError);
  });

  it("reads booleans correctly: cell.text returns TRUE/FALSE caps, parser normalizes case-insensitively", async () => {
    const spec = happyPathSpec();
    const rendered = await excelFormat.render!(spec);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(Buffer.from(rendered.buffer));
    const sf = wb.getWorksheet("SelectedFeatures");
    if (!sf) throw new Error("SelectedFeatures sheet missing");
    sf.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const key = row.getCell(1).text;
      if (key === "programCurrency") row.getCell(2).value = true;
      if (key === "tiers") row.getCell(2).value = false;
    });
    const buffer = await wb.xlsx.writeBuffer();
    const result = await excelFormat.parse(new Uint8Array(buffer));
    expect(result.partial.selectedFeatures?.programCurrency).toBe(true);
    expect(result.partial.selectedFeatures?.tiers).toBe(false);
  });

  it("includeSampleData=true seeds sample Tiers/Badges rows when arrays are empty", async () => {
    const spec = happyPathSpec();
    spec.tiers = [];
    spec.badges = [];
    spec.selectedFeatures.tiers = false;
    spec.selectedFeatures.badges = false;
    const rendered = await excelFormat.render!(spec, { includeSampleData: true });
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(Buffer.from(rendered.buffer));
    const tiersSheet = wb.getWorksheet("Tiers");
    expect(tiersSheet).toBeDefined();
    expect(tiersSheet!.rowCount).toBeGreaterThanOrEqual(2);
    const badgesSheet = wb.getWorksheet("Badges");
    expect(badgesSheet).toBeDefined();
    expect(badgesSheet!.rowCount).toBeGreaterThanOrEqual(2);
  });

  it("parser ignores column C even when it contains arbitrary content", async () => {
    const spec = happyPathSpec();
    const rendered = await excelFormat.render!(spec);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(Buffer.from(rendered.buffer));
    const prog = wb.getWorksheet("Program");
    if (!prog) throw new Error("Program sheet missing");
    prog.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      row.getCell(3).value = "GARBAGE-DATA-IGNORED-XYZ";
    });
    const buffer = await wb.xlsx.writeBuffer();
    const result = await excelFormat.parse(new Uint8Array(buffer));
    expect(result.partial.program?.code).toBe("coffee-loyalty");
    expect(result.partial.program?.name).toBe("Coffee Loyalty");
  });

  it("render writes EXAMPLE_VALUES into column C for known keys (verify program.code, currency.code, expiryRule.type)", async () => {
    const spec = happyPathSpec();
    spec.selectedFeatures.expiry = true;
    spec.expiryRule = { type: "FIXED_PERIOD", expiryPeriod: "MONTHS", expiryPeriodValue: 12 };
    const rendered = await excelFormat.render!(spec);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(Buffer.from(rendered.buffer));

    const prog = wb.getWorksheet("Program")!;
    const programExamples: Record<string, string> = {};
    prog.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      programExamples[row.getCell(1).text] = row.getCell(3).text;
    });
    expect(programExamples["code"]).toBeTruthy();
    expect(programExamples["code"]!.length).toBeGreaterThan(0);

    const cur = wb.getWorksheet("Currency")!;
    const currencyExamples: Record<string, string> = {};
    cur.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      currencyExamples[row.getCell(1).text] = row.getCell(3).text;
    });
    expect(currencyExamples["code"]).toBeTruthy();

    const exp = wb.getWorksheet("ExpiryRule")!;
    const expiryExamples: Record<string, string> = {};
    exp.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      expiryExamples[row.getCell(1).text] = row.getCell(3).text;
    });
    expect(expiryExamples["type"]).toBeTruthy();
  });

  it("includeSampleData=true keeps column B empty for unset optional fields and renders examples only in column C", async () => {
    const spec = happyPathSpec();
    delete spec.testCustomer;
    const rendered = await excelFormat.render!(spec, { includeSampleData: true });
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(Buffer.from(rendered.buffer));

    const meta = wb.getWorksheet("Spec")!;
    let schemaVersionValue = "";
    meta.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      if (row.getCell(1).text === "schemaVersion") schemaVersionValue = row.getCell(2).text;
    });
    expect(schemaVersionValue).toBe("program-spec.v1");

    const tc = wb.getWorksheet("TestCustomer");
    expect(tc).toBeDefined();
    let emailValue = "";
    let emailExample = "";
    tc!.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      if (row.getCell(1).text === "email") {
        emailValue = row.getCell(2).text;
        emailExample = row.getCell(3).text;
      }
    });
    expect(emailValue).toBe("");
    expect(emailExample.length).toBeGreaterThan(0);
    expect(emailExample).toContain("@");
  });

  it("does not throw on merges below the header row (B10:C10) — regex must be anchored", async () => {
    const spec = happyPathSpec();
    const rendered = await excelFormat.render!(spec);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(Buffer.from(rendered.buffer));
    const tiers = wb.getWorksheet("Tiers");
    if (!tiers) throw new Error("Tiers sheet missing in fixture render");
    tiers.getCell("F10").value = "visual";
    tiers.getCell("G10").value = "";
    tiers.mergeCells("F10:G10");
    const buffer = await wb.xlsx.writeBuffer();
    const result = await excelFormat.parse(new Uint8Array(buffer));
    expect(result.partial.program?.code).toBe("coffee-loyalty");
    expect(result.partial.tiers?.length).toBeGreaterThan(0);
  });

  it("includeSampleData=true round-trip does not leak example values into parsed partial", async () => {
    const spec = happyPathSpec();
    delete (spec as Record<string, unknown>).existingCurrencyId;
    const rendered = await excelFormat.render!(spec, { includeSampleData: true });
    const reparsed = await excelFormat.parse(rendered.buffer);
    expect(reparsed.partial.existingCurrencyId).toBeUndefined();
  });

  it("includeSampleData=true round-trip does not leak example program.description into parsed partial", async () => {
    const spec = happyPathSpec();
    delete (spec.program as Record<string, unknown>).description;
    const rendered = await excelFormat.render!(spec, { includeSampleData: true });
    const reparsed = await excelFormat.parse(rendered.buffer);
    expect(reparsed.partial.program?.description).toBeUndefined();
  });

  it("AwardRule templateConfig.<key> with empty value is excluded from partial", async () => {
    const wb = new ExcelJS.Workbook();
    const meta = wb.addWorksheet("Spec");
    meta.addRow(["key", "value", "example"]);
    meta.addRow(["schemaVersion", "program-spec.v1", ""]);
    const sf = wb.addWorksheet("SelectedFeatures");
    sf.addRow(["key", "value", "example"]);
    sf.addRow(["programCurrency", "true", ""]);
    sf.addRow(["expiry", "false", ""]);
    sf.addRow(["pending", "false", ""]);
    sf.addRow(["tiers", "false", ""]);
    sf.addRow(["badges", "false", ""]);
    sf.addRow(["programType", "transactional", ""]);
    sf.addRow(["signupBonus", "false", ""]);
    sf.addRow(["birthdayBonus", "false", ""]);
    const prog = wb.addWorksheet("Program");
    prog.addRow(["key", "value", "example"]);
    prog.addRow(["code", "empty-tc", ""]);
    prog.addRow(["name", "Empty TC", ""]);
    prog.addRow(["typeCode", "generic", ""]);
    const award = wb.addWorksheet("AwardRule");
    award.addRow(["key", "value", "example"]);
    award.addRow(["templateId", "points-per-dollar", ""]);
    award.addRow(["templateConfig.foo", "", ""]);
    award.addRow(["templateConfig.bar", "42", ""]);
    const buffer = await wb.xlsx.writeBuffer();
    const result = await excelFormat.parse(new Uint8Array(buffer));
    expect(result.partial.awardRule?.templateConfig?.["foo"]).toBeUndefined();
    expect(result.partial.awardRule?.templateConfig?.["bar"]).toBe(42);
  });

  it("Program sheet bare description row emits bare-description warning", async () => {
    const wb = new ExcelJS.Workbook();
    const meta = wb.addWorksheet("Spec");
    meta.addRow(["key", "value", "example"]);
    meta.addRow(["schemaVersion", "program-spec.v1", ""]);
    const sf = wb.addWorksheet("SelectedFeatures");
    sf.addRow(["key", "value", "example"]);
    sf.addRow(["programCurrency", "true", ""]);
    sf.addRow(["expiry", "false", ""]);
    sf.addRow(["pending", "false", ""]);
    sf.addRow(["tiers", "false", ""]);
    sf.addRow(["badges", "false", ""]);
    sf.addRow(["programType", "transactional", ""]);
    sf.addRow(["signupBonus", "false", ""]);
    sf.addRow(["birthdayBonus", "false", ""]);
    const prog = wb.addWorksheet("Program");
    prog.addRow(["key", "value", "example"]);
    prog.addRow(["code", "bare-desc", ""]);
    prog.addRow(["name", "Bare Desc", ""]);
    prog.addRow(["typeCode", "generic", ""]);
    prog.addRow(["description", "Hello world", ""]);
    const award = wb.addWorksheet("AwardRule");
    award.addRow(["key", "value", "example"]);
    award.addRow(["templateId", "points-per-dollar", ""]);
    const buffer = await wb.xlsx.writeBuffer();
    const result = await excelFormat.parse(new Uint8Array(buffer));
    expect(result.warnings.some((w) => w.code === "bare-description")).toBe(true);
  });

  it("Program sheet bare description row with empty value does NOT emit bare-description warning", async () => {
    const wb = new ExcelJS.Workbook();
    const meta = wb.addWorksheet("Spec");
    meta.addRow(["key", "value", "example"]);
    meta.addRow(["schemaVersion", "program-spec.v1", ""]);
    const sf = wb.addWorksheet("SelectedFeatures");
    sf.addRow(["key", "value", "example"]);
    sf.addRow(["programCurrency", "true", ""]);
    sf.addRow(["expiry", "false", ""]);
    sf.addRow(["pending", "false", ""]);
    sf.addRow(["tiers", "false", ""]);
    sf.addRow(["badges", "false", ""]);
    sf.addRow(["programType", "transactional", ""]);
    sf.addRow(["signupBonus", "false", ""]);
    sf.addRow(["birthdayBonus", "false", ""]);
    const prog = wb.addWorksheet("Program");
    prog.addRow(["key", "value", "example"]);
    prog.addRow(["code", "empty-desc", ""]);
    prog.addRow(["name", "Empty Desc", ""]);
    prog.addRow(["typeCode", "generic", ""]);
    prog.addRow(["description", "", ""]);
    const award = wb.addWorksheet("AwardRule");
    award.addRow(["key", "value", "example"]);
    award.addRow(["templateId", "points-per-dollar", ""]);
    const buffer = await wb.xlsx.writeBuffer();
    const result = await excelFormat.parse(new Uint8Array(buffer));
    expect(result.warnings.some((w) => w.code === "bare-description")).toBe(false);
  });

  it("description.en.US emits invalid-locale warning and is not stored", async () => {
    const wb = new ExcelJS.Workbook();
    const meta = wb.addWorksheet("Spec");
    meta.addRow(["key", "value", "example"]);
    meta.addRow(["schemaVersion", "program-spec.v1", ""]);
    const sf = wb.addWorksheet("SelectedFeatures");
    sf.addRow(["key", "value", "example"]);
    sf.addRow(["programCurrency", "true", ""]);
    sf.addRow(["expiry", "false", ""]);
    sf.addRow(["pending", "false", ""]);
    sf.addRow(["tiers", "false", ""]);
    sf.addRow(["badges", "false", ""]);
    sf.addRow(["programType", "transactional", ""]);
    sf.addRow(["signupBonus", "false", ""]);
    sf.addRow(["birthdayBonus", "false", ""]);
    const prog = wb.addWorksheet("Program");
    prog.addRow(["key", "value", "example"]);
    prog.addRow(["code", "bad-locale", ""]);
    prog.addRow(["name", "Bad Locale", ""]);
    prog.addRow(["typeCode", "generic", ""]);
    prog.addRow(["description.en.US", "Hello", ""]);
    const award = wb.addWorksheet("AwardRule");
    award.addRow(["key", "value", "example"]);
    award.addRow(["templateId", "points-per-dollar", ""]);
    const buffer = await wb.xlsx.writeBuffer();
    const result = await excelFormat.parse(new Uint8Array(buffer));
    expect(result.warnings.some((w) => w.code === "invalid-locale")).toBe(true);
    expect(result.partial.program?.description?.["en.US"]).toBeUndefined();
  });

  it("expiryPeriodValue non-numeric throws TableShapeError", async () => {
    const spec = happyPathSpec();
    spec.selectedFeatures.expiry = true;
    spec.expiryRule = { type: "FIXED_PERIOD", expiryPeriod: "MONTHS", expiryPeriodValue: 12 };
    const rendered = await excelFormat.render!(spec);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(Buffer.from(rendered.buffer));
    const expiry = wb.getWorksheet("ExpiryRule");
    if (!expiry) throw new Error("ExpiryRule sheet missing");
    expiry.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      if (row.getCell(1).text === "expiryPeriodValue") row.getCell(2).value = "abc";
    });
    const buffer = await wb.xlsx.writeBuffer();
    await expect(excelFormat.parse(new Uint8Array(buffer))).rejects.toThrow(TableShapeError);
  });

  it("pendingPeriodValue non-numeric throws TableShapeError", async () => {
    const spec = happyPathSpec();
    spec.selectedFeatures.pending = true;
    spec.pendingRule = { type: "FIXED_PERIOD", pendingPeriod: "DAYS", pendingPeriodValue: 7 };
    const rendered = await excelFormat.render!(spec);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(Buffer.from(rendered.buffer));
    const pending = wb.getWorksheet("PendingRule");
    if (!pending) throw new Error("PendingRule sheet missing");
    pending.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      if (row.getCell(1).text === "pendingPeriodValue") row.getCell(2).value = "xyz";
    });
    const buffer = await wb.xlsx.writeBuffer();
    await expect(excelFormat.parse(new Uint8Array(buffer))).rejects.toThrow(TableShapeError);
  });

  it("birthdayBonus.bonusPoints non-numeric throws TableShapeError", async () => {
    const spec = happyPathSpec();
    spec.birthdayBonusConfig = { bonusPoints: 100 };
    const rendered = await excelFormat.render!(spec);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(Buffer.from(rendered.buffer));
    const birthday = wb.getWorksheet("BirthdayBonus");
    if (!birthday) throw new Error("BirthdayBonus sheet missing");
    birthday.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      if (row.getCell(1).text === "bonusPoints") row.getCell(2).value = "lots";
    });
    const buffer = await wb.xlsx.writeBuffer();
    await expect(excelFormat.parse(new Uint8Array(buffer))).rejects.toThrow(TableShapeError);
  });

  it("signupBonus.bonusPoints non-numeric throws TableShapeError", async () => {
    const spec = happyPathSpec();
    spec.signupBonusConfig = { bonusPoints: 50 };
    const rendered = await excelFormat.render!(spec);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(Buffer.from(rendered.buffer));
    const signup = wb.getWorksheet("SignupBonus");
    if (!signup) throw new Error("SignupBonus sheet missing");
    signup.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      if (row.getCell(1).text === "bonusPoints") row.getCell(2).value = "many";
    });
    const buffer = await wb.xlsx.writeBuffer();
    await expect(excelFormat.parse(new Uint8Array(buffer))).rejects.toThrow(TableShapeError);
  });

  it("duplicate key in singleton sheet emits duplicate-key warning and last-wins", async () => {
    const wb = new ExcelJS.Workbook();
    const meta = wb.addWorksheet("Spec");
    meta.addRow(["key", "value", "example"]);
    meta.addRow(["schemaVersion", "program-spec.v1", ""]);
    const sf = wb.addWorksheet("SelectedFeatures");
    sf.addRow(["key", "value", "example"]);
    sf.addRow(["programCurrency", "true", ""]);
    sf.addRow(["expiry", "false", ""]);
    sf.addRow(["pending", "false", ""]);
    sf.addRow(["tiers", "false", ""]);
    sf.addRow(["badges", "false", ""]);
    sf.addRow(["programType", "transactional", ""]);
    sf.addRow(["signupBonus", "false", ""]);
    sf.addRow(["birthdayBonus", "false", ""]);
    const prog = wb.addWorksheet("Program");
    prog.addRow(["key", "value", "example"]);
    prog.addRow(["code", "first-code", ""]);
    prog.addRow(["code", "second-code", ""]);
    prog.addRow(["name", "Dup Key", ""]);
    prog.addRow(["typeCode", "generic", ""]);
    const award = wb.addWorksheet("AwardRule");
    award.addRow(["key", "value", "example"]);
    award.addRow(["templateId", "points-per-dollar", ""]);
    const buffer = await wb.xlsx.writeBuffer();
    const result = await excelFormat.parse(new Uint8Array(buffer));
    expect(result.warnings.some((w) => w.code === "duplicate-key")).toBe(true);
    expect(result.partial.program?.code).toBe("second-code");
  });

  it("throws TableShapeError (not generic Error) on blank row between EventType dataFields marker and header", async () => {
    const wb = new ExcelJS.Workbook();
    const meta = wb.addWorksheet("Spec");
    meta.addRow(["key", "value", "example"]);
    meta.addRow(["schemaVersion", "program-spec.v1", ""]);
    const sf = wb.addWorksheet("SelectedFeatures");
    sf.addRow(["key", "value", "example"]);
    sf.addRow(["programCurrency", "true", ""]);
    sf.addRow(["expiry", "false", ""]);
    sf.addRow(["pending", "false", ""]);
    sf.addRow(["tiers", "false", ""]);
    sf.addRow(["badges", "false", ""]);
    sf.addRow(["programType", "event-based", ""]);
    sf.addRow(["signupBonus", "false", ""]);
    sf.addRow(["birthdayBonus", "false", ""]);
    const prog = wb.addWorksheet("Program");
    prog.addRow(["key", "value", "example"]);
    prog.addRow(["code", "evt-blank", ""]);
    prog.addRow(["name", "Event Blank", ""]);
    prog.addRow(["typeCode", "generic", ""]);
    const award = wb.addWorksheet("AwardRule");
    award.addRow(["key", "value", "example"]);
    award.addRow(["templateId", "points-per-dollar", ""]);
    const evt = wb.addWorksheet("EventType");
    evt.addRow(["key", "value", "example"]);
    evt.addRow(["code", "purchase", ""]);
    evt.addRow(["name", "Purchase", ""]);
    evt.addRow(["description", "Customer purchase", ""]);
    evt.addRow(["dataFields", "", ""]);
    evt.addRow(["", "", ""]);
    evt.addRow(["name", "type", "required"]);
    evt.addRow(["amount", "number", "true"]);
    const buffer = await wb.xlsx.writeBuffer();
    let caught: unknown = undefined;
    try {
      await excelFormat.parse(new Uint8Array(buffer));
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(TableShapeError);
  });
});

describe("excelFormat — row-based Metadata sheet", () => {
  function metadataSpec(): ProgramSpec {
    return {
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
          description: "Standard points",
        },
      ],
      awardRule: {
        templateId: "points-per-dollar",
        templateConfig: { pointsPerDollar: 1 },
        rulePayload: {},
      },
    };
  }

  it("round-trips a populated metadata array", async () => {
    const spec = metadataSpec();
    const rendered = await excelFormat.render!(spec);
    const reparsed = await excelFormat.parse(rendered.buffer);
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
      description: "Standard points",
    });
  });

  it("omits the Metadata sheet when the array is empty", async () => {
    const spec = metadataSpec();
    spec.metadata = [];
    const rendered = await excelFormat.render!(spec);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(Buffer.from(rendered.buffer));
    expect(wb.getWorksheet("Metadata")).toBeUndefined();
  });

  it("renders TYPE-only rows (code blank)", async () => {
    const spec = metadataSpec();
    spec.metadata = [{ category: "DATA_TYPE", typeCode: "EVENT_TYPE", name: "Event Type" }];
    const rendered = await excelFormat.render!(spec);
    const reparsed = await excelFormat.parse(rendered.buffer);
    expect(reparsed.partial.metadata).toHaveLength(1);
    expect(reparsed.partial.metadata?.[0]?.code).toBeUndefined();
    expect(reparsed.partial.metadata?.[0]?.name).toBe("Event Type");
  });

  it("throws TableShapeError when Metadata sheet missing required column", async () => {
    const wb = new ExcelJS.Workbook();
    const spec = wb.addWorksheet("Spec");
    spec.addRow(["key", "value", "example"]);
    spec.addRow(["schemaVersion", "program-spec.v1", ""]);
    const sf = wb.addWorksheet("SelectedFeatures");
    sf.addRow(["key", "value", "example"]);
    sf.addRow(["programCurrency", "true", ""]);
    sf.addRow(["expiry", "false", ""]);
    sf.addRow(["pending", "false", ""]);
    sf.addRow(["tiers", "false", ""]);
    sf.addRow(["badges", "false", ""]);
    sf.addRow(["programType", "transactional", ""]);
    sf.addRow(["signupBonus", "false", ""]);
    sf.addRow(["birthdayBonus", "false", ""]);
    const prog = wb.addWorksheet("Program");
    prog.addRow(["key", "value", "example"]);
    prog.addRow(["code", "missing-col", ""]);
    prog.addRow(["name", "Missing Col", ""]);
    prog.addRow(["typeCode", "standard", ""]);
    const award = wb.addWorksheet("AwardRule");
    award.addRow(["key", "value", "example"]);
    award.addRow(["templateId", "points-per-dollar", ""]);
    const meta = wb.addWorksheet("Metadata");
    meta.addRow(["typeCode", "code", "name"]);
    meta.addRow(["PROGRAM_TYPE", "retail", "Retail"]);
    const buffer = await wb.xlsx.writeBuffer();
    await expect(excelFormat.parse(new Uint8Array(buffer))).rejects.toThrow(TableShapeError);
  });

  it("treats description and code columns as optional", async () => {
    const wb = new ExcelJS.Workbook();
    const spec = wb.addWorksheet("Spec");
    spec.addRow(["key", "value", "example"]);
    spec.addRow(["schemaVersion", "program-spec.v1", ""]);
    const sf = wb.addWorksheet("SelectedFeatures");
    sf.addRow(["key", "value", "example"]);
    sf.addRow(["programCurrency", "true", ""]);
    sf.addRow(["expiry", "false", ""]);
    sf.addRow(["pending", "false", ""]);
    sf.addRow(["tiers", "false", ""]);
    sf.addRow(["badges", "false", ""]);
    sf.addRow(["programType", "transactional", ""]);
    sf.addRow(["signupBonus", "false", ""]);
    sf.addRow(["birthdayBonus", "false", ""]);
    const prog = wb.addWorksheet("Program");
    prog.addRow(["key", "value", "example"]);
    prog.addRow(["code", "min-col", ""]);
    prog.addRow(["name", "Min Col", ""]);
    prog.addRow(["typeCode", "standard", ""]);
    const award = wb.addWorksheet("AwardRule");
    award.addRow(["key", "value", "example"]);
    award.addRow(["templateId", "points-per-dollar", ""]);
    const meta = wb.addWorksheet("Metadata");
    meta.addRow(["category", "typeCode", "name"]);
    meta.addRow(["DATA_TYPE", "EVENT_TYPE", "Event Type"]);
    const buffer = await wb.xlsx.writeBuffer();
    const result = await excelFormat.parse(new Uint8Array(buffer));
    expect(result.partial.metadata).toHaveLength(1);
    expect(result.partial.metadata?.[0]?.description).toBeUndefined();
    expect(result.partial.metadata?.[0]?.code).toBeUndefined();
  });

  it("emits duplicate-metadata warning on repeated (typeCode, code) tuples", async () => {
    const wb = new ExcelJS.Workbook();
    const spec = wb.addWorksheet("Spec");
    spec.addRow(["key", "value", "example"]);
    spec.addRow(["schemaVersion", "program-spec.v1", ""]);
    const sf = wb.addWorksheet("SelectedFeatures");
    sf.addRow(["key", "value", "example"]);
    sf.addRow(["programCurrency", "true", ""]);
    sf.addRow(["expiry", "false", ""]);
    sf.addRow(["pending", "false", ""]);
    sf.addRow(["tiers", "false", ""]);
    sf.addRow(["badges", "false", ""]);
    sf.addRow(["programType", "transactional", ""]);
    sf.addRow(["signupBonus", "false", ""]);
    sf.addRow(["birthdayBonus", "false", ""]);
    const prog = wb.addWorksheet("Program");
    prog.addRow(["key", "value", "example"]);
    prog.addRow(["code", "dup-meta", ""]);
    prog.addRow(["name", "Dup Meta", ""]);
    prog.addRow(["typeCode", "standard", ""]);
    const award = wb.addWorksheet("AwardRule");
    award.addRow(["key", "value", "example"]);
    award.addRow(["templateId", "points-per-dollar", ""]);
    const meta = wb.addWorksheet("Metadata");
    meta.addRow(["category", "typeCode", "code", "name", "description"]);
    meta.addRow(["DATA_TYPE", "PROGRAM_TYPE", "retail", "Retail", ""]);
    meta.addRow(["DATA_TYPE", "PROGRAM_TYPE", "retail", "Retail Two", ""]);
    const buffer = await wb.xlsx.writeBuffer();
    const result = await excelFormat.parse(new Uint8Array(buffer));
    const warning = result.warnings.find((w) => w.code === "duplicate-metadata");
    expect(warning).toBeDefined();
  });
});

describe("excelFormat — metadata consistency warnings", () => {
  function buildBaseWorkbook(opts: {
    programTypeCode?: string;
    currencyTypeCode?: string;
    metadataRows?: Array<[string, string, string, string, string]>;
  }): ExcelJS.Workbook {
    const wb = new ExcelJS.Workbook();
    const spec = wb.addWorksheet("Spec");
    spec.addRow(["key", "value", "example"]);
    spec.addRow(["schemaVersion", "program-spec.v1", ""]);
    const sf = wb.addWorksheet("SelectedFeatures");
    sf.addRow(["key", "value", "example"]);
    sf.addRow(["programCurrency", opts.currencyTypeCode ? "true" : "false", ""]);
    sf.addRow(["expiry", "false", ""]);
    sf.addRow(["pending", "false", ""]);
    sf.addRow(["tiers", "false", ""]);
    sf.addRow(["badges", "false", ""]);
    sf.addRow(["programType", "transactional", ""]);
    sf.addRow(["signupBonus", "false", ""]);
    sf.addRow(["birthdayBonus", "false", ""]);
    const prog = wb.addWorksheet("Program");
    prog.addRow(["key", "value", "example"]);
    prog.addRow(["code", "meta-consist", ""]);
    prog.addRow(["name", "Meta Consist", ""]);
    if (opts.programTypeCode) prog.addRow(["typeCode", opts.programTypeCode, ""]);
    if (opts.currencyTypeCode) {
      const cur = wb.addWorksheet("Currency");
      cur.addRow(["key", "value", "example"]);
      cur.addRow(["code", "pts", ""]);
      cur.addRow(["name", "Points", ""]);
      cur.addRow(["currencyTypeCode", opts.currencyTypeCode, ""]);
    }
    const award = wb.addWorksheet("AwardRule");
    award.addRow(["key", "value", "example"]);
    award.addRow(["templateId", "points-per-dollar", ""]);
    if (opts.metadataRows && opts.metadataRows.length > 0) {
      const meta = wb.addWorksheet("Metadata");
      meta.addRow(["category", "typeCode", "code", "name", "description"]);
      for (const r of opts.metadataRows) meta.addRow(r);
    }
    return wb;
  }

  it("warns when program.typeCode has no matching PROGRAM_TYPE metadata row", async () => {
    const wb = buildBaseWorkbook({ programTypeCode: "retail" });
    const buffer = await wb.xlsx.writeBuffer();
    const result = await excelFormat.parse(new Uint8Array(buffer));
    const warning = result.warnings.find((w) => w.code === "metadata-missing-program-type");
    expect(warning).toBeDefined();
    expect(warning?.message).toContain("retail");
    expect(warning?.message).toContain("PROGRAM_TYPE");
  });

  it("does NOT warn when a PROGRAM_TYPE metadata row matches program.typeCode", async () => {
    const wb = buildBaseWorkbook({
      programTypeCode: "retail",
      metadataRows: [["DATA_TYPE", "PROGRAM_TYPE", "retail", "Retail", ""]],
    });
    const buffer = await wb.xlsx.writeBuffer();
    const result = await excelFormat.parse(new Uint8Array(buffer));
    expect(result.warnings.find((w) => w.code === "metadata-missing-program-type")).toBeUndefined();
  });

  it("warns metadata-missing-currency-type when program is matched but currency lacks its row", async () => {
    const wb = buildBaseWorkbook({
      programTypeCode: "retail",
      currencyTypeCode: "points",
      metadataRows: [["DATA_TYPE", "PROGRAM_TYPE", "retail", "Retail", ""]],
    });
    const buffer = await wb.xlsx.writeBuffer();
    const result = await excelFormat.parse(new Uint8Array(buffer));
    expect(result.warnings.find((w) => w.code === "metadata-missing-program-type")).toBeUndefined();
    const cur = result.warnings.find((w) => w.code === "metadata-missing-currency-type");
    expect(cur).toBeDefined();
    expect(cur?.message).toContain("points");
    expect(cur?.message).toContain("CURRENCY_TYPE");
  });

  it("warns metadata-orphan-instance when an instance row references an unknown typeCode", async () => {
    const wb = buildBaseWorkbook({
      programTypeCode: "standard",
      metadataRows: [
        ["DATA_TYPE", "PROGRAM_TYPE", "standard", "Standard", ""],
        ["DATA_TYPE", "EMPLOYEE_RANK", "senior", "Senior", ""],
      ],
    });
    const buffer = await wb.xlsx.writeBuffer();
    const result = await excelFormat.parse(new Uint8Array(buffer));
    const orphan = result.warnings.find((w) => w.code === "metadata-orphan-instance");
    expect(orphan).toBeDefined();
    expect(orphan?.message).toContain("EMPLOYEE_RANK");
    expect(orphan?.message).toContain("senior");
  });

  it("does NOT warn metadata-orphan-instance when a TYPE row in the same spec defines the typeCode", async () => {
    const wb = buildBaseWorkbook({
      programTypeCode: "standard",
      metadataRows: [
        ["DATA_TYPE", "PROGRAM_TYPE", "standard", "Standard", ""],
        ["DATA_TYPE", "EMPLOYEE_RANK", "", "Employee Rank", ""],
        ["DATA_TYPE", "EMPLOYEE_RANK", "senior", "Senior", ""],
      ],
    });
    const buffer = await wb.xlsx.writeBuffer();
    const result = await excelFormat.parse(new Uint8Array(buffer));
    expect(result.warnings.find((w) => w.code === "metadata-orphan-instance")).toBeUndefined();
  });

  it("treats whitespace-only `code` cell as TYPE row (not INSTANCE)", async () => {
    const wb = buildBaseWorkbook({
      programTypeCode: "standard",
      metadataRows: [["DATA_TYPE", "PROGRAM_TYPE", "   ", "Standard", ""]],
    });
    const buffer = await wb.xlsx.writeBuffer();
    const result = await excelFormat.parse(new Uint8Array(buffer));
    expect(result.partial.metadata).toHaveLength(1);
    expect(result.partial.metadata?.[0]?.code).toBeUndefined();
    expect(result.partial.metadata?.[0]?.name).toBe("Standard");
  });

  it("warns unknown-metadata-category for unknown category in excel", async () => {
    const wb = buildBaseWorkbook({
      programTypeCode: "standard",
      metadataRows: [["UNKNOWN_CAT", "PROGRAM_TYPE", "", "Standard", ""]],
    });
    const buffer = await wb.xlsx.writeBuffer();
    const result = await excelFormat.parse(new Uint8Array(buffer));
    const warn = result.warnings.find((w) => w.code === "unknown-metadata-category");
    expect(warn).toBeDefined();
    expect(warn?.message).toContain("UNKNOWN_CAT");
  });

  it("dedups unknown-metadata-category by category value (one warning per unique typo)", async () => {
    const wb = buildBaseWorkbook({
      programTypeCode: "standard",
      metadataRows: [
        ["UNKNOWN_CAT", "PROGRAM_TYPE", "", "Standard", ""],
        ["UNKNOWN_CAT", "CURRENCY_TYPE", "", "Currency", ""],
        ["UNKNOWN_CAT", "EVENT_TYPE", "", "Event", ""],
      ],
    });
    const buffer = await wb.xlsx.writeBuffer();
    const result = await excelFormat.parse(new Uint8Array(buffer));
    const warns = result.warnings.filter((w) => w.code === "unknown-metadata-category");
    expect(warns).toHaveLength(1);
  });

  it("emits metadata-over-cap warning when metadata sheet exceeds MAX_METADATA_RECORDS_PER_PROGRAM", async () => {
    const rows: Array<[string, string, string, string, string]> = [];
    for (let i = 0; i < 201; i++) {
      rows.push(["DATA_TYPE", `TYPE_${i}`, "", `Type ${i}`, ""]);
    }
    const wb = buildBaseWorkbook({
      programTypeCode: "standard",
      metadataRows: rows,
    });
    const buffer = await wb.xlsx.writeBuffer();
    const result = await excelFormat.parse(new Uint8Array(buffer));
    const overCap = result.warnings.find((w) => w.code === "metadata-over-cap");
    expect(overCap).toBeDefined();
    expect(overCap?.message).toContain("201");
    expect(overCap?.message).toContain("200");
  });
});

// ====================================================================
// Zip-bomb pre-flight guard
// ====================================================================

/**
 * Build a synthetic ZIP archive where the central directory CLAIMS a huge
 * uncompressed size while the actual stored bytes are empty. The pre-flight
 * guard inspects CD metadata only, so it must reject before any decompression
 * runs. Constructed at the byte level so the bomb stays tiny (~100 bytes
 * claiming 1 GB+ uncompressed).
 */
interface ZipBombOptions {
  uncompressedSize?: number;
  compressedSize?: number;
  entriesOnDisk?: number;
  totalEntries?: number;
  /** Override the EOCD's cdOffset field after construction (zip64 sentinel test). */
  cdOffsetOverride?: number;
  /** Override the EOCD's cdSize field after construction (zip64 sentinel test). */
  cdSizeOverride?: number;
}

function buildZipBombFixture(opts: number | ZipBombOptions): Uint8Array {
  const o: ZipBombOptions = typeof opts === "number" ? { uncompressedSize: opts } : opts;
  const uncompressedSize = o.uncompressedSize ?? 0;
  const compressedSize = o.compressedSize ?? 0;
  const entriesOnDisk = o.entriesOnDisk ?? 1;
  const totalEntries = o.totalEntries ?? 1;

  const NAME = Buffer.from("a.xml", "utf8");
  const NAME_LEN = NAME.length;

  const lfh = Buffer.alloc(30 + NAME_LEN);
  lfh.writeUInt32LE(0x04034b50, 0);
  lfh.writeUInt16LE(20, 4);
  lfh.writeUInt16LE(0, 6);
  lfh.writeUInt16LE(0, 8);
  lfh.writeUInt16LE(0, 10);
  lfh.writeUInt16LE(0, 12);
  lfh.writeUInt32LE(0, 14);
  lfh.writeUInt32LE(compressedSize, 18);
  lfh.writeUInt32LE(uncompressedSize, 22);
  lfh.writeUInt16LE(NAME_LEN, 26);
  lfh.writeUInt16LE(0, 28);
  NAME.copy(lfh, 30);

  const cdh = Buffer.alloc(46 + NAME_LEN);
  cdh.writeUInt32LE(0x02014b50, 0);
  cdh.writeUInt16LE(20, 4);
  cdh.writeUInt16LE(20, 6);
  cdh.writeUInt16LE(0, 8);
  cdh.writeUInt16LE(0, 10);
  cdh.writeUInt16LE(0, 12);
  cdh.writeUInt16LE(0, 14);
  cdh.writeUInt32LE(0, 16);
  cdh.writeUInt32LE(compressedSize, 20);
  cdh.writeUInt32LE(uncompressedSize, 24);
  cdh.writeUInt16LE(NAME_LEN, 28);
  cdh.writeUInt16LE(0, 30);
  cdh.writeUInt16LE(0, 32);
  cdh.writeUInt16LE(0, 34);
  cdh.writeUInt16LE(0, 36);
  cdh.writeUInt32LE(0, 38);
  cdh.writeUInt32LE(0, 42);
  NAME.copy(cdh, 46);

  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entriesOnDisk, 8);
  eocd.writeUInt16LE(totalEntries, 10);
  eocd.writeUInt32LE(o.cdSizeOverride ?? cdh.length, 12);
  eocd.writeUInt32LE(o.cdOffsetOverride ?? lfh.length, 16);
  eocd.writeUInt16LE(0, 20);

  return new Uint8Array(Buffer.concat([lfh, cdh, eocd]));
}

describe("excelFormat.parse — zip-bomb pre-flight", () => {
  it("rejects a workbook whose central directory claims > 50 MB uncompressed", async () => {
    const bomb = buildZipBombFixture(60 * 1024 * 1024);
    await expect(excelFormat.parse(bomb)).rejects.toThrow(TableShapeError);
    await expect(excelFormat.parse(bomb)).rejects.toThrow(/50 MB|uncompressed/i);
  });

  it("rejects a workbook that uses zip64 (uncompressedSize = 0xFFFFFFFF marker)", async () => {
    const zip64Marker = buildZipBombFixture(0xffffffff);
    await expect(excelFormat.parse(zip64Marker)).rejects.toThrow(TableShapeError);
  });

  it("rejects a workbook that uses zip64 (compressedSize = 0xFFFFFFFF marker)", async () => {
    // Zip64 spec: ANY of {compressedSize, uncompressedSize, ...} == 0xFFFFFFFF
    // signals 'see zip64 extra field' where the real (potentially huge) value
    // lives. Checking only uncompressedSize lets an attacker pass an entry
    // with small uncompressedSize but huge compressedSize-via-zip64-extra.
    const zip64Marker = buildZipBombFixture({
      uncompressedSize: 100,
      compressedSize: 0xffffffff,
    });
    await expect(excelFormat.parse(zip64Marker)).rejects.toThrow(TableShapeError);
  });

  it("rejects a real zip64 archive (EOCD cdOffset is the 0xFFFFFFFF sentinel)", async () => {
    // A properly-formed zip64 has cdOffset = 0xFFFFFFFF in the regular EOCD,
    // pointing at the Zip64 EOCD Locator. Without this guard, the cap-check
    // cursor lands OOB on the first iteration, silently returns, and ExcelJS
    // (zip64-capable) walks the real CD and OOMs.
    const zip64Real = buildZipBombFixture({
      uncompressedSize: 100,
      cdOffsetOverride: 0xffffffff,
    });
    await expect(excelFormat.parse(zip64Real)).rejects.toThrow(TableShapeError);
    await expect(excelFormat.parse(zip64Real)).rejects.toThrow(/zip64/i);
  });

  it("rejects a real zip64 archive (EOCD cdSize is the 0xFFFFFFFF sentinel)", async () => {
    const zip64Real = buildZipBombFixture({
      uncompressedSize: 100,
      cdSizeOverride: 0xffffffff,
    });
    await expect(excelFormat.parse(zip64Real)).rejects.toThrow(TableShapeError);
    await expect(excelFormat.parse(zip64Real)).rejects.toThrow(/zip64/i);
  });

  it("rejects a real zip64 archive (entries-on-disk is the 0xFFFF sentinel)", async () => {
    const zip64Real = buildZipBombFixture({
      uncompressedSize: 100,
      entriesOnDisk: 0xffff,
      totalEntries: 0xffff,
    });
    await expect(excelFormat.parse(zip64Real)).rejects.toThrow(TableShapeError);
    await expect(excelFormat.parse(zip64Real)).rejects.toThrow(/zip64/i);
  });

  it("rejects a workbook when entries-on-disk and total-entries disagree (lying header)", async () => {
    // ExcelJS may read total-entries (offset +12) while the guard reads
    // entries-on-disk (offset +10). Attacker sets +10 = 1, +12 = 1000 to slip
    // 999 entries past the cap check while ExcelJS walks all 1000 and OOMs.
    // Defense: use max of both, or reject on disagreement.
    const lying = buildZipBombFixture({
      uncompressedSize: 100,
      entriesOnDisk: 1,
      totalEntries: 1000,
    });
    await expect(excelFormat.parse(lying)).rejects.toThrow(TableShapeError);
  });

  it("accepts a real (small) workbook produced via render → parse round-trip", async () => {
    const spec = happyPathSpec();
    const rendered = await excelFormat.render!(spec);
    await expect(excelFormat.parse(rendered.buffer)).resolves.toBeDefined();
  });
});

describe("parseExcelMultiplierCell", () => {
  it("strips a trailing `x` (case-insensitive)", () => {
    expect(parseExcelMultiplierCell("1.7x")).toBe(1.7);
    expect(parseExcelMultiplierCell("2X")).toBe(2);
  });

  it("strips commas", () => {
    expect(parseExcelMultiplierCell("1,000")).toBe(1000);
  });

  it("parses a bare number", () => {
    expect(parseExcelMultiplierCell("1.2")).toBe(1.2);
  });

  it("returns null for empty input and non-numeric prose", () => {
    expect(parseExcelMultiplierCell("")).toBeNull();
    expect(parseExcelMultiplierCell("double Beans")).toBeNull();
  });
});

describe("parseExcelIntegerCell", () => {
  it("does NOT strip a trailing `x` — ambiguous prose routes to the LLM", () => {
    // Regression #496: `500x` must NOT silently parse as 500.
    expect(parseExcelIntegerCell("500x")).toBeNull();
    expect(parseExcelIntegerCell("500X")).toBeNull();
  });

  it("rejects floats", () => {
    expect(parseExcelIntegerCell("100.5")).toBeNull();
    expect(parseExcelIntegerCell("1.0")).toBeNull();
  });

  it("parses a bare integer", () => {
    expect(parseExcelIntegerCell("500")).toBe(500);
    expect(parseExcelIntegerCell("0")).toBe(0);
  });

  it("strips commas", () => {
    expect(parseExcelIntegerCell("2,500")).toBe(2500);
  });

  it("returns null for empty input and non-numeric prose", () => {
    expect(parseExcelIntegerCell("")).toBeNull();
    expect(parseExcelIntegerCell("Members start here.")).toBeNull();
  });
});
