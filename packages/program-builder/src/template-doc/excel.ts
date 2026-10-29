import ExcelJS from "exceljs";

import { validateProgramSpecPartial } from "../linter.js";
import {
  MAX_BADGES_PER_PROGRAM,
  MAX_METADATA_RECORDS_PER_PROGRAM,
  MAX_PROMOTIONS_PER_PROGRAM,
  MAX_TIERS_PER_PROGRAM,
  type MetadataRecord,
  type ProgramSpec,
  type WizardBadge,
  type WizardPromotion,
  type WizardTier,
} from "../spec.js";
import {
  DuplicateCodeError,
  EmptyUploadError,
  TableShapeError,
  TemplateParseError,
} from "./errors.js";
import { checkMetadataConsistency } from "./metadata-consistency.js";
import { assertSchemaVersion, TEMPLATE_SCHEMA_VERSION } from "./schema.js";
import { setAtPath } from "./set-at-path.js";
import type {
  DeepPartial,
  DocumentFormat,
  FreeformExtractionRequest,
  ParseOptions,
  ParseResult,
  RenderOptions,
  RenderResult,
  Warning,
} from "./types.js";

const MAX_WARNINGS = 256;
const MAX_FREEFORM_SECTIONS = 256;
const MAX_TABLE_ROWS =
  Math.max(
    MAX_TIERS_PER_PROGRAM,
    MAX_BADGES_PER_PROGRAM,
    MAX_METADATA_RECORDS_PER_PROGRAM,
    MAX_PROMOTIONS_PER_PROGRAM
  ) + 10;

const SHEET_HEADER = ["key", "value", "example"] as const;
const TIER_REQUIRED_COLUMNS = ["code", "name", "pointsThreshold"] as const;
const TIER_OPTIONAL_COLUMNS = ["counterTargetTypeCode", "description", "bonus"] as const;
const BADGE_REQUIRED_COLUMNS = ["code", "name"] as const;
const BADGE_OPTIONAL_COLUMNS = ["description"] as const;
const PROMOTION_REQUIRED_COLUMNS = ["name", "description"] as const;
const PROMOTION_OPTIONAL_COLUMNS: readonly string[] = [];
const METADATA_REQUIRED_COLUMNS = ["category", "typeCode", "name"] as const;
const METADATA_OPTIONAL_COLUMNS = ["code", "description"] as const;

const DATA_FIELDS_MARKER = "dataFields";
const DATA_FIELDS_COLUMNS = ["name", "type", "required"] as const;

const KNOWN_SHEET_NAMES = new Set([
  "Spec",
  "Metadata",
  "SelectedFeatures",
  "Program",
  "Currency",
  "AwardRule",
  "ExpiryRule",
  "PendingRule",
  "EventType",
  "SignupBonus",
  "BirthdayBonus",
  "TestCustomer",
  "Tiers",
  "Badges",
  "Promotions",
]);

const EXAMPLE_VALUES: Record<string, string> = {
  "spec.schemaVersion": "program-spec.v1",
  "spec.autoAwardBaseTier": "true",
  "spec.existingCurrencyCode": "legacy-points",
  "spec.existingCurrencyId": "11111111-1111-1111-1111-111111111111",

  "selectedFeatures.programCurrency": "true",
  "selectedFeatures.expiry": "false",
  "selectedFeatures.pending": "false",
  "selectedFeatures.tiers": "true",
  "selectedFeatures.badges": "true",
  "selectedFeatures.programType": "transactional",
  "selectedFeatures.signupBonus": "false",
  "selectedFeatures.birthdayBonus": "true",

  "program.code": "coffee-loyalty",
  "program.name": "Coffee Loyalty",
  "program.typeCode": "retail",
  "program.typeName": "Retail",
  "program.description.en": "Earn points on every coffee purchase",

  "currency.code": "bean",
  "currency.name": "Bean",
  "currency.currencyTypeCode": "points",
  "currency.currencyTypeName": "Points",

  "awardRule.templateId": "points-per-dollar",
  "awardRule.rulePayload.code": "earn-rule",
  "awardRule.rulePayload.name": "Earn Rule",
  "awardRule.templateConfig.pointsPerDollar": "1",

  "expiryRule.type": "FIXED_PERIOD",
  "expiryRule.expiryPeriod": "MONTHS",
  "expiryRule.expiryPeriodValue": "12",
  "expiryRule.expiryDate": "2026-12-31",

  "pendingRule.type": "FIXED_PERIOD",
  "pendingRule.pendingPeriod": "DAYS",
  "pendingRule.pendingPeriodValue": "7",
  "pendingRule.pendingDate": "2026-12-31",

  "eventType.code": "purchase",
  "eventType.name": "Purchase",
  "eventType.description": "A customer purchase event",

  "signupBonus.bonusPoints": "100",
  "birthdayBonus.bonusPoints": "100",

  "testCustomer.email": "qa@example.com",
  "testCustomer.firstName": "QA",
  "testCustomer.lastName": "Tester",
  "testCustomer.externalId": "qa-1",
};

export const excelFormat: DocumentFormat = {
  id: "excel",
  fileExtensions: [".xlsx"],
  mimeTypes: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
  parse: parseImpl,
  render: renderImpl,
};

// ====================================================================
// Zip-bomb pre-flight
// ====================================================================

const ZIP_BOMB_MAX_UNCOMPRESSED_BYTES = 50 * 1024 * 1024;
const EOCD_SIGNATURE = 0x06054b50;
const CD_FILE_HEADER_SIGNATURE = 0x02014b50;
const EOCD_MIN_SIZE = 22;
const EOCD_MAX_COMMENT = 0xffff;

/**
 * Walks the zip Central Directory to sum uncompressed sizes BEFORE handing
 * the buffer to ExcelJS. A 50-byte compressed entry that decompresses to
 * 1 GB would otherwise OOM the Node process during `xlsx.load`.
 *
 * Cap: 50 MB total uncompressed. Realistic templates (100 tiers + 50 badges)
 * weigh ~200 KB uncompressed, so 50 MB is 250× headroom while still
 * rejecting a 25:1 bomb on a 2 MB upload.
 *
 * If the buffer doesn't look like a zip (no EOCD, truncated CD, etc.) the
 * guard returns silently and lets ExcelJS surface its own error.
 */
