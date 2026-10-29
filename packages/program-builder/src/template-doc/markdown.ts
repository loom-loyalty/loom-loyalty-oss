import matter from "gray-matter";
import type {
  Heading,
  PhrasingContent,
  Root,
  RootContent,
  Table,
  TableCell,
  TableRow,
} from "mdast";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import { unified } from "unified";

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
  FrontmatterParseError,
  TableShapeError,
} from "./errors.js";
import { checkMetadataConsistency } from "./metadata-consistency.js";
import {
  assertSchemaVersion,
  frontmatterSchema,
  TEMPLATE_SCHEMA_VERSION,
  type ProgramSpecFrontmatter,
} from "./schema.js";
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

/** Disable gray-matter's non-YAML engines that execute attacker-controlled code. */
const SAFE_ENGINES = {
  javascript: { parse: (): never => throwUnsafeEngine("javascript") },
  coffee: { parse: (): never => throwUnsafeEngine("coffee") },
};

function throwUnsafeEngine(name: string): never {
  throw new FrontmatterParseError(
    `Frontmatter language "${name}" is disabled. Use plain YAML frontmatter only.`,
    { field: "frontmatter" }
  );
}

const MAX_FREEFORM_SECTIONS = 256;
const MAX_FREEFORM_SECTION_BYTES = 4 * 1024;
const MAX_WARNINGS = 256;
const MAX_TABLE_ROWS =
  Math.max(
    MAX_TIERS_PER_PROGRAM,
    MAX_BADGES_PER_PROGRAM,
    MAX_METADATA_RECORDS_PER_PROGRAM,
    MAX_PROMOTIONS_PER_PROGRAM
  ) + 10;

const DECODER = new TextDecoder("utf-8", { fatal: true });
const ENCODER = new TextEncoder();

const TIER_COLUMNS = ["code", "name", "pointsThreshold"] as const;
const TIER_OPTIONAL_COLUMNS = ["counterTargetTypeCode", "description", "bonus"] as const;
const BADGE_COLUMNS = ["code", "name"] as const;
const BADGE_OPTIONAL_COLUMNS = ["description"] as const;
const PROMOTION_COLUMNS = ["name", "description"] as const;
const PROMOTION_OPTIONAL_COLUMNS = [] as const;
const METADATA_REQUIRED_COLUMNS = ["category", "typeCode", "name"] as const;
const METADATA_OPTIONAL_COLUMNS = ["code", "description"] as const;

const FREEFORM_HEADING_PREFIX = "Freeform:";

export const markdownFormat: DocumentFormat = {
  id: "markdown",
  fileExtensions: [".md", ".markdown"],
  mimeTypes: ["text/markdown", "text/x-markdown"],
  parse: parseImpl,
  render: renderImpl,
};

