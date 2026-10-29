import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  ENTITY_PREFIX_MAP,
  __resetWarnedUnknownPrefixes,
  entityCodeFromIdExample,
  entityCodeFromIdValue,
} from "./entity-prefixes.js";

describe("[audit] entityCodeFromIdValue", () => {
  it.each(Object.entries(ENTITY_PREFIX_MAP))("maps %s_<uuid> → %s", (prefix, expected) => {
    expect(entityCodeFromIdValue(`${prefix}_550e8400e29b41d4a716446655440000`)).toBe(expected);
  });

  it("returns undefined for an unknown prefix", () => {
    expect(entityCodeFromIdValue("zzz_550e8400e29b41d4a716446655440000")).toBeUndefined();
  });

  it("returns undefined for a value without an underscore separator", () => {
    expect(entityCodeFromIdValue("notaprefix")).toBeUndefined();
  });

  it("returns undefined for an empty string", () => {
    expect(entityCodeFromIdValue("")).toBeUndefined();
  });
});

describe("[audit] entityCodeFromIdExample", () => {
  it("handles plain string examples (ofr_…)", () => {
    expect(entityCodeFromIdExample("ofr_550e8400e29b41d4a716446655440000")).toBe("OFFER");
  });

  it("handles JSON array examples (programIds)", () => {
    expect(entityCodeFromIdExample('["prog_550e8400e29b41d4a716446655440000"]')).toBe("PROGRAM");
  });

  it("handles whitespace-padded examples", () => {
    expect(entityCodeFromIdExample("  meta_550e8400e29b41d4a716446655440000  ")).toBe("METADATA");
  });

  it("returns undefined for undefined input", () => {
    expect(entityCodeFromIdExample(undefined)).toBeUndefined();
  });

  it("returns undefined for malformed JSON arrays", () => {
    expect(entityCodeFromIdExample("[not-json")).toBeUndefined();
  });

  it("returns undefined for an empty array", () => {
    expect(entityCodeFromIdExample("[]")).toBeUndefined();
  });
});

describe("[audit] entityCodeFromIdValue warn-once on unknown prefix", () => {
  beforeEach(() => {
    __resetWarnedUnknownPrefixes();
  });

  it("emits a console.warn the first time an unknown prefix is encountered", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    entityCodeFromIdValue("zzz_550e8400");
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toMatch(/zzz/);
    warn.mockRestore();
  });

  it("suppresses subsequent warnings for the same unknown prefix", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    entityCodeFromIdValue("zzz_aaa");
    entityCodeFromIdValue("zzz_bbb");
    entityCodeFromIdValue("zzz_ccc");
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it("warns again for a different unknown prefix", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    entityCodeFromIdValue("zzz_aaa");
    entityCodeFromIdValue("yyy_bbb");
    expect(warn).toHaveBeenCalledTimes(2);
    warn.mockRestore();
  });

  it("does not warn for known prefixes", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    entityCodeFromIdValue("ofr_550e8400");
    entityCodeFromIdValue("prog_550e8400");
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});