function assertSafeZipSize(buffer: Uint8Array): void {
  if (buffer.length < EOCD_MIN_SIZE) return;
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);

  // EOCD lives in the last 22 + comment_length bytes. Scan backwards from
  // a reasonable bound (max comment is 65535 bytes per the spec). Per
  // APPNOTE 6.3.6, the LAST EOCD signature in the buffer is the real one.
  const scanFloor = Math.max(0, buffer.length - EOCD_MIN_SIZE - EOCD_MAX_COMMENT);
  let eocdOffset = -1;
  for (let i = buffer.length - EOCD_MIN_SIZE; i >= scanFloor; i--) {
    if (view.getUint32(i, true) === EOCD_SIGNATURE) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset === -1) return;

  // Reject ALL zip64 sentinels in the EOCD (APPNOTE 6.3.6 §4.4.21–24):
  //   - entries-on-disk == 0xFFFF or total-entries == 0xFFFF (16-bit overflow)
  //   - cdSize == 0xFFFFFFFF or cdOffset == 0xFFFFFFFF (32-bit overflow)
  // Any of these means the real value lives in the Zip64 EOCD Locator,
  // pointing at potentially-huge CD entries. ExcelJS/yauzl follow the
  // locator and would OOM. Without this check, an attacker can plant
  // cdOffset = 0xFFFFFFFF so our cursor reads OOB and silently returns —
  // the cap check is skipped while ExcelJS still walks the real CD.
  const entriesOnDisk = view.getUint16(eocdOffset + 8, true);
  const totalEntries = view.getUint16(eocdOffset + 10, true);
  const cdSize = view.getUint32(eocdOffset + 12, true);
  const cdOffset = view.getUint32(eocdOffset + 16, true);
  if (
    entriesOnDisk === 0xffff ||
    totalEntries === 0xffff ||
    cdSize === 0xffffffff ||
    cdOffset === 0xffffffff
  ) {
    throw new TableShapeError(
      `Excel file uses zip64 format. Template uploads must use standard ZIP archives (max ${ZIP_BOMB_MAX_UNCOMPRESSED_BYTES / 1024 / 1024} MB uncompressed).`,
      { field: "file" }
    );
  }
  // Reject on count disagreement between "entries on this disk" (+8) and
  // "total entries" (+10). Single-disk archives (every legitimate xlsx)
  // always have these equal; disagreement signals a crafted header where
  // an attacker has hidden entries from one reader while another reader
  // (e.g. ExcelJS) walks all of them.
  if (entriesOnDisk !== totalEntries) {
    throw new TableShapeError(
      `Excel file has inconsistent ZIP entry counts (entries-on-disk=${entriesOnDisk}, total-entries=${totalEntries}). Templates must come from single-disk archives.`,
      { field: "file" }
    );
  }
  const cdEntryCount = totalEntries;

  let totalUncompressed = 0;
  let cursor = cdOffset;
  for (let i = 0; i < cdEntryCount; i++) {
    if (cursor + 46 > buffer.length) return;
    if (view.getUint32(cursor, true) !== CD_FILE_HEADER_SIGNATURE) return;
    const compressedSize = view.getUint32(cursor + 20, true);
    const uncompressedSize = view.getUint32(cursor + 24, true);
    const localHeaderOffset = view.getUint32(cursor + 42, true);
    // Reject ALL zip64 sentinels (APPNOTE 6.3.6 §4.5.3) — any of these
    // fields == 0xFFFFFFFF means the real value lives in a zip64 extra
    // field where it could be 2^64 - 1. Legitimate templates never need
    // zip64; we'd rather reject upfront than hand the archive to ExcelJS
    // which would honor the zip64 extra and OOM.
    if (
      compressedSize === 0xffffffff ||
      uncompressedSize === 0xffffffff ||
      localHeaderOffset === 0xffffffff
    ) {
      throw new TableShapeError(
        `Excel file uses zip64 markers. Template uploads must fit within ${ZIP_BOMB_MAX_UNCOMPRESSED_BYTES / 1024 / 1024} MB uncompressed.`,
        { field: "file" }
      );
    }
    totalUncompressed += uncompressedSize;
    if (totalUncompressed > ZIP_BOMB_MAX_UNCOMPRESSED_BYTES) {
      throw new TableShapeError(
        `Excel file exceeds the ${ZIP_BOMB_MAX_UNCOMPRESSED_BYTES / 1024 / 1024} MB uncompressed size limit.`,
        { field: "file" }
      );
    }
    const nameLen = view.getUint16(cursor + 28, true);
    const extraLen = view.getUint16(cursor + 30, true);
    const commentLen = view.getUint16(cursor + 32, true);
    cursor += 46 + nameLen + extraLen + commentLen;
  }
}

async function parseImpl(buffer: Uint8Array, _opts: ParseOptions = {}): Promise<ParseResult> {
  assertSafeZipSize(buffer);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(
    Buffer.from(buffer) as unknown as Parameters<typeof workbook.xlsx.load>[0]
  );

  const specSheet = workbook.getWorksheet("Spec");
  if (!specSheet) {
    // Pre-M3c workbooks named the singletons sheet "Metadata" with a
    // key/value/example header. Detect that shape and surface a clear
    // migration message instead of the generic "file is empty" error.
    const legacyMeta = workbook.getWorksheet("Metadata");
    if (legacyMeta) {
      const h0 = legacyMeta.getRow(1).getCell(1).text.trim();
      if (h0 === "key") {
        throw new TemplateParseError(
          "LEGACY_SPEC_LAYOUT",
          "Workbook uses the pre-M3c sheet layout. Rename the existing 'Metadata' sheet (key/value) to 'Spec', and add a new 'Metadata' sheet (row-based with columns: category, typeCode, code, name, description) for metadata records.",
          { field: "spec" }
        );
      }
    }
    throw new EmptyUploadError();
  }

  const warnings: Warning[] = [];
  const pushWarning = (w: Warning): void => {
    if (warnings.length < MAX_WARNINGS) warnings.push(w);
  };

  const specRows = readKeyValueSheet(specSheet, "Spec", pushWarning);
  assertSchemaVersion(specRows["schemaVersion"]);

  const sf = workbook.getWorksheet("SelectedFeatures");
  if (!sf) {
    throw new TableShapeError('Required sheet "SelectedFeatures" is missing', {
      field: "selectedFeatures",
    });
  }
  const program = workbook.getWorksheet("Program");
  if (!program) {
    throw new TableShapeError('Required sheet "Program" is missing', { field: "program" });
  }
  const award = workbook.getWorksheet("AwardRule");
  if (!award) {
    throw new TableShapeError('Required sheet "AwardRule" is missing', { field: "awardRule" });
  }

  const partial: DeepPartial<ProgramSpec> = { tiers: [], badges: [] };

  applySpecRows(partial, specRows);
  applySelectedFeaturesRows(partial, readKeyValueSheet(sf, "SelectedFeatures", pushWarning));
  applyProgramRows(partial, readKeyValueSheet(program, "Program", pushWarning), pushWarning);

  const currency = workbook.getWorksheet("Currency");
  if (currency) applyCurrencyRows(partial, readKeyValueSheet(currency, "Currency", pushWarning));

  applyAwardRuleRows(partial, readKeyValueSheet(award, "AwardRule", pushWarning));

  const expiry = workbook.getWorksheet("ExpiryRule");
  if (expiry) applyExpiryRuleRows(partial, readKeyValueSheet(expiry, "ExpiryRule", pushWarning));

  const pending = workbook.getWorksheet("PendingRule");
  if (pending)
    applyPendingRuleRows(partial, readKeyValueSheet(pending, "PendingRule", pushWarning));

  const eventType = workbook.getWorksheet("EventType");
  if (eventType) applyEventTypeSheet(partial, eventType);

  const signup = workbook.getWorksheet("SignupBonus");
  if (signup)
    applyBonusRows(
      partial,
      "signupBonusConfig",
      readKeyValueSheet(signup, "SignupBonus", pushWarning)
    );

  const birthday = workbook.getWorksheet("BirthdayBonus");
  if (birthday) {
    applyBonusRows(
      partial,
      "birthdayBonusConfig",
      readKeyValueSheet(birthday, "BirthdayBonus", pushWarning)
    );
  }

  const testCustomer = workbook.getWorksheet("TestCustomer");
  if (testCustomer)
    applyTestCustomerRows(partial, readKeyValueSheet(testCustomer, "TestCustomer", pushWarning));

  const pendingExtractions: FreeformExtractionRequest[] = [];
  const pushExtraction = (req: FreeformExtractionRequest): void => {
    if (pendingExtractions.length >= MAX_FREEFORM_SECTIONS) {
      pushWarning({
        code: "freeform-over-cap",
        message: `Too many freeform sections; ignored sections past ${MAX_FREEFORM_SECTIONS}.`,
        field: "freeform",
      });
      return;
    }
    pendingExtractions.push(req);
  };

  const tiersSheet = workbook.getWorksheet("Tiers");
  let tierLines: number[] = [];
  if (tiersSheet) {
    const parsed = parseTiersSheet(tiersSheet, pushWarning, pushExtraction);
    partial.tiers = parsed.tiers;
    tierLines = parsed.lines;
  }

  const badgesSheet = workbook.getWorksheet("Badges");
  let badgeLines: number[] = [];
  if (badgesSheet) {
    const parsed = parseBadgesSheet(badgesSheet, pushWarning);
    partial.badges = parsed.badges;
    badgeLines = parsed.lines;
  }

  const promotionsSheet = workbook.getWorksheet("Promotions");
  if (promotionsSheet) {
    parsePromotionsSheet(promotionsSheet, pushWarning, pushExtraction);
  }
  partial.promotions = [];

  const metadataSheet = workbook.getWorksheet("Metadata");
  if (metadataSheet) {
    const parsed = parseMetadataSheet(metadataSheet, pushWarning);
    partial.metadata = parsed.metadata;
  }

  workbook.eachSheet((sheet) => {
    if (!KNOWN_SHEET_NAMES.has(sheet.name)) {
      pushWarning({
        code: "unknown-section",
        message: `Unknown sheet "${sheet.name}" — ignored.`,
      });
    }
  });

  assertUniqueCodes(
    "tier",
    (partial.tiers ?? []).map((t, i) => ({ code: (t?.code ?? "") as string, line: tierLines[i] }))
  );
  assertUniqueCodes(
    "badge",
    (partial.badges ?? []).map((b, i) => ({
      code: (b?.code ?? "") as string,
      line: badgeLines[i],
    }))
  );

  sortTiersWithWarning(partial.tiers as WizardTier[] | undefined, pushWarning);

  if ((partial.tiers?.length ?? 0) > MAX_TIERS_PER_PROGRAM) {
    pushWarning({
      code: "tiers-over-cap",
      message: `Template declares ${partial.tiers?.length} tiers; at most ${MAX_TIERS_PER_PROGRAM} are allowed.`,
      field: "tiers",
    });
  }
  if ((partial.badges?.length ?? 0) > MAX_BADGES_PER_PROGRAM) {
    pushWarning({
      code: "badges-over-cap",
      message: `Template declares ${partial.badges?.length} badges; at most ${MAX_BADGES_PER_PROGRAM} are allowed.`,
      field: "badges",
    });
  }
  if ((partial.metadata?.length ?? 0) > MAX_METADATA_RECORDS_PER_PROGRAM) {
    pushWarning({
      code: "metadata-over-cap",
      message: `Template declares ${partial.metadata?.length} metadata rows; at most ${MAX_METADATA_RECORDS_PER_PROGRAM} are allowed.`,
      field: "metadata",
    });
  }

  checkMetadataConsistency(partial, pushWarning);

  for (const v of runLinter(partial)) pushWarning(v);

  return { partial, pendingExtractions, warnings };
}