async function parseImpl(buffer: Uint8Array, _opts: ParseOptions = {}): Promise<ParseResult> {
  let text: string;
  try {
    text = DECODER.decode(buffer);
  } catch {
    throw new FrontmatterParseError("Upload is not valid UTF-8 text.");
  }
  if (text.trim() === "") throw new EmptyUploadError();

  const { data, content } = parseFrontmatter(text);
  assertSchemaVersion(data["schemaVersion"]);

  const frontParse = frontmatterSchema.safeParse(data);
  if (!frontParse.success) {
    const issue = frontParse.error.issues[0];
    const path = issue?.path.map(String).join(".") || "frontmatter";
    throw new FrontmatterParseError(`${path}: ${issue?.message ?? "invalid frontmatter"}`, {
      field: path,
    });
  }
  const front: ProgramSpecFrontmatter = frontParse.data;

  const warnings: Warning[] = [];
  // Deprecated wizard-state flags. The schema strips them silently; the
  // warning nudges authors toward `program.typeName` / `currency.currencyTypeName`.
  const rawData = data as Record<string, unknown>;
  if ("programTypeIsSuggested" in rawData) {
    warnings.push({
      code: "deprecated-field",
      field: "programTypeIsSuggested",
      message:
        "programTypeIsSuggested is deprecated and ignored. Supply program.typeName when the typeCode isn't a built-in standard code; the executor uses it to auto-create PROGRAM_TYPE metadata on fresh tenants.",
    });
  }
  if ("currencyTypeIsSuggested" in rawData) {
    warnings.push({
      code: "deprecated-field",
      field: "currencyTypeIsSuggested",
      message:
        "currencyTypeIsSuggested is deprecated and ignored. Supply currency.currencyTypeName when the currencyTypeCode isn't a built-in standard code.",
    });
  }
  const pendingExtractions: FreeformExtractionRequest[] = [];
  const tiers: WizardTier[] = [];
  const tierLines: Array<number | undefined> = [];
  const badges: WizardBadge[] = [];
  const badgeLines: Array<number | undefined> = [];
  const promotions: WizardPromotion[] = [];
  const metadata: MetadataRecord[] = [];

  const tree = unified().use(remarkParse).use(remarkGfm).parse(content) as Root;
  const pushWarning = (w: Warning): void => {
    if (warnings.length < MAX_WARNINGS) warnings.push(w);
  };
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
  walkSections(tree, content, {
    onTiers: (table) => {
      const parsed = parseTiersTable(table, pushWarning, pushExtraction);
      tiers.push(...parsed.tiers);
      tierLines.push(...parsed.lines);
    },
    onBadges: (table) => {
      const parsed = parseBadgesTable(table, pushWarning);
      badges.push(...parsed.badges);
      badgeLines.push(...parsed.lines);
    },
    onPromotions: (table) => {
      parsePromotionsTable(table, pushWarning, pushExtraction);
    },
    onMetadata: (table) => {
      const parsed = parseMetadataTable(table, pushWarning);
      metadata.push(...parsed.metadata);
    },
    onFreeform: (field, sectionContent, loc) => {
      let content = sectionContent;
      const encoded = ENCODER.encode(content);
      if (encoded.byteLength > MAX_FREEFORM_SECTION_BYTES) {
        content = new TextDecoder("utf-8", { fatal: false }).decode(
          encoded.slice(0, MAX_FREEFORM_SECTION_BYTES)
        );
        pushWarning({
          code: "freeform-truncated",
          message: `Freeform section "${field}" exceeded ${MAX_FREEFORM_SECTION_BYTES} bytes; truncated.`,
          field: `freeform.${field}`,
          line: loc.line,
        });
      }
      pushExtraction({
        expectedField: field,
        sectionContent: content,
        sourceLocation: loc,
      });
    },
    onUnknownHeading: (heading, text) =>
      pushWarning({
        code: "unknown-section",
        message: `Unknown section heading "${text}" — ignored.`,
        line: heading.position?.start.line,
      }),
    onMissingTable: (sectionName, heading) =>
      pushWarning({
        code: "missing-table",
        message: `Section "## ${sectionName}" has no following table; no ${sectionName.toLowerCase()} parsed.`,
        line: heading.position?.start.line,
        field: sectionName.toLowerCase(),
      }),
  });

  assertUniqueCodes(
    "tier",
    tiers.map((t, i) => ({ code: t.code, line: tierLines[i] }))
  );
  assertUniqueCodes(
    "badge",
    badges.map((b, i) => ({ code: b.code, line: badgeLines[i] }))
  );
  sortTiersWithWarning(tiers, pushWarning);

  if (tiers.length > MAX_TIERS_PER_PROGRAM) {
    pushWarning({
      code: "tiers-over-cap",
      message: `Template declares ${tiers.length} tiers; at most ${MAX_TIERS_PER_PROGRAM} are allowed.`,
      field: "tiers",
    });
  }
  if (badges.length > MAX_BADGES_PER_PROGRAM) {
    pushWarning({
      code: "badges-over-cap",
      message: `Template declares ${badges.length} badges; at most ${MAX_BADGES_PER_PROGRAM} are allowed.`,
      field: "badges",
    });
  }
  if (metadata.length > MAX_METADATA_RECORDS_PER_PROGRAM) {
    pushWarning({
      code: "metadata-over-cap",
      message: `Template declares ${metadata.length} metadata rows; at most ${MAX_METADATA_RECORDS_PER_PROGRAM} are allowed.`,
      field: "metadata",
    });
  }

  const { schemaVersion: _sv, ...frontWithoutVersion } = front;
  void _sv;
  const partial: DeepPartial<ProgramSpec> = {
    ...frontWithoutVersion,
    tiers,
    badges,
    promotions,
    metadata,
  };

  checkMetadataConsistency(partial, pushWarning);

  for (const v of runLinter(partial)) warnings.push(v);

  return { partial, pendingExtractions, warnings };
}

