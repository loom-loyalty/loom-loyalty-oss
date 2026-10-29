import { QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  __resetInfiniteQueryWarnDedupe,
  getInfiniteNextPageParam,
  resetInfiniteQueryToFirstPage,
  warnIfMissingTotalPages,
} from "./infinite-query-helpers";

beforeEach(() => {
  __resetInfiniteQueryWarnDedupe();
});

describe("[audit] warnIfMissingTotalPages", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;
  const originalEnv = process.env.NODE_ENV;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    process.env.NODE_ENV = "development";
  });

  afterEach(() => {
    warnSpy.mockRestore();
    process.env.NODE_ENV = originalEnv;
  });

  it("warns when totalPages is missing from a paged payload", () => {
    warnIfMissingTotalPages({ pageNumber: 0, content: [] }, "test-wrapper");
    expect(warnSpy).toHaveBeenCalledTimes(1);
    const message = warnSpy.mock.calls[0]?.[0] as string;
    expect(message).toContain("test-wrapper");
    expect(message).toContain("totalPages");
  });

  it("does not warn when totalPages is present", () => {
    warnIfMissingTotalPages({ pageNumber: 0, totalPages: 1, content: [] }, "test-wrapper");
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("does not warn when totalPages is present and zero", () => {
    warnIfMissingTotalPages({ pageNumber: 0, totalPages: 0, content: [] }, "test-wrapper");
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("does not warn when payload is undefined", () => {
    warnIfMissingTotalPages(undefined, "test-wrapper");
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("does not warn in production", () => {
    process.env.NODE_ENV = "production";
    warnIfMissingTotalPages({ pageNumber: 0, content: [] }, "test-wrapper");
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("warns only once per source per session", () => {
    warnIfMissingTotalPages({ pageNumber: 0, content: [] }, "dedupe-wrapper");
    warnIfMissingTotalPages({ pageNumber: 1, content: [] }, "dedupe-wrapper");
    warnIfMissingTotalPages({ pageNumber: 2, content: [] }, "dedupe-wrapper");
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });
});

describe("[audit] getInfiniteNextPageParam", () => {
  const originalEnv = process.env.NODE_ENV;

  beforeEach(() => {
    process.env.NODE_ENV = "development";
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    vi.restoreAllMocks();
  });

  it("returns next page number when more pages exist", () => {
    const result = getInfiniteNextPageParam(
      { data: { content: [], pageNumber: 0, totalPages: 3 } },
      "test"
    );
    expect(result).toBe(1);
  });

  it("returns undefined when on last page", () => {
    const result = getInfiniteNextPageParam(
      { data: { content: [], pageNumber: 2, totalPages: 3 } },
      "test"
    );
    expect(result).toBeUndefined();
  });

  it("returns undefined for array payloads (legacy non-paged endpoints)", () => {
    const result = getInfiniteNextPageParam({ data: [] as unknown[] }, "test");
    expect(result).toBeUndefined();
  });

  it("returns undefined when payload is undefined", () => {
    const result = getInfiniteNextPageParam({ data: undefined }, "test");
    expect(result).toBeUndefined();
  });

  it("returns undefined and warns when totalPages is missing", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const result = getInfiniteNextPageParam(
      { data: { content: [], pageNumber: 0 } as { content: unknown[]; pageNumber: number } },
      "missing-totalpages-wrapper"
    );
    expect(result).toBeUndefined();
    expect(warnSpy).toHaveBeenCalled();
    expect(warnSpy.mock.calls[0]?.[0]).toContain("missing-totalpages-wrapper");
  });
});

describe("[audit] resetInfiniteQueryToFirstPage", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  });

  afterEach(() => {
    queryClient.clear();
  });

  it("trims pages to first when multiple pages are cached", () => {
    queryClient.setQueryData(["foo"], {
      pages: [{ id: 0 }, { id: 1 }, { id: 2 }],
      pageParams: [0, 1, 2],
    });

    resetInfiniteQueryToFirstPage(queryClient, ["foo"]);

    const after = queryClient.getQueryData(["foo"]) as {
      pages: Array<{ id: number }>;
      pageParams: number[];
    };
    expect(after.pages).toHaveLength(1);
    expect(after.pages[0]).toEqual({ id: 0 });
    expect(after.pageParams).toEqual([0]);
  });

  it("leaves single-page cache entries unchanged", () => {
    queryClient.setQueryData(["foo"], {
      pages: [{ id: 0 }],
      pageParams: [0],
    });

    resetInfiniteQueryToFirstPage(queryClient, ["foo"]);

    const after = queryClient.getQueryData(["foo"]) as { pages: Array<{ id: number }> };
    expect(after.pages).toHaveLength(1);
  });

  it("trims every cache entry matching the key prefix (multiple search variants)", () => {
    queryClient.setQueryData(["foo", { search: "a" }], {
      pages: [{ id: 0 }, { id: 1 }],
      pageParams: [0, 1],
    });
    queryClient.setQueryData(["foo", { search: "b" }], {
      pages: [{ id: 0 }, { id: 1 }, { id: 2 }],
      pageParams: [0, 1, 2],
    });
    queryClient.setQueryData(["bar"], {
      pages: [{ id: 0 }, { id: 1 }],
      pageParams: [0, 1],
    });

    resetInfiniteQueryToFirstPage(queryClient, ["foo"]);

    expect(
      (queryClient.getQueryData(["foo", { search: "a" }]) as { pages: unknown[] }).pages
    ).toHaveLength(1);
    expect(
      (queryClient.getQueryData(["foo", { search: "b" }]) as { pages: unknown[] }).pages
    ).toHaveLength(1);
    expect((queryClient.getQueryData(["bar"]) as { pages: unknown[] }).pages).toHaveLength(2);
  });

  it("is a no-op when the cache has no matching entries", () => {
    expect(() => resetInfiniteQueryToFirstPage(queryClient, ["missing"])).not.toThrow();
  });

  it("does not crash when a plain (non-infinite) query shares the same key prefix", () => {
    // Reproduces a real crash: a plain useQuery cache entry (e.g. a paginated
    // list query on the same page, same base resource) can share a key
    // prefix with an infinite query's cache entry. Its cached shape has no
    // `.pages` array, so the updater must not assume every matched entry is
    // infinite-shaped.
    queryClient.setQueryData(["foo", { page: 0, size: 500 }], {
      data: { content: [{ id: 0 }], pageNumber: 0, totalPages: 1, totalSize: 1 },
      status: 200,
    });
    queryClient.setQueryData(["foo", { mode: "infinite", pageSize: 100 }], {
      pages: [{ id: 0 }, { id: 1 }],
      pageParams: [0, 1],
    });

    expect(() => resetInfiniteQueryToFirstPage(queryClient, ["foo"])).not.toThrow();

    // The plain query's cache entry is left completely untouched.
    expect(queryClient.getQueryData(["foo", { page: 0, size: 500 }])).toEqual({
      data: { content: [{ id: 0 }], pageNumber: 0, totalPages: 1, totalSize: 1 },
      status: 200,
    });
    // The genuinely infinite entry is still trimmed as expected.
    expect(
      (
        queryClient.getQueryData(["foo", { mode: "infinite", pageSize: 100 }]) as {
          pages: unknown[];
        }
      ).pages
    ).toHaveLength(1);
  });
});