async function renderImpl(spec: ProgramSpec, opts: RenderOptions = {}): Promise<RenderResult> {
  const wb = new ExcelJS.Workbook();
  const includeSamples = opts.includeSampleData ?? false;

  writeSpecSheet(wb, spec);
  writeSelectedFeaturesSheet(wb, spec);
  writeProgramSheet(wb, spec, includeSamples);

  if (spec.currency) writeCurrencySheet(wb, spec.currency);
  else if (includeSamples) writeCurrencySheet(wb, undefined);

  writeAwardRuleSheet(wb, spec.awardRule);

  if (spec.expiryRule) writeExpiryRuleSheet(wb, spec.expiryRule);
  else if (includeSamples) writeExpiryRuleSheet(wb, undefined);

  if (spec.pendingRule) writePendingRuleSheet(wb, spec.pendingRule);
  else if (includeSamples) writePendingRuleSheet(wb, undefined);

  if (spec.eventType) writeEventTypeSheet(wb, spec.eventType);
  else if (includeSamples) writeEventTypeSheet(wb, undefined);

  if (spec.signupBonusConfig) writeBonusSheet(wb, "SignupBonus", spec.signupBonusConfig);
  else if (includeSamples) writeBonusSheet(wb, "SignupBonus", undefined);

  if (spec.birthdayBonusConfig) writeBonusSheet(wb, "BirthdayBonus", spec.birthdayBonusConfig);
  else if (includeSamples) writeBonusSheet(wb, "BirthdayBonus", undefined);

  if (spec.testCustomer) writeTestCustomerSheet(wb, spec.testCustomer);
  else if (includeSamples) writeTestCustomerSheet(wb, undefined);

  if (spec.tiers.length > 0 || includeSamples) {
    writeTiersSheet(wb, spec.tiers, includeSamples);
  }
  if (spec.badges.length > 0 || includeSamples) {
    writeBadgesSheet(wb, spec.badges, includeSamples);
  }
  if ((spec.promotions?.length ?? 0) > 0) {
    writePromotionsSheet(wb, spec.promotions);
  }
  if ((spec.metadata?.length ?? 0) > 0) {
    writeMetadataSheet(wb, spec.metadata);
  }

  const buffer = await wb.xlsx.writeBuffer();
  return { buffer: new Uint8Array(buffer), warnings: [] };
}

interface KeyValueRows {
  [key: string]: string;
}

function readKeyValueSheet(
  sheet: ExcelJS.Worksheet,
  sheetName: string,
  pushWarning?: (w: Warning) => void
): KeyValueRows {
  detectMergedHeader(sheet, sheetName);
  const headerRow = sheet.getRow(1);
  const headers: string[] = [];
  for (let i = 1; i <= 3; i++) headers.push(headerRow.getCell(i).text);
  if (headers[0] !== "key" || headers[1] !== "value") {
    throw new TableShapeError(`Sheet "${sheetName}" must have header "key | value | example"`, {
      field: sheetName.toLowerCase(),
    });
  }
  const out: KeyValueRows = {};
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    if (rowNumber > MAX_TABLE_ROWS + 1) return;
    const key = row.getCell(1).text.trim();
    if (key === "") return;
    if (Object.prototype.hasOwnProperty.call(out, key) && pushWarning) {
      pushWarning({
        code: "duplicate-key",
        message: `Sheet "${sheetName}" has duplicate key "${key}" — using the last value.`,
        line: rowNumber,
        field: `${sheetName.toLowerCase()}.${key}`,
      });
    }
    out[key] = readCellValue(row.getCell(2));
  });
  return out;
}

function readCellValue(cell: ExcelJS.Cell): string {
  const v = cell.value;
  if (v && typeof v === "object" && "formula" in v) {
    const result = (v as { result?: unknown }).result;
    return result === undefined || result === null ? "" : String(result);
  }
  return cell.text.trim();
}