async function renderImpl(spec: ProgramSpec, opts: RenderOptions = {}): Promise<RenderResult> {
  const frontmatter: Record<string, unknown> = {
    schemaVersion: TEMPLATE_SCHEMA_VERSION,
    selectedFeatures: spec.selectedFeatures,
    program: spec.program,
    ...(spec.currency ? { currency: spec.currency } : {}),
    ...(spec.existingCurrencyCode ? { existingCurrencyCode: spec.existingCurrencyCode } : {}),
    ...(spec.existingCurrencyId ? { existingCurrencyId: spec.existingCurrencyId } : {}),
    ...(spec.expiryRule ? { expiryRule: spec.expiryRule } : {}),
    ...(spec.pendingRule ? { pendingRule: spec.pendingRule } : {}),
    ...(spec.autoAwardBaseTier ? { autoAwardBaseTier: true } : {}),
    ...(spec.eventType ? { eventType: spec.eventType } : {}),
    awardRule: renderAwardRule(spec.awardRule),
    ...(spec.signupBonusConfig ? { signupBonusConfig: spec.signupBonusConfig } : {}),
    ...(spec.birthdayBonusConfig ? { birthdayBonusConfig: spec.birthdayBonusConfig } : {}),
    ...(spec.testCustomer ? { testCustomer: spec.testCustomer } : {}),
  };

  const body = renderBody(spec, opts);
  const md = matter.stringify(body, stripUndefined(frontmatter));
  return { buffer: ENCODER.encode(md), warnings: [] };
}

// js-yaml's safeDump throws on undefined values; strip them while keeping null/false/0/''.
function stripUndefined<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map(stripUndefined) as unknown as T;
  }
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v === undefined) continue;
      out[k] = stripUndefined(v);
    }
    return out as unknown as T;
  }
  return value;
}

function renderAwardRule(awardRule: ProgramSpec["awardRule"]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (awardRule.templateId) out.templateId = awardRule.templateId;
  if (awardRule.templateConfig && Object.keys(awardRule.templateConfig).length > 0) {
    out.templateConfig = awardRule.templateConfig;
  }
  // rulePayload is schema-gated on code+name. Only emit when both are present
  // so a best-effort hydrator (no SDK-exposed award rule yet) can round-trip.
  const payload = awardRule.rulePayload;
  if (payload && typeof payload.code === "string" && typeof payload.name === "string") {
    out.rulePayload = payload;
  }
  return out;
}

// ── helpers ───────────────────────────────────────────────────────────

function parseFrontmatter(text: string): { data: Record<string, unknown>; content: string } {
  try {
    const result = matter(text, { engines: SAFE_ENGINES, language: "yaml" });
    const data = result.data as Record<string, unknown>;
    if (hasSharedReferences(data)) {
      throw new FrontmatterParseError(
        "YAML anchors and aliases are not supported in frontmatter.",
        { field: "frontmatter" }
      );
    }
    return { data, content: result.content };
  } catch (err) {
    if (err instanceof FrontmatterParseError) throw err;
    const message = err instanceof Error ? err.message : String(err);
    throw new FrontmatterParseError(`Could not parse YAML frontmatter: ${message}`);
  }
}

