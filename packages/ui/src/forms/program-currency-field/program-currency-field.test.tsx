import { setApiBaseUrl } from "@loom-loyalty/sdk";
import { HttpResponse, http, paginatedListHandler, setupServer } from "@loom-loyalty/test-utils";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { createQueryWrapper } from "../../test/query-client-wrapper";
import { useProgramCurrencyField } from "./use-program-currency-field";

const API_BASE = "https://api.test";
setApiBaseUrl(API_BASE);

interface CurrencyLike {
  code: string;
  name: string;
  programIds?: string[];
}

const CURRENCIES: CurrencyLike[] = [
  // permissive fallback: undefined programIds → belongs to all programs.
  // Placed at index 0 so it lands in the first page (pageSize 50 default).
  { code: "ANY", name: "Universal Currency" },
  ...Array.from({ length: 60 }, (_, i) => ({
    code: `C${String(i).padStart(3, "0")}`,
    name: `Currency ${i}`,
    programIds: i % 3 === 0 ? ["prog-A"] : ["prog-B"],
  })),
];

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("[audit] useProgramCurrencyField paginated wrapper", () => {
  beforeEach(() => {
    server.use(paginatedListHandler({ url: `${API_BASE}/program-currencies`, items: CURRENCIES }));
  });

  it("fetches all currencies when no programId is provided", async () => {
    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useProgramCurrencyField(undefined), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.totalLoaded).toBeGreaterThan(0));
    expect(result.current.currencies.some((c) => c.code === "ANY")).toBe(true);
    expect(result.current.currencies.some((c) => c.code === "C000")).toBe(true);
  });

  it("fetches and applies client-side programIds filter (prog-A)", async () => {
    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useProgramCurrencyField("prog-A"), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.totalLoaded).toBeGreaterThan(0));
    // Every loaded currency belongs to prog-A or has undefined programIds (permissive).
    for (const c of result.current.currencies) {
      const ok = !c.programIds || c.programIds.includes("prog-A");
      expect(ok).toBe(true);
    }
    // The "ANY" universal currency surfaces too because programIds is undefined.
    expect(result.current.currencies.some((c) => c.code === "ANY")).toBe(true);
  });

  it("paginates across pages — filter applies on each loaded page", async () => {
    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useProgramCurrencyField("prog-A"), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.totalLoaded).toBeGreaterThan(0));
    const before = result.current.totalLoaded;
    act(() => result.current.fetchNextPage());
    await waitFor(() => expect(result.current.totalLoaded).toBeGreaterThan(before));
    // All loaded items still match the filter.
    for (const c of result.current.currencies) {
      const ok = !c.programIds || c.programIds.includes("prog-A");
      expect(ok).toBe(true);
    }
  });

  it("debounces search and filters by name+code on top of the programId filter", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useProgramCurrencyField("prog-A"), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.totalLoaded).toBeGreaterThan(0));
    act(() => result.current.setSearchValue("Universal"));
    await act(async () => {
      vi.advanceTimersByTime(250);
    });
    await waitFor(() => expect(result.current.options).toHaveLength(1));
    expect(result.current.options[0]?.id).toBe("ANY");
    vi.useRealTimers();
  });

  it("hasNextPage flips false on the last page", async () => {
    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useProgramCurrencyField("prog-A"), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.totalLoaded).toBeGreaterThan(0));
    act(() => result.current.fetchNextPage());
    await waitFor(() => expect(result.current.hasNextPage).toBe(false));
  });

  it("surfaces SDK error", async () => {
    server.use(
      http.get(`${API_BASE}/program-currencies`, () =>
        HttpResponse.json(
          { success: false, errors: [{ code: "E", message: "x" }] },
          { status: 400 }
        )
      )
    );
    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useProgramCurrencyField("prog-A"), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.error).not.toBeNull());
  });
});