function detectMergedHeader(sheet: ExcelJS.Worksheet, sheetName: string): void {
  if (!sheet.hasMerges) return;
  const merges = sheet.model.merges ?? [];
  for (const range of merges) {
    if (typeof range !== "string") continue;
    const headerInRange = /^[A-Z]+1(?::[A-Z]+1)?$/.exec(range);
    if (headerInRange) {
      throw new TableShapeError(`Sheet "${sheetName}" has merged cells in the header row`, {
        field: sheetName.toLowerCase(),
      });
    }
  }
}

function applySpecRows(partial: DeepPartial<ProgramSpec>, rows: KeyValueRows): void {
  if (rows["autoAwardBaseTier"] !== undefined) {
    partial.autoAwardBaseTier = parseBoolean(rows["autoAwardBaseTier"]);
  }
  if (rows["existingCurrencyCode"]) partial.existingCurrencyCode = rows["existingCurrencyCode"];
  if (rows["existingCurrencyId"]) partial.existingCurrencyId = rows["existingCurrencyId"];
}

function applySelectedFeaturesRows(partial: DeepPartial<ProgramSpec>, rows: KeyValueRows): void {
  const sf: Record<string, unknown> = {};
  for (const k of [
    "programCurrency",
    "expiry",
    "pending",
    "tiers",
    "badges",
    "signupBonus",
    "birthdayBonus",
  ]) {
    if (rows[k] !== undefined) sf[k] = parseBoolean(rows[k]);
  }
  if (rows["programType"]) sf["programType"] = rows["programType"];
  partial.selectedFeatures = sf as DeepPartial<ProgramSpec>["selectedFeatures"];
}

const LOCALE_PATTERN = /^[a-z]{2,3}(-[A-Za-z]{2,4})?$/;

function applyProgramRows(
  partial: DeepPartial<ProgramSpec>,
  rows: KeyValueRows,
  pushWarning?: (w: Warning) => void
): void {
  const program: Record<string, unknown> = {};
  for (const k of ["code", "name", "typeCode", "typeName"]) {
    if (rows[k]) program[k] = rows[k];
  }
  for (const key of Object.keys(rows)) {
    if (key.startsWith("description.")) {
      const raw = rows[key];
      if (raw === undefined || raw === "") continue;
      const locale = key.slice("description.".length);
      if (!LOCALE_PATTERN.test(locale)) {
        if (pushWarning) {
          pushWarning({
            code: "invalid-locale",
            message: `Program sheet has invalid locale key "${key}" — expected BCP-47 format like "en" or "en-US".`,
            field: `program.${key}`,
          });
        }
        continue;
      }
      const desc = (program["description"] as Record<string, string> | undefined) ?? {};
      desc[locale] = raw;
      program["description"] = desc;
    }
  }
  if ("description" in rows && rows["description"] && pushWarning) {
    pushWarning({
      code: "bare-description",
      message:
        'Program sheet has a "description" row without a locale suffix — use "description.en" (or another BCP-47 locale).',
      field: "program.description",
    });
  }
  partial.program = program as DeepPartial<ProgramSpec>["program"];
}

function applyCurrencyRows(partial: DeepPartial<ProgramSpec>, rows: KeyValueRows): void {
  const currency: Record<string, unknown> = {};
  for (const k of ["code", "name", "currencyTypeCode", "currencyTypeName"]) {
    if (rows[k]) currency[k] = rows[k];
  }
  partial.currency = currency as DeepPartial<ProgramSpec>["currency"];
}

function applyAwardRuleRows(partial: DeepPartial<ProgramSpec>, rows: KeyValueRows): void {
  const award: {
    templateId?: string;
    templateConfig: Record<string, unknown>;
    rulePayload: Record<string, unknown>;
  } = {
    templateConfig: {},
    rulePayload: {},
  };
  if (rows["templateId"]) award.templateId = rows["templateId"];
  for (const key of Object.keys(rows)) {
    const raw = rows[key];
    if (raw === undefined || raw === "") continue;
    if (key.startsWith("templateConfig.")) {
      const k = key.slice("templateConfig.".length);
      award.templateConfig[k] = jsonCoerce(raw);
    } else if (key.startsWith("rulePayload.")) {
      const k = key.slice("rulePayload.".length);
      award.rulePayload[k] = jsonCoerce(raw);
    }
  }
  partial.awardRule = award as DeepPartial<ProgramSpec>["awardRule"];
}

function applyExpiryRuleRows(partial: DeepPartial<ProgramSpec>, rows: KeyValueRows): void {
  const r: Record<string, unknown> = {};
  if (rows["type"]) r["type"] = rows["type"];
  if (rows["expiryPeriod"]) r["expiryPeriod"] = rows["expiryPeriod"];
  if (rows["expiryPeriodValue"]) {
    const n = Number(rows["expiryPeriodValue"]);
    if (Number.isNaN(n)) {
      throw new TableShapeError(
        `ExpiryRule has non-numeric expiryPeriodValue "${rows["expiryPeriodValue"]}"`,
        { field: "expiryRule.expiryPeriodValue" }
      );
    }
    r["expiryPeriodValue"] = n;
  }
  if (rows["expiryDate"]) r["expiryDate"] = rows["expiryDate"];
  partial.expiryRule = r as DeepPartial<ProgramSpec>["expiryRule"];
}

function applyPendingRuleRows(partial: DeepPartial<ProgramSpec>, rows: KeyValueRows): void {
  const r: Record<string, unknown> = {};
  if (rows["type"]) r["type"] = rows["type"];
  if (rows["pendingPeriod"]) r["pendingPeriod"] = rows["pendingPeriod"];
  if (rows["pendingPeriodValue"]) {
    const n = Number(rows["pendingPeriodValue"]);
    if (Number.isNaN(n)) {
      throw new TableShapeError(
        `PendingRule has non-numeric pendingPeriodValue "${rows["pendingPeriodValue"]}"`,
        { field: "pendingRule.pendingPeriodValue" }
      );
    }
    r["pendingPeriodValue"] = n;
  }
  if (rows["pendingDate"]) r["pendingDate"] = rows["pendingDate"];
  partial.pendingRule = r as DeepPartial<ProgramSpec>["pendingRule"];
}

