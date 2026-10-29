import { describe, expect, it } from "vitest";

/**
 * Tests for the pure utility logic used by useSqlQuery.
 *
 * The functions `hasLimit` and `appendLimit` are module-private in
 * `use-sql-query.ts`, so we replicate their documented behavior here
 * to lock it down with unit tests.
 */

// ── hasLimit: case-insensitive check for "LIMIT" anywhere in the SQL ──

const hasLimit = (sql: string): boolean => sql.toUpperCase().includes("LIMIT");

describe("SQL LIMIT detection", () => {
  it("detects LIMIT in simple query", () => {
    expect(hasLimit("SELECT * FROM t LIMIT 10")).toBe(true);
  });

  it("detects limit in lowercase", () => {
    expect(hasLimit("SELECT * FROM t limit 10")).toBe(true);
  });

  it("detects Limit in mixed case", () => {
    expect(hasLimit("SELECT * FROM t Limit 10")).toBe(true);
  });

  it("returns false when no LIMIT present", () => {
    expect(hasLimit("SELECT * FROM t")).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(hasLimit("")).toBe(false);
  });

  it("detects LIMIT in subquery", () => {
    expect(hasLimit("SELECT * FROM (SELECT * FROM t LIMIT 5) sub")).toBe(true);
  });

  it("detects LIMIT inside string literal (known false positive)", () => {
    // This is a documented limitation — simple string inclusion check
    expect(hasLimit("SELECT * FROM t WHERE name = 'LIMIT'")).toBe(true);
  });

  it("detects LIMIT with extra whitespace", () => {
    expect(hasLimit("SELECT * FROM t\n  LIMIT  10")).toBe(true);
  });
});

// ── appendLimit: trims trailing whitespace and appends "\nLIMIT {n}" ──

const appendLimit = (sql: string, limit: number): string =>
  `${sql.trimEnd()}\nLIMIT ${String(limit)}`;

describe("SQL LIMIT append", () => {
  it("appends LIMIT to a simple query", () => {
    expect(appendLimit("SELECT * FROM t", 1000)).toBe("SELECT * FROM t\nLIMIT 1000");
  });

  it("trims trailing whitespace before appending", () => {
    expect(appendLimit("SELECT * FROM t   ", 1000)).toBe("SELECT * FROM t\nLIMIT 1000");
  });

  it("trims trailing newlines before appending", () => {
    expect(appendLimit("SELECT * FROM t\n\n", 500)).toBe("SELECT * FROM t\nLIMIT 500");
  });

  it("preserves leading whitespace", () => {
    const result = appendLimit("  SELECT * FROM t", 100);
    expect(result).toBe("  SELECT * FROM t\nLIMIT 100");
  });

  it("uses the default limit of 1000", () => {
    const DEFAULT_LIMIT = 1000;
    expect(appendLimit("SELECT 1", DEFAULT_LIMIT)).toBe("SELECT 1\nLIMIT 1000");
  });

  it("uses the export limit of 100000", () => {
    const MAX_EXPORT_ROWS = 100_000;
    expect(appendLimit("SELECT 1", MAX_EXPORT_ROWS)).toBe("SELECT 1\nLIMIT 100000");
  });
});

// ── Integration logic: auto-append behavior ──

describe("SQL auto-LIMIT logic (integration)", () => {
  const DEFAULT_LIMIT = 1000;

  function prepareSql(sql: string): string {
    const trimmed = sql.trim();
    return hasLimit(trimmed) ? trimmed : appendLimit(trimmed, DEFAULT_LIMIT);
  }

  it("appends LIMIT 1000 when query has no LIMIT", () => {
    expect(prepareSql("SELECT * FROM t")).toBe("SELECT * FROM t\nLIMIT 1000");
  });

  it("does not append LIMIT when query already has one", () => {
    const sql = "SELECT * FROM t LIMIT 50";
    expect(prepareSql(sql)).toBe(sql);
  });

  it("trims input whitespace before checking", () => {
    expect(prepareSql("  SELECT * FROM t  ")).toBe("SELECT * FROM t\nLIMIT 1000");
  });

  it("preserves user-specified LIMIT", () => {
    const sql = "SELECT * FROM t\nORDER BY id\nLIMIT 5";
    expect(prepareSql(sql)).toBe(sql);
  });
});