function hasSharedReferences(obj: unknown, seen: WeakSet<object> = new WeakSet()): boolean {
  if (obj === null || typeof obj !== "object") return false;
  if (seen.has(obj)) return true;
  seen.add(obj);
  if (Array.isArray(obj)) {
    for (const v of obj) if (hasSharedReferences(v, seen)) return true;
  } else {
    for (const v of Object.values(obj)) if (hasSharedReferences(v, seen)) return true;
  }
  return false;
}

interface WalkHandlers {
  onTiers(table: Table): void;
  onBadges(table: Table): void;
  onPromotions(table: Table): void;
  onMetadata(table: Table): void;
  onFreeform(
    field: string,
    sectionContent: string,
    sourceLocation: { line: number; col: number }
  ): void;
  onUnknownHeading(heading: Heading, text: string): void;
  onMissingTable(
    sectionName: "Tiers" | "Badges" | "Promotions" | "Metadata",
    heading: Heading
  ): void;
}

function walkSections(tree: Root, source: string, handlers: WalkHandlers): void {
  const children = tree.children;
  const freeformLower = FREEFORM_HEADING_PREFIX.toLowerCase();
  for (let i = 0; i < children.length; i++) {
    const node = children[i];
    if (!node || node.type !== "heading" || node.depth !== 2) continue;

    const headingText = inlineText(node.children);
    const lower = headingText.toLowerCase().trim();

    if (lower === "tiers") {
      const table = nextTable(children, i);
      if (table) handlers.onTiers(table);
      else handlers.onMissingTable("Tiers", node);
    } else if (lower === "badges") {
      const table = nextTable(children, i);
      if (table) handlers.onBadges(table);
      else handlers.onMissingTable("Badges", node);
    } else if (lower === "promotions") {
      const table = nextTable(children, i);
      if (table) handlers.onPromotions(table);
      else handlers.onMissingTable("Promotions", node);
    } else if (lower === "metadata") {
      const table = nextTable(children, i);
      if (table) handlers.onMetadata(table);
      else handlers.onMissingTable("Metadata", node);
    } else if (lower.startsWith(freeformLower)) {
      const field = headingText.slice(FREEFORM_HEADING_PREFIX.length).trim();
      const content = sliceUntilNextH2(children, i, source);
      const loc = {
        line: node.position?.start.line ?? 0,
        col: node.position?.start.column ?? 0,
      };
      handlers.onFreeform(field, content, loc);
    } else {
      handlers.onUnknownHeading(node, headingText);
    }
  }
}

function nextTable(children: RootContent[], fromIndex: number): Table | undefined {
  for (let i = fromIndex + 1; i < children.length; i++) {
    const node = children[i];
    if (!node) continue;
    if (node.type === "heading" && (node as Heading).depth <= 2) return undefined;
    if (node.type === "table") return node as Table;
  }
  return undefined;
}

function sliceUntilNextH2(children: RootContent[], headingIndex: number, source: string): string {
  const heading = children[headingIndex];
  const start = heading?.position?.end.offset;
  if (start === undefined) return "";
  let end = source.length;
  for (let i = headingIndex + 1; i < children.length; i++) {
    const node = children[i];
    const nextStart = node?.position?.start.offset;
    if (node?.type === "heading" && (node as Heading).depth <= 2 && nextStart !== undefined) {
      end = nextStart;
      break;
    }
  }
  return source.slice(start, end).trim();
}

function inlineText(nodes: PhrasingContent[]): string {
  const out: string[] = [];
  for (const n of nodes) {
    if ("value" in n && typeof n.value === "string") out.push(n.value);
    else if ("children" in n) out.push(inlineText(n.children as PhrasingContent[]));
  }
  return out.join("");
}

interface ParsedTiers {
  tiers: WizardTier[];
  lines: Array<number | undefined>;
}

interface ParsedBadges {
  badges: WizardBadge[];
  lines: Array<number | undefined>;
}

