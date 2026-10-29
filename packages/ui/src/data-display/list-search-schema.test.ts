import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  cleanListSearch,
  decodeListSearch,
  formatSort,
  listSearchSchema,
  parseSort,
  type ListSearchSchemaSpec,
} from "./list-search-schema";

const SPEC: ListSearchSchemaSpec = {
  filters: {
    type: { type: "single", values: ["COUPON", "EXTERNAL"] },
    status: { type: "multi", values: ["ACTIVE", "DRAFT", "ARCHIVED"] },
  },
  sortableColumns: ["name", "createdAt"],
  defaultSort: "createdAt:desc",
  defaultPageSize: 25,
};

describe("cleanListSearch", () => {
  it("returns an empty object for empty input", () => {
    expect(cleanListSearch(SPEC, {})).toEqual({});
  });

  it("strips params equal to their defaults", () => {
    expect(cleanListSearch(SPEC, { q: "", page: 1, size: 25, sort: "createdAt:desc" })).toEqual({});
  });

  it("keeps non-default known params", () => {
    expect(cleanListSearch(SPEC, { q: "foo", page: 3, size: 50, sort: "name:asc" })).toEqual({
      q: "foo",
      page: 3,
      size: 50,
      sort: "name:asc",
    });
  });

  it("passes through unknown keys (e.g. detail deep-links)", () => {
    expect(cleanListSearch(SPEC, { detail: "offer_123", page: 1 })).toEqual({
      detail: "offer_123",
    });
  });

  it("coerces string-encoded numbers and drops non-numeric page", () => {
    expect(cleanListSearch(SPEC, { page: "4" })).toEqual({ page: 4 });
    expect(cleanListSearch(SPEC, { page: "abc" })).toEqual({});
    expect(cleanListSearch(SPEC, { page: 0 })).toEqual({});
    expect(cleanListSearch(SPEC, { page: -2 })).toEqual({});
  });

  it("drops invalid sort values", () => {
    expect(cleanListSearch(SPEC, { sort: "name:sideways" })).toEqual({});
    expect(cleanListSearch(SPEC, { sort: "unknownCol:asc" })).toEqual({});
    expect(cleanListSearch(SPEC, { sort: "name" })).toEqual({});
    expect(cleanListSearch(SPEC, { sort: "name:asc" })).toEqual({ sort: "name:asc" });
  });

  it("validates single-filter values against the allow-list", () => {
    expect(cleanListSearch(SPEC, { type: "COUPON" })).toEqual({ type: "COUPON" });
    expect(cleanListSearch(SPEC, { type: "BOGUS" })).toEqual({});
  });

  it("normalizes multi filters from arrays and comma strings to a sorted canonical form", () => {
    expect(cleanListSearch(SPEC, { status: ["DRAFT", "ACTIVE"] })).toEqual({
      status: "ACTIVE,DRAFT",
    });
    expect(cleanListSearch(SPEC, { status: "DRAFT,ACTIVE" })).toEqual({
      status: "ACTIVE,DRAFT",
    });
  });

  it("drops disallowed and duplicate multi values", () => {
    expect(cleanListSearch(SPEC, { status: "ACTIVE,ZED,ACTIVE" })).toEqual({ status: "ACTIVE" });
  });

  it("strips a multi filter equal to its default set regardless of order", () => {
    const spec: ListSearchSchemaSpec = {
      filters: { status: { type: "multi", values: ["A", "B"], default: ["A", "B"] } },
    };
    expect(cleanListSearch(spec, { status: "B,A" })).toEqual({});
    expect(cleanListSearch(spec, { status: "A" })).toEqual({ status: "A" });
  });

  it("strips a single filter equal to its non-empty default", () => {
    const spec: ListSearchSchemaSpec = {
      filters: { scope: { type: "single", values: ["all", "mine"], default: "all" } },
    };
    expect(cleanListSearch(spec, { scope: "all" })).toEqual({});
    expect(cleanListSearch(spec, { scope: "mine" })).toEqual({ scope: "mine" });
  });

  it("respects a custom default page size", () => {
    const spec: ListSearchSchemaSpec = { defaultPageSize: 50 };
    expect(cleanListSearch(spec, { size: 50 })).toEqual({});
    expect(cleanListSearch(spec, { size: 25 })).toEqual({ size: 25 });
  });

  it("is idempotent", () => {
    const raw = {
      q: "foo",
      page: 2,
      sort: "name:asc",
      type: "COUPON",
      status: "DRAFT,ACTIVE",
      detail: "x",
    };
    const once = cleanListSearch(SPEC, raw);
    expect(cleanListSearch(SPEC, once)).toEqual(once);
  });
});

describe("listSearchSchema", () => {
  it("returns a validateSearch function equivalent to cleanListSearch", () => {
    const validate = listSearchSchema(SPEC);
    expect(validate({ q: "hi", page: 1, detail: "d" })).toEqual({ q: "hi", detail: "d" });
  });

  it("tolerates undefined input", () => {
    const validate = listSearchSchema(SPEC);
    expect(validate(undefined as unknown as Record<string, unknown>)).toEqual({});
  });
});