function applyEventTypeSheet(partial: DeepPartial<ProgramSpec>, sheet: ExcelJS.Worksheet): void {
  detectMergedHeader(sheet, "EventType");
  const headerRow = sheet.getRow(1);
  const h0 = headerRow.getCell(1).text.trim();
  if (h0 !== "key") {
    throw new TableShapeError('EventType sheet must start with header "key | value | example"', {
      field: "eventType",
    });
  }
  const rows: KeyValueRows = {};
  let dataFieldsStart = -1;
  let dataFieldHeaders: string[] = [];
  const dataFieldRows: Array<{ name: string; type: string; required: string }> = [];

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const key = row.getCell(1).text.trim();

    if (key === DATA_FIELDS_MARKER) {
      dataFieldsStart = rowNumber + 1;
      return;
    }
    if (dataFieldsStart === -1) {
      if (key === "") return;
      rows[key] = readCellValue(row.getCell(2));
      return;
    }

    if (rowNumber === dataFieldsStart) {
      if (key === "") {
        throw new TableShapeError(
          'EventType dataFields header row missing — expected "name | type | required" directly after the dataFields marker',
          { field: "eventType.dataFields", line: rowNumber }
        );
      }
      dataFieldHeaders = [
        row.getCell(1).text.trim(),
        row.getCell(2).text.trim(),
        row.getCell(3).text.trim(),
      ];
      for (const required of DATA_FIELDS_COLUMNS) {
        if (!dataFieldHeaders.includes(required)) {
          throw new TableShapeError(
            `EventType dataFields sub-table missing required column "${required}"`,
            { field: "eventType.dataFields" }
          );
        }
      }
      return;
    }

    if (key === "") return;
    const nameIdx = dataFieldHeaders.indexOf("name") + 1;
    const typeIdx = dataFieldHeaders.indexOf("type") + 1;
    const reqIdx = dataFieldHeaders.indexOf("required") + 1;
    const name = row.getCell(nameIdx).text.trim();
    if (name === "") return;
    dataFieldRows.push({
      name,
      type: row.getCell(typeIdx).text.trim(),
      required: readCellValue(row.getCell(reqIdx)),
    });
  });

  const eventType: Record<string, unknown> = {};
  if (rows["code"]) eventType["code"] = rows["code"];
  if (rows["name"]) eventType["name"] = rows["name"];
  if (rows["description"]) eventType["description"] = rows["description"];
  eventType["dataFields"] = dataFieldRows.map((r) => ({
    name: r.name,
    type: r.type,
    required: parseBoolean(r.required),
  }));
  partial.eventType = eventType as DeepPartial<ProgramSpec>["eventType"];
}

function applyBonusRows(
  partial: DeepPartial<ProgramSpec>,
  field: "signupBonusConfig" | "birthdayBonusConfig",
  rows: KeyValueRows
): void {
  if (rows["bonusPoints"]) {
    const n = Number(rows["bonusPoints"]);
    if (Number.isNaN(n)) {
      const sheetField =
        field === "signupBonusConfig" ? "signupBonus.bonusPoints" : "birthdayBonus.bonusPoints";
      throw new TableShapeError(
        `${field === "signupBonusConfig" ? "SignupBonus" : "BirthdayBonus"} has non-numeric bonusPoints "${rows["bonusPoints"]}"`,
        { field: sheetField }
      );
    }
    setAtPath(partial as object, `${field}.bonusPoints`, n);
  }
}

function applyTestCustomerRows(partial: DeepPartial<ProgramSpec>, rows: KeyValueRows): void {
  const r: Record<string, unknown> = {};
  for (const k of ["email", "firstName", "lastName", "externalId"]) {
    if (rows[k]) r[k] = rows[k];
  }
  partial.testCustomer = r as DeepPartial<ProgramSpec>["testCustomer"];
}

function parseTiersSheet(
  sheet: ExcelJS.Worksheet,
  pushWarning: (w: Warning) => void,
  pushExtraction: (req: FreeformExtractionRequest) => void
): { tiers: WizardTier[]; lines: number[] } {
  detectMergedHeader(sheet, "Tiers");
  const headerRow = sheet.getRow(1);
  const headers: string[] = [];
  for (let i = 1; i <= headerRow.cellCount; i++) headers.push(headerRow.getCell(i).text.trim());

  for (const required of TIER_REQUIRED_COLUMNS) {
    if (!headers.includes(required)) {
      throw new TableShapeError(`Tiers sheet missing required column "${required}"`, {
        field: `tiers[].${required}`,
      });
    }
  }
  const known = new Set<string>([...TIER_REQUIRED_COLUMNS, ...TIER_OPTIONAL_COLUMNS]);
  for (const h of headers) {
    if (h && !known.has(h)) {
      pushWarning({
        code: "unknown-column",
        message: `Tiers sheet has unknown column "${h}" — values will be ignored.`,
        field: `tiers[].${h}`,
      });
    }
  }

  const codeCol = headers.indexOf("code") + 1;
  const nameCol = headers.indexOf("name") + 1;
  const ptCol = headers.indexOf("pointsThreshold") + 1;
  const bonusCol = headers.indexOf("bonus") + 1;
  const cttCol = headers.indexOf("counterTargetTypeCode") + 1;
  const descCol = headers.indexOf("description") + 1;

  const tiers: WizardTier[] = [];
  const lines: number[] = [];
  let formulaSeen = false;
  let tierIndex = 0;
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    if (rowNumber > MAX_TABLE_ROWS + 1) {
      throw new TableShapeError(`Tiers sheet has more than ${MAX_TABLE_ROWS} rows`, {
        line: rowNumber,
        field: "tiers",
      });
    }
    const code = row.getCell(codeCol).text.trim();
    const name = row.getCell(nameCol).text.trim();
    if (code === "" && name === "") return;
    if (code === "") {
      throw new TableShapeError("Tiers row has empty code", {
        line: rowNumber,
        field: "tiers[].code",
      });
    }
    if (name === "") {
      throw new TableShapeError(`Tiers row has empty name for code "${code}"`, {
        line: rowNumber,
        field: "tiers[].name",
      });
    }
    const ptCell = row.getCell(ptCol);
    const cellValue = ptCell.value;
    if (cellValue && typeof cellValue === "object" && "formula" in cellValue) {
      formulaSeen = true;
    }
    const ptText = readCellValue(ptCell);
    const numericThreshold = parseExcelIntegerCell(ptText);
    const tier: WizardTier = {
      code,
      name,
      pointsThreshold: numericThreshold ?? 0,
    };
    if (numericThreshold === null && ptText !== "") {
      pushExtraction({
        expectedField: `tiers[${tierIndex}].pointsThreshold`,
        sectionContent: ptText,
        sourceLocation: { line: rowNumber, col: ptCol },
      });
    }
    if (bonusCol > 0) {
      const bonusText = readCellValue(row.getCell(bonusCol));
      if (bonusText !== "") {
        const numericBonus = parseExcelMultiplierCell(bonusText);
        if (numericBonus !== null) {
          tier.earnMultiplier = numericBonus;
        } else {
          pushExtraction({
            expectedField: `tiers[${tierIndex}].earnMultiplier`,
            sectionContent: bonusText,
            sourceLocation: { line: rowNumber, col: bonusCol },
          });
        }
      }
    }
    if (cttCol > 0) {
      const ctt = row.getCell(cttCol).text.trim();
      if (ctt) tier.counterTargetTypeCode = ctt;
    }
    if (descCol > 0) {
      const desc = row.getCell(descCol).text.trim();
      if (desc) tier.description = desc;
    }
    tiers.push(tier);
    lines.push(rowNumber);
    tierIndex++;
  });
  if (formulaSeen) {
    pushWarning({
      code: "formula-cell",
      message: "Tiers sheet contains formula cells; using cached results.",
      field: "tiers",
    });
  }
  return { tiers, lines };
}

