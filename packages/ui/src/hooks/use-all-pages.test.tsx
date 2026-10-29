import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { useAllPages } from "./use-all-pages";

function wrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  return Wrapper;
}

function pagedResponse(page: number, totalPages: number) {
  return {
    data: {
      content: [`row-${page}-a`, `row-${page}-b`],
      pageNumber: page,
      totalPages,
    },
  };
}

describe("useAllPages", () => {
  it("walks every page at size 100 and stays loading until the last one lands", async () => {
    const fetchPage = vi.fn((page: number) => Promise.resolve(pagedResponse(page, 3)));
    const { result } = renderHook(
      () => useAllPages<string>({ queryKey: ["rows"], fetchPage, source: "test" }),
      { wrapper: wrapper() }
    );

    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(fetchPage.mock.calls).toEqual([
      [0, 100],
      [1, 100],
      [2, 100],
    ]);
    expect(result.current.items).toEqual([
      "row-0-a",
      "row-0-b",
      "row-1-a",
      "row-1-b",
      "row-2-a",
      "row-2-b",
    ]);
    expect(result.current.isError).toBe(false);
  });

  it("stops and reports an error when a page fails, keeping the rows it has", async () => {
    const fetchPage = vi.fn((page: number) =>
      page === 1 ? Promise.reject(new Error("boom")) : Promise.resolve(pagedResponse(page, 3))
    );
    const { result } = renderHook(
      () => useAllPages<string>({ queryKey: ["rows-error"], fetchPage, source: "test" }),
      { wrapper: wrapper() }
    );

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.isLoading).toBe(false);
    expect(result.current.items).toEqual(["row-0-a", "row-0-b"]);
  });

  it("lets a caller turn off retries the QueryClient would otherwise make", async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: 2, retryDelay: 0 } },
    });
    function RetryWrapper({ children }: { children: ReactNode }) {
      return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    }
    const fetchPage = vi.fn(() => Promise.reject(new Error("forbidden")));
    const { result } = renderHook(
      () =>
        useAllPages<string>({
          queryKey: ["rows-no-retry"],
          fetchPage,
          retry: false,
          source: "test",
        }),
      { wrapper: RetryWrapper }
    );

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });

  it("fetches nothing while disabled", () => {
    const fetchPage = vi.fn();
    const { result } = renderHook(
      () =>
        useAllPages<string>({ queryKey: ["rows-off"], fetchPage, source: "test", enabled: false }),
      { wrapper: wrapper() }
    );

    expect(fetchPage).not.toHaveBeenCalled();
    expect(result.current.isLoading).toBe(false);
  });
});