function parseTiersTable(
  table: Table,
  pushWarning: (w: Warning) => void,
  pushExtraction: (req: FreeformExtractionRequest) => void
): ParsedTiers {
  const headers = readHeaderRow(table);
  assertRequiredColumns(
    "Tiers",
    headers,
    TIER_COLUMNS as readonly string[],
    TIER_OPTIONAL_COLUMNS as readonly string[],
    pushWarning,
    table
  );

  const rowNodes = table.children.slice(1);
  if (rowNodes.length > MAX_TABLE_ROWS) {
    throw new TableShapeError(
      `Tiers table has ${rowNodes.length} rows; at most ${MAX_TABLE_ROWS} are allowed.`,
      { line: table.position?.start.line, field: "tiers" }
    );
  }
  const rows = rowNodes;
  const tiers: WizardTier[] = [];
  const lines: Array<number | undefined> = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const cells = readRowCells(row, headers, table);
    const code = (cells["code"] ?? "").trim();
    const name = (cells["name"] ?? "").trim();
    if (code === "") {
      throw new TableShapeError("Tiers row has empty code", {
        line: row.position?.start.line,
        field: "tiers[].code",
      });
    }
    if (name === "") {
      throw new TableShapeError(`Tiers row has empty name for code "${code}"`, {
        line: row.position?.start.line,
        field: "tiers[].name",
      });
    }
    const loc = {
      line: row.position?.start.line ?? 0,
      col: row.position?.start.column ?? 0,
    };
    const thresholdStr = (cells["pointsThreshold"] ?? "").trim();
    const numericThreshold = parseIntegerCell(thresholdStr);
    const tier: WizardTier = {
      code,
      name,
      pointsThreshold: numericThreshold ?? 0,
    };
    if (numericThreshold === null && thresholdStr !== "") {
      pushExtraction({
        expectedField: `tiers[${i}].pointsThreshold`,
        sectionContent: thresholdStr,
        sourceLocation: loc,
      });
    }
    const bonusStr = (cells["bonus"] ?? "").trim();
    if (bonusStr !== "") {
      const numericBonus = parseMultiplierCell(bonusStr);
      if (numericBonus !== null) {
        tier.earnMultiplier = numericBonus;
      } else {
        pushExtraction({
          expectedField: `tiers[${i}].earnMultiplier`,
          sectionContent: bonusStr,
          sourceLocation: loc,
        });
      }
    }
    const ctt = cells["counterTargetTypeCode"];
    if (ctt) tier.counterTargetTypeCode = ctt;
    const desc = cells["description"];
    if (desc) tier.description = desc;
    tiers.push(tier);
    lines.push(row.position?.start.line);
  }
  return { tiers, lines };
}

function parsePromotionsTable(
  table: Table,
  pushWarning: (w: Warning) => void,
  pushExtraction: (req: FreeformExtractionRequest) => void
): void {
  const headers = readHeaderRow(table);
  assertRequiredColumns(
    "Promotions",
    headers,
    PROMOTION_COLUMNS as readonly string[],
    PROMOTION_OPTIONAL_COLUMNS as readonly string[],
    pushWarning,
    table
  );
  const rowNodes = table.children.slice(1);
  if (rowNodes.length > MAX_TABLE_ROWS) {
    throw new TableShapeError(
      `Promotions table has ${rowNodes.length} rows; at most ${MAX_TABLE_ROWS} are allowed.`,
      { line: table.position?.start.line, field: "promotions" }
    );
  }
  for (let i = 0; i < rowNodes.length; i++) {
    const row = rowNodes[i]!;
    const cells = readRowCells(row, headers, table);
    const name = (cells["name"] ?? "").trim();
    const description = (cells["description"] ?? "").trim();
    if (name === "") {
      throw new TableShapeError("Promotions row has empty name", {
        line: row.position?.start.line,
        field: "promotions[].name",
      });
    }
    if (description === "") {
      throw new TableShapeError(`Promotions row has empty description for "${name}"`, {
        line: row.position?.start.line,
        field: "promotions[].description",
      });
    }
    pushExtraction({
      expectedField: `promotions[${i}]`,
      sectionContent: `${name} — ${description}`,
      sourceLocation: {
        line: row.position?.start.line ?? 0,
        col: row.position?.start.column ?? 0,
      },
    });
  }
}