function parsePromotionsSheet(
  sheet: ExcelJS.Worksheet,
  pushWarning: (w: Warning) => void,
  pushExtraction: (req: FreeformExtractionRequest) => void
): void {
  detectMergedHeader(sheet, "Promotions");
  const headerRow = sheet.getRow(1);
  const headers: string[] = [];
  for (let i = 1; i <= headerRow.cellCount; i++) headers.push(headerRow.getCell(i).text.trim());

  for (const required of PROMOTION_REQUIRED_COLUMNS) {
    if (!headers.includes(required)) {
      throw new TableShapeError(`Promotions sheet missing required column "${required}"`, {
        field: `promotions[].${required}`,
      });
    }
  }
  const known = new Set<string>([...PROMOTION_REQUIRED_COLUMNS, ...PROMOTION_OPTIONAL_COLUMNS]);
  for (const h of headers) {
    if (h && !known.has(h)) {
      pushWarning({
        code: "unknown-column",
        message: `Promotions sheet has unknown column "${h}" — values will be ignored.`,
        field: `promotions[].${h}`,
      });
    }
  }

  const nameCol = headers.indexOf("name") + 1;
  const descCol = headers.indexOf("description") + 1;
  let promotionIndex = 0;
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    if (rowNumber > MAX_TABLE_ROWS + 1) {
      throw new TableShapeError(`Promotions sheet has more than ${MAX_TABLE_ROWS} rows`, {
        line: rowNumber,
        field: "promotions",
      });
    }
    const name = readCellValue(row.getCell(nameCol));
    const description = readCellValue(row.getCell(descCol));
    if (name === "" && description === "") return;
    if (name === "") {
      throw new TableShapeError("Promotions row has empty name", {
        line: rowNumber,
        field: "promotions[].name",
      });
    }
    if (description === "") {
      throw new TableShapeError(`Promotions row has empty description for "${name}"`, {
        line: rowNumber,
        field: "promotions[].description",
      });
    }
    pushExtraction({
      expectedField: `promotions[${promotionIndex}]`,
      sectionContent: `${name} — ${description}`,
      sourceLocation: { line: rowNumber, col: nameCol },
    });
    promotionIndex++;
  });
}

/**
 * Excel multiplier cell — `1.7x`, `1.2`, `2`. Strips commas and the
 * trailing `x` (case-insensitive). Mirror of `parseMultiplierCell` in
 * `markdown.ts` so xlsx and markdown round-trip identically.
 */
export function parseExcelMultiplierCell(s: string): number | null {
  if (s === "") return null;
  const trimmed = s.replace(/,/g, "").replace(/x$/i, "");
  if (!/^-?\d+(\.\d+)?$/.test(trimmed)) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

/**
 * Excel integer cell — `500`, `2,500`. Strips commas only. A trailing
 * `x` is preserved as part of the input so the cell routes to the LLM
 * as ambiguous prose rather than parsing as `500`. Mirror of
 * `parseIntegerCell` in `markdown.ts`.
 */
export function parseExcelIntegerCell(s: string): number | null {
  if (s === "") return null;
  const trimmed = s.replace(/,/g, "");
  // Strict integers only — mirrors `parseIntegerCell` in markdown.ts.
  // A cell like `100.5` is ambiguous prose for `pointsThreshold` (the
  // platform takes integer thresholds) and routes to the LLM extractor.
  if (!/^-?\d+$/.test(trimmed)) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

function parseBadgesSheet(
  sheet: ExcelJS.Worksheet,
  pushWarning: (w: Warning) => void
): { badges: WizardBadge[]; lines: number[] } {
  detectMergedHeader(sheet, "Badges");
  const headerRow = sheet.getRow(1);
  const headers: string[] = [];
  for (let i = 1; i <= headerRow.cellCount; i++) headers.push(headerRow.getCell(i).text.trim());

  for (const required of BADGE_REQUIRED_COLUMNS) {
    if (!headers.includes(required)) {
      throw new TableShapeError(`Badges sheet missing required column "${required}"`, {
        field: `badges[].${required}`,
      });
    }
  }
  const known = new Set<string>([...BADGE_REQUIRED_COLUMNS, ...BADGE_OPTIONAL_COLUMNS]);
  for (const h of headers) {
    if (h && !known.has(h)) {
      pushWarning({
        code: "unknown-column",
        message: `Badges sheet has unknown column "${h}" — values will be ignored.`,
        field: `badges[].${h}`,
      });
    }
  }
  const codeCol = headers.indexOf("code") + 1;
  const nameCol = headers.indexOf("name") + 1;
  const descCol = headers.indexOf("description") + 1;

  const badges: WizardBadge[] = [];
  const lines: number[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const code = row.getCell(codeCol).text.trim();
    const name = row.getCell(nameCol).text.trim();
    if (code === "" && name === "") return;
    if (code === "") {
      throw new TableShapeError("Badges row has empty code", {
        line: rowNumber,
        field: "badges[].code",
      });
    }
    if (name === "") {
      throw new TableShapeError(`Badges row has empty name for code "${code}"`, {
        line: rowNumber,
        field: "badges[].name",
      });
    }
    const badge: WizardBadge = { code, name };
    if (descCol > 0) {
      const desc = row.getCell(descCol).text.trim();
      if (desc) badge.description = desc;
    }
    badges.push(badge);
    lines.push(rowNumber);
  });
  return { badges, lines };
}

function parseMetadataSheet(
  sheet: ExcelJS.Worksheet,
  pushWarning: (w: Warning) => void
): { metadata: MetadataRecord[] } {
  detectMergedHeader(sheet, "Metadata");
  const headerRow = sheet.getRow(1);
  const headers: string[] = [];
  for (let i = 1; i <= headerRow.cellCount; i++) headers.push(headerRow.getCell(i).text.trim());

  for (const required of METADATA_REQUIRED_COLUMNS) {
    if (!headers.includes(required)) {
      throw new TableShapeError(`Metadata sheet missing required column "${required}"`, {
        field: `metadata[].${required}`,
      });
    }
  }
  const known = new Set<string>([...METADATA_REQUIRED_COLUMNS, ...METADATA_OPTIONAL_COLUMNS]);
  for (const h of headers) {
    if (h && !known.has(h)) {
      pushWarning({
        code: "unknown-column",
        message: `Metadata sheet has unknown column "${h}" — values will be ignored.`,
        field: `metadata[].${h}`,
      });
    }
  }

  const categoryCol = headers.indexOf("category") + 1;
  const typeCodeCol = headers.indexOf("typeCode") + 1;
  const codeCol = headers.indexOf("code") + 1;
  const nameCol = headers.indexOf("name") + 1;
  const descCol = headers.indexOf("description") + 1;

  const metadata: MetadataRecord[] = [];
  const seen = new Map<string, number>();
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    if (rowNumber > MAX_TABLE_ROWS + 1) {
      throw new TableShapeError(`Metadata sheet has more than ${MAX_TABLE_ROWS} rows`, {
        line: rowNumber,
        field: "metadata",
      });
    }
    const category = row.getCell(categoryCol).text.trim();
    const typeCode = row.getCell(typeCodeCol).text.trim();
    const name = row.getCell(nameCol).text.trim();
    if (category === "" && typeCode === "" && name === "") return;
    if (category === "") {
      throw new TableShapeError("Metadata row has empty category", {
        line: rowNumber,
        field: "metadata[].category",
      });
    }
    if (typeCode === "") {
      throw new TableShapeError("Metadata row has empty typeCode", {
        line: rowNumber,
        field: "metadata[].typeCode",
      });
    }
    if (name === "") {
      throw new TableShapeError(`Metadata row has empty name for typeCode "${typeCode}"`, {
        line: rowNumber,
        field: "metadata[].name",
      });
    }
    const code = codeCol > 0 ? row.getCell(codeCol).text.trim() : "";
    const description = descCol > 0 ? row.getCell(descCol).text.trim() : "";
    const record: MetadataRecord = { category, typeCode, name };
    if (code) record.code = code;
    if (description) record.description = description;

    const dupKey = `${typeCode}::${code}`;
    if (seen.has(dupKey)) {
      pushWarning({
        code: "duplicate-metadata",
        message: `Metadata row duplicates (typeCode "${typeCode}"${code ? `, code "${code}"` : ""}); both rows are kept and duplicate API calls are ignored downstream.`,
        line: rowNumber,
        field: "metadata",
      });
    }
    seen.set(dupKey, rowNumber);

    metadata.push(record);
  });
  return { metadata };
}

