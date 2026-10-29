// The badge field's `loadAll` path: a consumer that must ground against EVERY badge
// (the NL → reward generator validating a `badgeCode`) auto-advances through all pages
// instead of stopping at page 1. Without it, a real badge on page 2 would be absent and
// wrongly rejected. Mocks the SDK list endpoint with a 2-page response.

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const listMock = vi.fn();

// Preserve the SDK's other exports (importActual) and override only the two symbols
// use-badge-field calls, so a future added import isn't silently dropped by the mock.
vi.mock("@loom-loyalty/sdk", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  customerStatusManagementListBadges: (args: { page: number; size: number }) => listMock(args),
  getCustomerStatusManagementListBadgesQueryKey: () => ["badges-list"],
}));

import { useBadgeField } from "./use-badge-field";

// Module-level so the named Wrapper (a display name keeps eslint happy) can read the
// per-test client that beforeEach swaps in.
let client: QueryClient;

function Wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function pageResult(n: number, badge: { badgeId: string; name: string; code: string }) {
  return { data: { content: [badge], pageNumber: n, totalPages: 2, totalSize: 2 } };
}

describe("useBadgeField — loadAll", () => {
  beforeEach(() => {
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    listMock.mockReset();
    listMock.mockImplementation(({ page }: { page: number }) =>
      Promise.resolve(
        page === 0
          ? pageResult(0, { badgeId: "b1", name: "One", code: "ONE" })
          : pageResult(1, { badgeId: "b2", name: "Two", code: "TWO" })
      )
    );
  });

  afterEach(() => {
    client.clear();
  });

  it("auto-advances through every page and loads all badges", async () => {
    const { result } = renderHook(() => useBadgeField({ loadAll: true }), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.optionsAll).toHaveLength(2);
      expect(result.current.isLoadingAll).toBe(false);
    });
    expect(result.current.hasNextPage).toBe(false);
    // Both pages were requested.
    expect(listMock).toHaveBeenCalledWith({ page: 0, size: 50 });
    expect(listMock).toHaveBeenCalledWith({ page: 1, size: 50 });
    // The code (used for grounding) is read from the badge `code`, via secondaryText.
    expect(result.current.optionsAll.map((o) => o.secondaryText)).toEqual(["ONE", "TWO"]);
  });

  it("loads only the first page without loadAll (default picker behavior unchanged)", async () => {
    const { result } = renderHook(() => useBadgeField(), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.optionsAll).toHaveLength(1);
    });
    // A second page exists but is NOT auto-fetched — the picker lazy-loads on scroll.
    expect(result.current.hasNextPage).toBe(true);
    expect(result.current.isLoadingAll).toBe(false);
    expect(listMock).toHaveBeenCalledTimes(1);
    expect(listMock).toHaveBeenCalledWith({ page: 0, size: 50 });
  });

  it("reports isLoadingAll true between pages, then false once complete", async () => {
    // Hold page 1 so the between-pages window is deterministic: the submit gate relies on
    // isLoadingAll being true while later pages are still loading.
    let releasePage1: () => void = () => {};
    const page1 = new Promise<void>((r) => {
      releasePage1 = r;
    });
    listMock.mockImplementation(({ page }: { page: number }) =>
      page === 0
        ? Promise.resolve(pageResult(0, { badgeId: "b1", name: "One", code: "ONE" }))
        : page1.then(() => pageResult(1, { badgeId: "b2", name: "Two", code: "TWO" }))
    );
    const { result } = renderHook(() => useBadgeField({ loadAll: true }), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.optionsAll).toHaveLength(1));
    expect(result.current.isLoadingAll).toBe(true);

    releasePage1();
    await waitFor(() => {
      expect(result.current.optionsAll).toHaveLength(2);
      expect(result.current.isLoadingAll).toBe(false);
    });
  });

  it("converges cleanly for a program with no badges", async () => {
    listMock.mockReset();
    listMock.mockResolvedValue({
      data: { content: [], pageNumber: 0, totalPages: 1, totalSize: 0 },
    });
    const { result } = renderHook(() => useBadgeField({ loadAll: true }), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.optionsAll).toEqual([]);
    expect(result.current.isLoadingAll).toBe(false);
    expect(result.current.hasNextPage).toBe(false);
    expect(listMock).toHaveBeenCalledTimes(1);
  });

  it("stops and clears isLoadingAll when a later page errors (no stuck gate)", async () => {
    listMock.mockReset();
    listMock.mockImplementation(({ page }: { page: number }) =>
      page === 0
        ? Promise.resolve(pageResult(0, { badgeId: "b1", name: "One", code: "ONE" }))
        : Promise.reject(new Error("page 1 failed"))
    );
    const { result } = renderHook(() => useBadgeField({ loadAll: true }), { wrapper: Wrapper });

    // Page 0 loads, page 1 errors. hasNextPage stays true, but isError halts load-all so
    // isLoadingAll clears (the submit gate releases) rather than hanging forever. Without
    // the fix this waitFor times out because isLoadingAll sticks true.
    await waitFor(() => {
      expect(result.current.optionsAll).toHaveLength(1);
      expect(result.current.isLoadingAll).toBe(false);
    });
    // The error is surfaced, so the reward step's fetchContext omits the (partial) badge
    // list and falls back to prompt-only grounding.
    expect(result.current.error).not.toBeNull();
    expect(result.current.hasNextPage).toBe(true);
  });
});