/**
 * Parse a multiplier cell — e.g. `1.7x`, `1.2`, `2`. Strips commas and
 * the trailing `x` (case-insensitive). Returns `null` for empty or
 * non-numeric cells so the caller can route the prose to the LLM.
 *
 * Use this for the tier `bonus` column where `1.7x` is expected to
 * round-trip as `1.7`.
 */
export function parseMultiplierCell(s: string): number | null {
  if (s === "") return null;
  const trimmed = s.replace(/,/g, "").replace(/x$/i, "");
  if (!/^-?\d+(\.\d+)?$/.test(trimmed)) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

/**
 * Parse an integer cell — e.g. `500`, `2,500`. Strips commas but NOT a
 * trailing `x`. A cell like `500x` is ambiguous prose and routes to the
 * LLM extractor (returning `null` here).
 *
 * Use this for the tier `pointsThreshold` column where `500x` shouldn't
 * silently parse as 500 — the `x` is almost certainly Excel's column
 * auto-format or a typo, not part of the value.
 */
export function parseIntegerCell(s: string): number | null {
  if (s === "") return null;
  const trimmed = s.replace(/,/g, "");
  // Strict integers only — a cell like `100.5` is ambiguous prose for
  // `pointsThreshold` (the platform takes integer thresholds) and
  // should route to the LLM extractor instead of silently coercing to
  // a float. Without this, `100.5` would parse to `100.5` and either
  // produce a platform validation error or a fractional threshold the
  // user didn't intend.
  if (!/^-?\d+$/.test(trimmed)) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

interface ParsedMetadata {
  metadata: MetadataRecord[];
  lines: Array<number | undefined>;
}

function parseMetadataTable(table: Table, pushWarning: (w: Warning) => void): ParsedMetadata {
  const headers = readHeaderRow(table);
  assertRequiredColumns(
    "Metadata",
    headers,
    METADATA_REQUIRED_COLUMNS as readonly string[],
    METADATA_OPTIONAL_COLUMNS as readonly string[],
    pushWarning,
    table
  );

  const rowNodes = table.children.slice(1);
  if (rowNodes.length > MAX_TABLE_ROWS) {
    throw new TableShapeError(
      `Metadata table has ${rowNodes.length} rows; at most ${MAX_TABLE_ROWS} are allowed.`,
      { line: table.position?.start.line, field: "metadata" }
    );
  }

  const metadata: MetadataRecord[] = [];
  const lines: Array<number | undefined> = [];
  // Detect duplicate (typeCode, code) tuples — TYPE-only rows key by typeCode alone.
  const seen = new Map<string, number | undefined>();
  for (const row of rowNodes) {
    const cells = readRowCells(row, headers, table);
    const category = (cells["category"] ?? "").trim();
    const typeCode = (cells["typeCode"] ?? "").trim();
    const name = (cells["name"] ?? "").trim();
    if (category === "") {
      throw new TableShapeError("Metadata row has empty category", {
        line: row.position?.start.line,
        field: "metadata[].category",
      });
    }
    if (typeCode === "") {
      throw new TableShapeError("Metadata row has empty typeCode", {
        line: row.position?.start.line,
        field: "metadata[].typeCode",
      });
    }
    if (name === "") {
      throw new TableShapeError(`Metadata row has empty name for typeCode "${typeCode}"`, {
        line: row.position?.start.line,
        field: "metadata[].name",
      });
    }
    const code = (cells["code"] ?? "").trim();
    const description = (cells["description"] ?? "").trim();
    const record: MetadataRecord = { category, typeCode, name };
    if (code) record.code = code;
    if (description) record.description = description;

    const dupKey = `${typeCode}::${code}`;
    if (seen.has(dupKey)) {
      pushWarning({
        code: "duplicate-metadata",
        message: `Metadata row duplicates (typeCode "${typeCode}"${code ? `, code "${code}"` : ""}); both rows are kept and duplicate API calls are ignored downstream.`,
        line: row.position?.start.line,
        field: "metadata",
      });
    }
    seen.set(dupKey, row.position?.start.line);

    metadata.push(record);
    lines.push(row.position?.start.line);
  }
  return { metadata, lines };
}

function parseBadgesTable(table: Table, pushWarning: (w: Warning) => void): ParsedBadges {
  const headers = readHeaderRow(table);
  assertRequiredColumns(
    "Badges",
    headers,
    BADGE_COLUMNS as readonly string[],
    BADGE_OPTIONAL_COLUMNS as readonly string[],
    pushWarning,
    table
  );

  const rowNodes = table.children.slice(1);
  if (rowNodes.length > MAX_TABLE_ROWS) {
    throw new TableShapeError(
      `Badges table has ${rowNodes.length} rows; at most ${MAX_TABLE_ROWS} are allowed.`,
      { line: table.position?.start.line, field: "badges" }
    );
  }
  const rows = rowNodes;
  const badges: WizardBadge[] = [];
  const lines: Array<number | undefined> = [];
  for (const row of rows) {
    const cells = readRowCells(row, headers, table);
    const code = (cells["code"] ?? "").trim();
    const name = (cells["name"] ?? "").trim();
    if (code === "") {
      throw new TableShapeError("Badges row has empty code", {
        line: row.position?.start.line,
        field: "badges[].code",
      });
    }
    if (name === "") {
      throw new TableShapeError(`Badges row has empty name for code "${code}"`, {
        line: row.position?.start.line,
        field: "badges[].name",
      });
    }
    const badge: WizardBadge = { code, name };
    const desc = cells["description"];
    if (desc) badge.description = desc;
    badges.push(badge);
    lines.push(row.position?.start.line);
  }
  return { badges, lines };
}

function readHeaderRow(table: Table): string[] {
  const headerRow = table.children[0];
  if (!headerRow) {
    throw new TableShapeError("Table is empty", { line: table.position?.start.line });
  }
  return headerRow.children.map(cellText);
}

function readRowCells(row: TableRow, headers: string[], table: Table): Record<string, string> {
  const cells = row.children;
  if (cells.length !== headers.length) {
    throw new TableShapeError(
      `Row has ${cells.length} cells, expected ${headers.length} (from header row)`,
      { line: row.position?.start.line ?? table.position?.start.line }
    );
  }
  const out: Record<string, string> = {};
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i];
    const c = cells[i];
    if (h && c) out[h] = cellText(c);
  }
  return out;
}