function writeSpecSheet(wb: ExcelJS.Workbook, spec: ProgramSpec): void {
  const sheet = wb.addWorksheet("Spec");
  writeSheetHeader(sheet);

  appendKeyRow(sheet, "schemaVersion", TEMPLATE_SCHEMA_VERSION, "spec.schemaVersion");

  appendOptional(
    sheet,
    "autoAwardBaseTier",
    spec.autoAwardBaseTier === undefined ? undefined : String(spec.autoAwardBaseTier),
    "spec.autoAwardBaseTier"
  );
  appendOptional(
    sheet,
    "existingCurrencyCode",
    spec.existingCurrencyCode,
    "spec.existingCurrencyCode"
  );
  appendOptional(sheet, "existingCurrencyId", spec.existingCurrencyId, "spec.existingCurrencyId");
}

function writeSelectedFeaturesSheet(wb: ExcelJS.Workbook, spec: ProgramSpec): void {
  const sheet = wb.addWorksheet("SelectedFeatures");
  writeSheetHeader(sheet);
  const f = spec.selectedFeatures;
  appendKeyRow(
    sheet,
    "programCurrency",
    String(f.programCurrency),
    "selectedFeatures.programCurrency"
  );
  appendKeyRow(sheet, "expiry", String(f.expiry), "selectedFeatures.expiry");
  appendKeyRow(sheet, "pending", String(f.pending), "selectedFeatures.pending");
  appendKeyRow(sheet, "tiers", String(f.tiers), "selectedFeatures.tiers");
  appendKeyRow(sheet, "badges", String(f.badges), "selectedFeatures.badges");
  appendKeyRow(sheet, "programType", f.programType, "selectedFeatures.programType");
  appendKeyRow(sheet, "signupBonus", String(f.signupBonus), "selectedFeatures.signupBonus");
  appendKeyRow(sheet, "birthdayBonus", String(f.birthdayBonus), "selectedFeatures.birthdayBonus");
}

function writeProgramSheet(wb: ExcelJS.Workbook, spec: ProgramSpec, includeSamples: boolean): void {
  const sheet = wb.addWorksheet("Program");
  writeSheetHeader(sheet);
  appendOptional(sheet, "code", spec.program.code, "program.code");
  appendOptional(sheet, "name", spec.program.name, "program.name");
  appendOptional(sheet, "typeCode", spec.program.typeCode, "program.typeCode");
  appendOptional(sheet, "typeName", spec.program.typeName, "program.typeName");
  if (spec.program.description) {
    for (const [locale, value] of Object.entries(spec.program.description)) {
      const key = `description.${locale}`;
      const example =
        EXAMPLE_VALUES[`program.${key}`] ?? EXAMPLE_VALUES["program.description.en"] ?? "";
      sheet.addRow([key, value, example]);
    }
  } else if (includeSamples) {
    sheet.addRow(["description.en", "", EXAMPLE_VALUES["program.description.en"] ?? ""]);
  }
}

function writeCurrencySheet(
  wb: ExcelJS.Workbook,
  currency: ProgramSpec["currency"] | undefined
): void {
  const sheet = wb.addWorksheet("Currency");
  writeSheetHeader(sheet);
  appendOptional(sheet, "code", currency?.code, "currency.code");
  appendOptional(sheet, "name", currency?.name, "currency.name");
  appendOptional(
    sheet,
    "currencyTypeCode",
    currency?.currencyTypeCode,
    "currency.currencyTypeCode"
  );
  appendOptional(
    sheet,
    "currencyTypeName",
    currency?.currencyTypeName,
    "currency.currencyTypeName"
  );
}

function writeAwardRuleSheet(wb: ExcelJS.Workbook, awardRule: ProgramSpec["awardRule"]): void {
  const sheet = wb.addWorksheet("AwardRule");
  writeSheetHeader(sheet);
  appendKeyRow(sheet, "templateId", awardRule.templateId, "awardRule.templateId");
  if (awardRule.rulePayload && typeof awardRule.rulePayload.code === "string") {
    appendKeyRow(
      sheet,
      "rulePayload.code",
      awardRule.rulePayload.code,
      "awardRule.rulePayload.code"
    );
  }
  if (awardRule.rulePayload && typeof awardRule.rulePayload.name === "string") {
    appendKeyRow(
      sheet,
      "rulePayload.name",
      awardRule.rulePayload.name,
      "awardRule.rulePayload.name"
    );
  }
  if (awardRule.templateConfig) {
    for (const [k, v] of Object.entries(awardRule.templateConfig)) {
      const key = `templateConfig.${k}`;
      const exampleKey = `awardRule.${key}`;
      const example = EXAMPLE_VALUES[exampleKey] ?? "";
      sheet.addRow([key, jsonStringify(v), example]);
    }
  }
}

function writeExpiryRuleSheet(
  wb: ExcelJS.Workbook,
  rule: ProgramSpec["expiryRule"] | undefined
): void {
  const sheet = wb.addWorksheet("ExpiryRule");
  writeSheetHeader(sheet);
  appendOptional(sheet, "type", rule?.type as string | undefined, "expiryRule.type");
  appendOptional(
    sheet,
    "expiryPeriod",
    rule?.expiryPeriod as string | undefined,
    "expiryRule.expiryPeriod"
  );
  appendOptional(
    sheet,
    "expiryPeriodValue",
    rule?.expiryPeriodValue === undefined ? undefined : String(rule.expiryPeriodValue),
    "expiryRule.expiryPeriodValue"
  );
  appendOptional(sheet, "expiryDate", rule?.expiryDate, "expiryRule.expiryDate");
}

function writePendingRuleSheet(
  wb: ExcelJS.Workbook,
  rule: ProgramSpec["pendingRule"] | undefined
): void {
  const sheet = wb.addWorksheet("PendingRule");
  writeSheetHeader(sheet);
  appendOptional(sheet, "type", rule?.type as string | undefined, "pendingRule.type");
  appendOptional(
    sheet,
    "pendingPeriod",
    rule?.pendingPeriod as string | undefined,
    "pendingRule.pendingPeriod"
  );
  appendOptional(
    sheet,
    "pendingPeriodValue",
    rule?.pendingPeriodValue === undefined ? undefined : String(rule.pendingPeriodValue),
    "pendingRule.pendingPeriodValue"
  );
  appendOptional(sheet, "pendingDate", rule?.pendingDate, "pendingRule.pendingDate");
}

function writeEventTypeSheet(
  wb: ExcelJS.Workbook,
  eventType: ProgramSpec["eventType"] | undefined
): void {
  const sheet = wb.addWorksheet("EventType");
  writeSheetHeader(sheet);
  appendOptional(sheet, "code", eventType?.code, "eventType.code");
  appendOptional(sheet, "name", eventType?.name, "eventType.name");
  appendOptional(sheet, "description", eventType?.description, "eventType.description");
  sheet.addRow([DATA_FIELDS_MARKER, "", ""]);
  sheet.addRow(["name", "type", "required"]);
  for (const f of eventType?.dataFields ?? []) {
    sheet.addRow([f.name, f.type, String(f.required)]);
  }
}

