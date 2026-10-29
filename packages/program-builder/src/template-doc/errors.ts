export interface TemplateParseErrorLocation {
  line?: number;
  col?: number;
  field?: string;
}

export class TemplateParseError extends Error {
  readonly code: string;
  readonly line?: number;
  readonly col?: number;
  readonly field?: string;

  constructor(code: string, message: string, location: TemplateParseErrorLocation = {}) {
    super(message);
    this.name = "TemplateParseError";
    this.code = code;
    this.line = location.line;
    this.col = location.col;
    this.field = location.field;
  }
}

export class EmptyUploadError extends TemplateParseError {
  constructor() {
    super("EMPTY_UPLOAD", "Template file is empty");
    this.name = "EmptyUploadError";
  }
}

export class FrontmatterParseError extends TemplateParseError {
  constructor(message: string, location: TemplateParseErrorLocation = {}) {
    super("FRONTMATTER_PARSE_ERROR", message, location);
    this.name = "FrontmatterParseError";
  }
}

export class SchemaVersionMissingError extends TemplateParseError {
  constructor() {
    super(
      "SCHEMA_VERSION_MISSING",
      'Missing required "schemaVersion" field in frontmatter. Expected "program-spec.v1".',
      { field: "schemaVersion" }
    );
    this.name = "SchemaVersionMissingError";
  }
}

export class SchemaVersionMismatchError extends TemplateParseError {
  readonly received: string;
  readonly expected: string;

  constructor(received: string, expected = "program-spec.v1") {
    super(
      "SCHEMA_VERSION_MISMATCH",
      `Unsupported schemaVersion "${received}". This build expects "${expected}". Upgrade the template or the platform.`,
      { field: "schemaVersion" }
    );
    this.name = "SchemaVersionMismatchError";
    this.received = received;
    this.expected = expected;
  }
}

export class TableShapeError extends TemplateParseError {
  constructor(message: string, location: TemplateParseErrorLocation) {
    super("TABLE_SHAPE_ERROR", message, location);
    this.name = "TableShapeError";
  }
}

export class DuplicateCodeError extends TemplateParseError {
  readonly entityType: "tier" | "badge";
  readonly duplicateCode: string;
  readonly firstLine?: number;
  readonly secondLine?: number;

  constructor(
    entityType: "tier" | "badge",
    duplicateCode: string,
    firstLine?: number,
    secondLine?: number
  ) {
    const where =
      firstLine !== undefined && secondLine !== undefined
        ? ` (lines ${firstLine} and ${secondLine})`
        : "";
    super("DUPLICATE_CODE", `Duplicate ${entityType} code "${duplicateCode}"${where}`, {
      line: secondLine,
      field: `${entityType}s[].code`,
    });
    this.name = "DuplicateCodeError";
    this.entityType = entityType;
    this.duplicateCode = duplicateCode;
    this.firstLine = firstLine;
    this.secondLine = secondLine;
  }
}
