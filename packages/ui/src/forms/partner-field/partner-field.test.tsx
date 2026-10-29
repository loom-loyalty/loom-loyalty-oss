import { setApiBaseUrl } from "@loom-loyalty/sdk";
import { HttpResponse, http, paginatedListHandler, setupServer } from "@loom-loyalty/test-utils";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { createQueryWrapper } from "../../test/query-client-wrapper";
import { usePartnerField } from "./use-partner-field";

const API_BASE = "https://api.test";
setApiBaseUrl(API_BASE);

interface PartnerLike {
  partnerId: string;
  name: string;
  code: string;
}

const PARTNERS: PartnerLike[] = Array.from({ length: 137 }, (_, i) => ({
  partnerId: `partner-${i}`,
  name: `Partner ${i}`,
  code: `P${String(i).padStart(3, "0")}`,
}));

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("[audit] usePartnerField paginated wrapper", () => {
  beforeEach(() => {
    server.use(paginatedListHandler({ url: `${API_BASE}/partners`, items: PARTNERS }));
  });

  it("fetches the first page on mount with the default page size", async () => {
    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => usePartnerField(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.partners).toHaveLength(50);
    expect(result.current.totalLoaded).toBe(50);
    expect(result.current.totalAvailable).toBe(137);
    expect(result.current.hasNextPage).toBe(true);
  });

  it("respects a caller-supplied pageSize", async () => {
    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => usePartnerField({ pageSize: 25 }), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.partners).toHaveLength(25);
  });

  it("fetchNextPage loads page 1 and concatenates", async () => {
    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => usePartnerField(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.partners).toHaveLength(50));

    act(() => {
      result.current.fetchNextPage();
    });

    await waitFor(() => expect(result.current.partners).toHaveLength(100));
    expect(result.current.partners[50]?.partnerId).toBe("partner-50");
  });

  it("flips hasNextPage to false on the last page", async () => {
    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => usePartnerField(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.partners).toHaveLength(50));
    act(() => result.current.fetchNextPage());
    await waitFor(() => expect(result.current.partners).toHaveLength(100));
    act(() => result.current.fetchNextPage());
    await waitFor(() => expect(result.current.partners).toHaveLength(137));

    expect(result.current.hasNextPage).toBe(false);
  });

  it("debounces search and applies a client-side substring filter on name+code", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => usePartnerField(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.partners).toHaveLength(50));

    act(() => result.current.setSearchValue("a"));
    act(() => result.current.setSearchValue("ab"));
    act(() => result.current.setSearchValue("abc"));
    act(() => result.current.setSearchValue("Partner 1"));

    expect(result.current.options).toHaveLength(50);

    await act(async () => {
      vi.advanceTimersByTime(250);
    });

    await waitFor(() =>
      expect(result.current.options.every((o) => o.name.startsWith("Partner 1"))).toBe(true)
    );

    expect(result.current.searchValue).toBe("Partner 1");
    vi.useRealTimers();
  });

  it("filter also matches by code", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => usePartnerField(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.partners).toHaveLength(50));

    act(() => result.current.setSearchValue("P017"));
    await act(async () => {
      vi.advanceTimersByTime(250);
    });

    await waitFor(() => expect(result.current.options).toHaveLength(1));
    expect(result.current.options[0]?.id).toBe("partner-17");
    vi.useRealTimers();
  });

  it("maps partners to EntityOption preserving secondaryText (code) and skipping null ids", async () => {
    server.use(
      paginatedListHandler({
        url: `${API_BASE}/partners`,
        items: [
          { partnerId: "p1", name: "Acme", code: "ACME" },
          { partnerId: null as unknown as string, name: "No-id", code: "X" },
        ],
      })
    );
    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => usePartnerField(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.partners).toHaveLength(2));
    expect(result.current.options).toEqual([{ id: "p1", name: "Acme", secondaryText: "ACME" }]);
  });

  it("surfaces an SDK error as error: Error and keeps options empty", async () => {
    server.use(
      http.get(`${API_BASE}/partners`, () =>
        HttpResponse.json(
          { success: false, errors: [{ code: "ERR_BOOM", message: "boom" }] },
          { status: 400 }
        )
      )
    );
    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => usePartnerField(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.options).toEqual([]);
    expect(result.current.partners).toEqual([]);
  });
});