function cellText(cell: TableCell): string {
  return inlineText(cell.children).trim();
}

function assertRequiredColumns(
  sectionName: string,
  headers: string[],
  required: readonly string[],
  optional: readonly string[],
  pushWarning: (w: Warning) => void,
  table: Table
): void {
  for (const col of required) {
    if (!headers.includes(col)) {
      throw new TableShapeError(`${sectionName} table missing required column "${col}"`, {
        line: table.position?.start.line,
        field: `${sectionName.toLowerCase()}[].${col}`,
      });
    }
  }
  const known = new Set<string>([...required, ...optional]);
  for (const h of headers) {
    if (!known.has(h)) {
      pushWarning({
        code: "unknown-column",
        message: `${sectionName} table has unknown column "${h}" — values will be ignored.`,
        line: table.position?.start.line,
        field: `${sectionName.toLowerCase()}[].${h}`,
      });
    }
  }
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

function sortTiersWithWarning(tiers: WizardTier[], pushWarning: (w: Warning) => void): void {
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

function renderBody(spec: ProgramSpec, opts: RenderOptions): string {
  const parts: string[] = [];

  if (spec.program.name) parts.push(`# ${spec.program.name}\n`);

  if (spec.tiers.length > 0 || opts.includeSampleData) {
    parts.push(renderTiersTable(spec.tiers, opts.includeSampleData ?? false));
  }

  if (spec.badges.length > 0 || opts.includeSampleData) {
    parts.push(renderBadgesTable(spec.badges, opts.includeSampleData ?? false));
  }

  if ((spec.promotions?.length ?? 0) > 0) {
    parts.push(renderPromotionsTable(spec.promotions));
  }

  if ((spec.metadata?.length ?? 0) > 0) {
    parts.push(renderMetadataTable(spec.metadata));
  }

  if (spec.program.description && typeof spec.program.description === "object") {
    const en = (spec.program.description as Record<string, string>)["en"];
    if (en) parts.push(`## Freeform: description\n\n${en}\n`);
  }

  return parts.join("\n");
}

function renderTiersTable(tiers: WizardTier[], includeSamples: boolean): string {
  const hasBonus = tiers.some((t) => t.earnMultiplier !== undefined);
  const rows =
    tiers.length === 0 && includeSamples
      ? [
          {
            code: "bronze",
            name: "Bronze",
            pointsThreshold: "0",
            bonus: "",
            counterTargetTypeCode: "",
            description: "",
          },
          {
            code: "silver",
            name: "Silver",
            pointsThreshold: "500",
            bonus: "",
            counterTargetTypeCode: "",
            description: "",
          },
        ]
      : tiers.map((t) => ({
          code: t.code,
          name: t.name,
          pointsThreshold: String(t.pointsThreshold),
          bonus: t.earnMultiplier !== undefined ? String(t.earnMultiplier) : "",
          counterTargetTypeCode: t.counterTargetTypeCode ?? "",
          description: t.description ?? "",
        }));

  const headers = ["code", "name", "pointsThreshold"];
  if (hasBonus || (tiers.length === 0 && includeSamples)) headers.push("bonus");
  headers.push("counterTargetTypeCode", "description");
  return renderTable("Tiers", headers, rows);
}

function renderPromotionsTable(promotions: WizardPromotion[]): string {
  const headers = ["name", "description"];
  const rows = promotions.map((p) => ({
    name: p.name,
    description: p.description ?? promotionSummary(p),
  }));
  return renderTable("Promotions", headers, rows);
}

function promotionSummary(p: WizardPromotion): string {
  const targets = p.targets.map((t) => t.kind).join(", ");
  const awards = p.eventRules.map((r) => `${r.award.type}=${r.award.value}`).join(", ");
  return `event=${p.eventType.code}; targets=${targets || "none"}; awards=${awards || "none"}`;
}

function renderBadgesTable(badges: WizardBadge[], includeSamples: boolean): string {
  const rows =
    badges.length === 0 && includeSamples
      ? [{ code: "first-order", name: "First Order", description: "" }]
      : badges.map((b) => ({ code: b.code, name: b.name, description: b.description ?? "" }));
  const headers = ["code", "name", "description"];
  return renderTable("Badges", headers, rows);
}

function renderMetadataTable(metadata: MetadataRecord[]): string {
  const headers = ["category", "typeCode", "code", "name", "description"];
  const rows = metadata.map((m) => ({
    category: m.category,
    typeCode: m.typeCode,
    code: m.code ?? "",
    name: m.name,
    description: m.description ?? "",
  }));
  return renderTable("Metadata", headers, rows);
}

function renderTable(
  sectionName: string,
  headers: string[],
  rows: Array<Record<string, string>>
): string {
  const lines: string[] = [`## ${sectionName}`, ""];
  lines.push(`| ${headers.join(" | ")} |`);
  lines.push(`| ${headers.map(() => "---").join(" | ")} |`);
  for (const row of rows) {
    lines.push(`| ${headers.map((h) => escapeCell(row[h] ?? "")).join(" | ")} |`);
  }
  lines.push("");
  return lines.join("\n");
}

function escapeCell(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\n/g, " ");
}