describe("decodeListSearch", () => {
  it("fills all defaults from an empty search", () => {
    expect(decodeListSearch(SPEC, {})).toEqual({
      q: "",
      page: 1,
      size: 25,
      sort: "createdAt:desc",
      filters: { type: "", status: [] },
    });
  });

  it("round-trips a cleaned search back to the intended state", () => {
    const cleaned = cleanListSearch(SPEC, {
      q: "promo",
      page: 2,
      size: 50,
      sort: "name:asc",
      type: "COUPON",
      status: "DRAFT,ACTIVE",
    });
    expect(decodeListSearch(SPEC, cleaned)).toEqual({
      q: "promo",
      page: 2,
      size: 50,
      sort: "name:asc",
      filters: { type: "COUPON", status: ["ACTIVE", "DRAFT"] },
    });
  });

  it("falls back to defaults for invalid hand-edited values", () => {
    const state = decodeListSearch(SPEC, { sort: "bad:dir", type: "NOPE", page: "x" });
    expect(state.sort).toBe("createdAt:desc");
    expect(state.filters.type).toBe("");
    expect(state.page).toBe(1);
  });

  it("returns multi-filter defaults when absent", () => {
    const spec: ListSearchSchemaSpec = {
      filters: { status: { type: "multi", values: ["A", "B"], default: ["A"] } },
    };
    expect(decodeListSearch(spec, {}).filters.status).toEqual(["A"]);
  });
});

describe("page size limit", () => {
  it("caps a URL size above the API limit at 100 in both the cleaned URL and the decoded state", () => {
    expect(cleanListSearch(SPEC, { size: 500 })).toEqual({ size: 100 });
    expect(decodeListSearch(SPEC, { size: 500 }).size).toBe(100);
  });

  it("keeps sizes at or under the limit", () => {
    expect(decodeListSearch(SPEC, { size: 50 }).size).toBe(50);
    expect(decodeListSearch(SPEC, { size: 100 }).size).toBe(100);
  });
});

describe("parseSort / formatSort", () => {
  it("parses a valid sort string", () => {
    expect(parseSort("name:asc", ["name"])).toEqual({ column: "name", direction: "asc" });
  });

  it("rejects invalid or out-of-allow-list sorts", () => {
    expect(parseSort("name:sideways", ["name"])).toBeUndefined();
    expect(parseSort("other:asc", ["name"])).toBeUndefined();
    expect(parseSort(undefined)).toBeUndefined();
  });

  it("formats a sort state", () => {
    expect(formatSort({ column: "createdAt", direction: "desc" })).toBe("createdAt:desc");
  });
});

describe("cleanListSearch drop warnings", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it("warns when a single-filter value is dropped", () => {
    cleanListSearch(SPEC, { type: "BOGUS" });
    expect(warnSpy).toHaveBeenCalledTimes(1);
    const msg = warnSpy.mock.calls[0]?.[0] as string;
    expect(msg).toContain("BOGUS");
    expect(msg).toContain("type");
  });

  it("warns once per multi-filter key, listing all invalid values without duplicates", () => {
    cleanListSearch(SPEC, { status: "ACTIVE,ZED,OOPS,ZED" });
    expect(warnSpy).toHaveBeenCalledTimes(1);
    const msg = warnSpy.mock.calls[0]?.[0] as string;
    expect(msg).toContain("ZED");
    expect(msg).toContain("OOPS");
    expect(msg).toContain("status");
    // Duplicate bad value collapsed.
    expect(msg.match(/ZED/g)?.length).toBe(1);
  });

  it("warns with the full sort token when the direction is invalid", () => {
    cleanListSearch(SPEC, { sort: "name:sideways" });
    expect(warnSpy).toHaveBeenCalledTimes(1);
    const msg = warnSpy.mock.calls[0]?.[0] as string;
    expect(msg).toContain("name:sideways");
    expect(msg).toContain("sort");
  });

  it("warns when sort is rejected", () => {
    cleanListSearch(SPEC, { sort: "unknownCol:asc" });
    expect(warnSpy).toHaveBeenCalledTimes(1);
    const msg = warnSpy.mock.calls[0]?.[0] as string;
    expect(msg).toContain("unknownCol:asc");
    expect(msg).toContain("sort");
  });

  it("stays silent on clean values", () => {
    cleanListSearch(SPEC, {
      q: "foo",
      page: 2,
      sort: "name:asc",
      type: "COUPON",
      status: "ACTIVE,DRAFT",
    });
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("stays silent when decodeListSearch reads invalid values", () => {
    decodeListSearch(SPEC, { type: "NOPE", sort: "bad:dir" });
    expect(warnSpy).not.toHaveBeenCalled();
  });
});

describe("disableQ", () => {
  const NO_Q_SPEC: ListSearchSchemaSpec = { ...SPEC, disableQ: true };

  it("cleanListSearch strips a stale ?q= when disableQ is set", () => {
    expect(cleanListSearch(NO_Q_SPEC, { q: "ghost-search" })).toEqual({});
  });

  it("cleanListSearch preserves q by default", () => {
    expect(cleanListSearch(SPEC, { q: "still-searching" })).toEqual({ q: "still-searching" });
  });

  it("decodeListSearch returns an empty q string when disableQ is set", () => {
    expect(decodeListSearch(NO_Q_SPEC, { q: "ghost-search" }).q).toBe("");
  });

  it("decodeListSearch preserves q by default", () => {
    expect(decodeListSearch(SPEC, { q: "still-searching" }).q).toBe("still-searching");
  });

  it("disableQ does not affect filters / sort / pagination", () => {
    expect(cleanListSearch(NO_Q_SPEC, { q: "x", type: "COUPON", page: 2 })).toEqual({
      type: "COUPON",
      page: 2,
    });
  });
});
