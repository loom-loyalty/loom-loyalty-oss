import { describe, expect, it } from "vitest";

import { MAX_BULK_ROWS, parseBulkInput, parseBulkInputWithMeta } from "./bulk-element-import.js";

describe("parseBulkInput", () => {
  it("returns an empty array for empty input", () => {
    expect(parseBulkInput("")).toEqual([]);
    expect(parseBulkInput("   \n\n  \n")).toEqual([]);
  });

  it("parses a single tab-separated row", () => {
    const rows = parseBulkInput("Email Address\tSTRING\ttrue");
    expect(rows).toHaveLength(1);
    const row = rows[0]!;
    expect(row.parsed).toMatchObject({
      name: "Email Address",
      inputAttribute: "emailAddress",
      outputAttribute: "emailAddress",
      typeCode: "STRING",
      required: true,
    });
    expect(row.error).toBeNull();
  });

  it("parses multiple tab-separated rows", () => {
    const rows = parseBulkInput("Email\tSTRING\ttrue\nPhone\tSTRING\tfalse");
    expect(rows).toHaveLength(2);
    expect(rows[0]!.parsed?.required).toBe(true);
    expect(rows[1]!.parsed?.required).toBe(false);
  });

  it("falls back to comma separation when no tabs", () => {
    const rows = parseBulkInput("Email,STRING,true");
    expect(rows[0]!.parsed).toMatchObject({ name: "Email", typeCode: "STRING", required: true });
  });

  it("skips blank lines", () => {
    const rows = parseBulkInput("Email\tSTRING\ttrue\n\n\nPhone\tSTRING\tfalse");
    expect(rows).toHaveLength(2);
  });

  it("skips comment lines starting with #", () => {
    const rows = parseBulkInput("# a comment\nEmail\tSTRING\ttrue\n# another");
    expect(rows).toHaveLength(1);
    expect(rows[0]!.parsed?.name).toBe("Email");
  });

  it("handles CRLF line endings", () => {
    const rows = parseBulkInput("Email\tSTRING\ttrue\r\nPhone\tSTRING\tfalse\r\n");
    expect(rows).toHaveLength(2);
  });

  it("treats missing 'required' column as false", () => {
    const rows = parseBulkInput("Email\tSTRING");
    expect(rows[0]!.parsed?.required).toBe(false);
  });

  it.each([
    ["true", true],
    ["yes", true],
    ["y", true],
    ["1", true],
    ["required", true],
    ["TRUE", true],
    ["Yes", true],
    ["false", false],
    ["no", false],
    ["n", false],
    ["0", false],
    ["optional", false],
    ["FALSE", false],
  ])("interprets required='%s' as %s", (input, expected) => {
    const rows = parseBulkInput(`Email\tSTRING\t${input}`);
    expect(rows[0]!.parsed?.required).toBe(expected);
  });

  it("returns an error for invalid required value", () => {
    const rows = parseBulkInput("Email\tSTRING\tmaybe");
    expect(rows[0]!.parsed).toBeNull();
    expect(rows[0]!.error).toMatch(/Required must be true\/false/);
  });

  it("returns an error when only one column is present", () => {
    const rows = parseBulkInput("Email");
    expect(rows[0]!.parsed).toBeNull();
    expect(rows[0]!.error).toMatch(/Need at least Name and Type/);
  });

  it("returns an error when the name is empty", () => {
    const rows = parseBulkInput("\tSTRING\ttrue");
    expect(rows[0]!.parsed).toBeNull();
    expect(rows[0]!.error).toMatch(/Name is empty/);
  });

  it("returns an error when the type is empty", () => {
    const rows = parseBulkInput("Email\t\ttrue");
    expect(rows[0]!.parsed).toBeNull();
    expect(rows[0]!.error).toMatch(/Type is empty/);
  });

  it("uppercases the type code", () => {
    const rows = parseBulkInput("Email\tstring\ttrue");
    expect(rows[0]!.parsed?.typeCode).toBe("STRING");
  });

  it("sets all boolean flags to false by default", () => {
    const rows = parseBulkInput("Email\tSTRING\ttrue");
    expect(rows[0]!.parsed).toMatchObject({
      isArray: false,
      sensitive: false,
      inputOnly: false,
      outputOnly: false,
      createOnly: false,
    });
  });

  it("derives inputAttribute and outputAttribute from the name", () => {
    const rows = parseBulkInput("First Name\tSTRING\ttrue");
    expect(rows[0]!.parsed?.inputAttribute).toBe("firstName");
    expect(rows[0]!.parsed?.outputAttribute).toBe("firstName");
  });

  it("preserves raw line in the output row for error display", () => {
    const rows = parseBulkInput("Email\tSTRING\tgarbage");
    expect(rows[0]!.raw).toBe("Email\tSTRING\tgarbage");
  });

  it("mixes valid and invalid rows in one pass", () => {
    const rows = parseBulkInput("Email\tSTRING\ttrue\nBad Row");
    expect(rows).toHaveLength(2);
    expect(rows[0]!.parsed).not.toBeNull();
    expect(rows[1]!.parsed).toBeNull();
  });
});

describe("parseBulkInput type-code casing", () => {
  it("upper-cases a pasted primitive so `string` still imports as STRING", () => {
    const rows = parseBulkInput("Email\tstring\ttrue");
    expect(rows[0]!.parsed?.typeCode).toBe("STRING");
  });

  it("leaves a custom DataModelType reference exactly as pasted", () => {
    // Custom codes are lowercase-hyphenated, so upper-casing them turned
    // `order-line-item` into `ORDER-LINE-ITEM`, which resolves to nothing.
    const rows = parseBulkInput("Line Items\torder-line-item\tfalse");
    expect(rows[0]!.parsed?.typeCode).toBe("order-line-item");
  });
});

describe("parseBulkInputWithMeta", () => {
  it("returns truncated=false when input is under the cap", () => {
    const { rows, truncated } = parseBulkInputWithMeta("Email\tSTRING\ttrue");
    expect(rows).toHaveLength(1);
    expect(truncated).toBe(false);
  });

  it("caps rows at MAX_BULK_ROWS and sets truncated=true", () => {
    const line = "Email\tSTRING\ttrue";
    const input = Array.from({ length: MAX_BULK_ROWS + 50 }, () => line).join("\n");
    const { rows, truncated } = parseBulkInputWithMeta(input);
    expect(rows).toHaveLength(MAX_BULK_ROWS);
    expect(truncated).toBe(true);
  });

  it("does not count blank/comment lines against the cap", () => {
    const line = "Email\tSTRING\ttrue";
    const data = Array.from({ length: MAX_BULK_ROWS }, () => line).join("\n");
    const input = `# header\n\n${data}\n# trailing`;
    const { rows, truncated } = parseBulkInputWithMeta(input);
    expect(rows).toHaveLength(MAX_BULK_ROWS);
    expect(truncated).toBe(false);
  });
});
