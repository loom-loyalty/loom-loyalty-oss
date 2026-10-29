/**
 * CustomerAudienceField tests — mirrors program-field/program-field.test.tsx shape.
 *
 * Hook-level coverage: pagination, search debounce, lookup-set stability,
 * id-vs-code fallback, error surfacing. The render shape is a standard
 * EntitySelectBox-wrapping compound; the audit-side render assertion lives
 * in offer-form-sheet.test.tsx where this compound is wired.
 */

import { setApiBaseUrl } from "@loom-loyalty/sdk";
import { HttpResponse, http, paginatedListHandler, setupServer } from "@loom-loyalty/test-utils";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { createQueryWrapper } from "../../test/query-client-wrapper";
import { useCustomerAudienceField } from "./use-customer-audience-field";

const API_BASE = "https://api.test";
setApiBaseUrl(API_BASE);

interface AudienceLike {
  customerAudienceId: string | null;
  name: string;
  code: string;
}

const AUDIENCES: AudienceLike[] = Array.from({ length: 137 }, (_, i) => ({
  customerAudienceId: `aud_${i.toString(16).padStart(32, "0")}`,
  name: `Audience ${i}`,
  code: `AUD${String(i).padStart(3, "0")}`,
}));

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("[audit] useCustomerAudienceField paginated wrapper", () => {
  beforeEach(() => {
    server.use(paginatedListHandler({ url: `${API_BASE}/customer-audiences`, items: AUDIENCES }));
  });

  it("fetches the first page on mount", async () => {
    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useCustomerAudienceField(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.audiences).toHaveLength(50);
    expect(result.current.hasNextPage).toBe(true);
  });

  it("respects caller pageSize", async () => {
    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useCustomerAudienceField({ pageSize: 25 }), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.audiences).toHaveLength(25));
  });

  it("fetchNextPage concatenates", async () => {
    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useCustomerAudienceField(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.audiences).toHaveLength(50));
    act(() => result.current.fetchNextPage());
    await waitFor(() => expect(result.current.audiences).toHaveLength(100));
    expect(result.current.audiences[50]?.customerAudienceId).toBe(
      `aud_${(50).toString(16).padStart(32, "0")}`
    );
  });

  it("hasNextPage becomes false on the last page", async () => {
    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useCustomerAudienceField(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.audiences).toHaveLength(50));
    act(() => result.current.fetchNextPage());
    await waitFor(() => expect(result.current.audiences).toHaveLength(100));
    act(() => result.current.fetchNextPage());
    await waitFor(() => expect(result.current.audiences).toHaveLength(137));
    expect(result.current.hasNextPage).toBe(false);
  });

  it("debounces search at 250ms then filters by name+code", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useCustomerAudienceField(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.audiences).toHaveLength(50));

    act(() => result.current.setSearchValue("AUD017"));
    await act(async () => {
      vi.advanceTimersByTime(250);
    });

    await waitFor(() => expect(result.current.options).toHaveLength(1));
    expect(result.current.options[0]?.name).toBe("Audience 17");
    vi.useRealTimers();
  });

  it("optionsAll stays stable across search-term changes (trigger-label resolution)", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useCustomerAudienceField(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.audiences).toHaveLength(50));
    const initialAllCount = result.current.optionsAll.length;
    act(() => result.current.setSearchValue("AUD000"));
    await act(async () => {
      vi.advanceTimersByTime(250);
    });
    expect(result.current.options).toHaveLength(1);
    expect(result.current.optionsAll).toHaveLength(initialAllCount);
    vi.useRealTimers();
  });

  it("falls back to customer-audience code when customerAudienceId is missing", async () => {
    server.use(
      paginatedListHandler({
        url: `${API_BASE}/customer-audiences`,
        items: [{ customerAudienceId: null, name: "Code-only", code: "X" }],
      })
    );
    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useCustomerAudienceField(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.audiences).toHaveLength(1));
    expect(result.current.options[0]?.id).toBe("X");
  });

  it("surfaces SDK error and keeps options empty", async () => {
    server.use(
      http.get(`${API_BASE}/customer-audiences`, () =>
        HttpResponse.json(
          { success: false, errors: [{ code: "ERR", message: "boom" }] },
          { status: 400 }
        )
      )
    );
    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useCustomerAudienceField(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.options).toEqual([]);
  });
});