function writeBonusSheet(
  wb: ExcelJS.Workbook,
  name: "SignupBonus" | "BirthdayBonus",
  config: { bonusPoints: number } | undefined
): void {
  const sheet = wb.addWorksheet(name);
  writeSheetHeader(sheet);
  const exampleKey =
    name === "SignupBonus" ? "signupBonus.bonusPoints" : "birthdayBonus.bonusPoints";
  appendOptional(
    sheet,
    "bonusPoints",
    config === undefined ? undefined : String(config.bonusPoints),
    exampleKey
  );
}

function writeTestCustomerSheet(
  wb: ExcelJS.Workbook,
  tc: ProgramSpec["testCustomer"] | undefined
): void {
  const sheet = wb.addWorksheet("TestCustomer");
  writeSheetHeader(sheet);
  appendOptional(sheet, "email", tc?.email, "testCustomer.email");
  appendOptional(sheet, "firstName", tc?.firstName, "testCustomer.firstName");
  appendOptional(sheet, "lastName", tc?.lastName, "testCustomer.lastName");
  appendOptional(sheet, "externalId", tc?.externalId, "testCustomer.externalId");
}

function writeTiersSheet(wb: ExcelJS.Workbook, tiers: WizardTier[], includeSamples: boolean): void {
  const sheet = wb.addWorksheet("Tiers");
  const hasBonus = tiers.some((t) => t.earnMultiplier !== undefined);
  const headers = ["code", "name", "pointsThreshold"];
  if (hasBonus || (tiers.length === 0 && includeSamples)) headers.push("bonus");
  headers.push("counterTargetTypeCode", "description");
  sheet.addRow(headers);
  const rows =
    tiers.length === 0 && includeSamples
      ? [
          {
            code: "bronze",
            name: "Bronze",
            pointsThreshold: 0,
            bonus: "",
            counterTargetTypeCode: "",
            description: "",
          },
          {
            code: "silver",
            name: "Silver",
            pointsThreshold: 500,
            bonus: "",
            counterTargetTypeCode: "",
            description: "",
          },
        ]
      : tiers.map((t) => ({
          code: t.code,
          name: t.name,
          pointsThreshold: t.pointsThreshold,
          bonus: t.earnMultiplier !== undefined ? String(t.earnMultiplier) : "",
          counterTargetTypeCode: t.counterTargetTypeCode ?? "",
          description: t.description ?? "",
        }));
  for (const r of rows) {
    const cells: Array<string | number> = [r.code, r.name, r.pointsThreshold];
    if (hasBonus || (tiers.length === 0 && includeSamples)) cells.push(r.bonus);
    cells.push(r.counterTargetTypeCode, r.description);
    sheet.addRow(cells);
  }
}

function writePromotionsSheet(wb: ExcelJS.Workbook, promotions: WizardPromotion[]): void {
  const sheet = wb.addWorksheet("Promotions");
  sheet.addRow(["name", "description"]);
  for (const p of promotions) {
    sheet.addRow([p.name, p.description ?? promotionSummaryForExcel(p)]);
  }
}

function promotionSummaryForExcel(p: WizardPromotion): string {
  const targets = p.targets.map((t) => t.kind).join(", ");
  const awards = p.eventRules.map((r) => `${r.award.type}=${r.award.value}`).join(", ");
  return `event=${p.eventType.code}; targets=${targets || "none"}; awards=${awards || "none"}`;
}

function writeBadgesSheet(
  wb: ExcelJS.Workbook,
  badges: WizardBadge[],
  includeSamples: boolean
): void {
  const sheet = wb.addWorksheet("Badges");
  sheet.addRow(["code", "name", "description"]);
  const rows =
    badges.length === 0 && includeSamples
      ? [{ code: "first-order", name: "First Order", description: "" }]
      : badges.map((b) => ({ code: b.code, name: b.name, description: b.description ?? "" }));
  for (const r of rows) {
    sheet.addRow([r.code, r.name, r.description]);
  }
}

// Column order is category|typeCode|code|name|description; readability-driven
// so optional `code` sits next to `typeCode` rather than after `name`.
const METADATA_DISPLAY_COLUMNS = ["category", "typeCode", "code", "name", "description"] as const;

function writeMetadataSheet(wb: ExcelJS.Workbook, metadata: MetadataRecord[]): void {
  const sheet = wb.addWorksheet("Metadata");
  sheet.addRow([...METADATA_DISPLAY_COLUMNS]);
  for (const m of metadata) {
    sheet.addRow([m.category, m.typeCode, m.code ?? "", m.name, m.description ?? ""]);
  }
}

function writeSheetHeader(sheet: ExcelJS.Worksheet): void {
  sheet.addRow([...SHEET_HEADER]);
}

function appendKeyRow(
  sheet: ExcelJS.Worksheet,
  key: string,
  value: string,
  exampleKey: string
): void {
  sheet.addRow([key, value, EXAMPLE_VALUES[exampleKey] ?? ""]);
}

function appendOptional(
  sheet: ExcelJS.Worksheet,
  key: string,
  value: string | undefined,
  exampleKey: string
): void {
  const example = EXAMPLE_VALUES[exampleKey] ?? "";
  const valueCell = value ?? "";
  sheet.addRow([key, valueCell, example]);
}

function parseBoolean(input: unknown): boolean {
  if (typeof input === "boolean") return input;
  if (typeof input === "number") return input !== 0;
  const s = String(input).trim().toLowerCase();
  if (s === "true" || s === "yes" || s === "1") return true;
  if (s === "false" || s === "no" || s === "0" || s === "") return false;
  return false;
}

function jsonCoerce(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function jsonStringify(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

function assertUniqueCodes(
  entityType: "tier" | "badge",
  items: Array<{ code: string; line?: number }>
): void {
  const seen = new Map<string, number | undefined>();
  for (const item of items) {
    if (seen.has(item.code)) {
      throw new DuplicateCodeError(entityType, item.code, seen.get(item.code), item.line);
    }
    seen.set(item.code, item.line);
  }
}

function sortTiersWithWarning(
  tiers: WizardTier[] | undefined,
  pushWarning: (w: Warning) => void
): void {
  if (!tiers || tiers.length === 0) return;
  let drift = false;
  for (let i = 1; i < tiers.length; i++) {
    if ((tiers[i]?.pointsThreshold ?? 0) < (tiers[i - 1]?.pointsThreshold ?? 0)) {
      drift = true;
      break;
    }
  }
  if (!drift) return;
  pushWarning({
    code: "tiers-unsorted",
    message: "Tier thresholds were not in ascending order; auto-sorted.",
    field: "tiers[].pointsThreshold",
  });
  tiers.sort((a, b) => a.pointsThreshold - b.pointsThreshold);
}

function runLinter(partial: DeepPartial<ProgramSpec>): Warning[] {
  const result = validateProgramSpecPartial(partial as Partial<ProgramSpec>);
  const source = result.ok ? result.warnings : result.violations;
  return source.map((v) => ({
    code: v.code,
    message: v.message,
    field: v.path,
  }));
}
