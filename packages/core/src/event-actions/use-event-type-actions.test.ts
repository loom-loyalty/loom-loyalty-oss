import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useEventTypeActions } from "./use-event-type-actions";

const sdkMock = vi.hoisted(() => ({
  useEventEngineManagementListEventTypeActions: vi.fn(),
}));

vi.mock("@loom-loyalty/sdk", () => sdkMock);

function mockResponse(data: unknown, status = 200) {
  sdkMock.useEventEngineManagementListEventTypeActions.mockReturnValue({
    data: { status, data },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useEventTypeActions", () => {
  it("yields an empty list when the envelope omits its content key", () => {
    // Micronaut Data omits `content` entirely when totalSize is 0. An absent
    // key, not an empty array. The care surface returns exactly this on an
    // organization with no registrations, so it must not throw.
    mockResponse({ totalSize: 0 });

    const { result } = renderHook(() => useEventTypeActions({ surface: "CUSTOMER_CARE" }));

    expect(result.current.actions).toEqual([]);
    expect(result.current.totalSize).toBe(0);
  });

  it("returns registry rows unchanged", () => {
    const rows = [
      { eventTypeCode: "transaction", eventTypeActionId: "eta_a", surfaces: ["CUSTOMER_CARE"] },
      { eventTypeCode: "hotel.stay", eventTypeActionId: "eta_b", surfaces: ["CUSTOMER_CARE"] },
    ];
    mockResponse({ content: rows, totalSize: 2 });

    const { result } = renderHook(() => useEventTypeActions({ surface: "CUSTOMER_CARE" }));

    expect(result.current.actions).toEqual(rows);
    expect(result.current.totalSize).toBe(2);
  });

  it("passes the search term to the query rather than filtering after fetch", () => {
    mockResponse({ content: [], totalSize: 0 });

    renderHook(() =>
      useEventTypeActions({ surface: "CUSTOMER_CARE", search: "stay", matchMode: "CONTAINS" })
    );

    const [params] = sdkMock.useEventEngineManagementListEventTypeActions.mock.calls[0] ?? [];
    expect(params).toMatchObject({
      surface: "CUSTOMER_CARE",
      search: "stay",
      matchMode: "CONTAINS",
    });
  });

  it("omits search and matchMode entirely when no term is supplied", () => {
    mockResponse({ content: [], totalSize: 0 });

    renderHook(() => useEventTypeActions({ surface: "CUSTOMER_CARE" }));

    const [params] = sdkMock.useEventEngineManagementListEventTypeActions.mock.calls[0] ?? [];
    expect(params).not.toHaveProperty("search");
    expect(params).not.toHaveProperty("matchMode");
  });

  it("sends NO sort by default", () => {
    // The endpoint's sort syntax is `field:asc` / `field:desc`; a bare field
    // name is a 400. Consumers group the list themselves and unsorted responses
    // come back newest-first with a stable tiebreak, so there is nothing to gain
    // from sending one, and a malformed one silently empties the picker.
    mockResponse({ content: [], totalSize: 0 });

    renderHook(() => useEventTypeActions({ surface: "CUSTOMER_CARE" }));

    const [params] = sdkMock.useEventEngineManagementListEventTypeActions.mock.calls[0] ?? [];
    expect(params).not.toHaveProperty("sort");
  });

  it("passes an explicit sort through unchanged", () => {
    mockResponse({ content: [], totalSize: 0 });

    renderHook(() => useEventTypeActions({ surface: "CUSTOMER_CARE", sort: "eventTypeCode:asc" }));

    const [params] = sdkMock.useEventEngineManagementListEventTypeActions.mock.calls[0] ?? [];
    expect(params).toMatchObject({ sort: "eventTypeCode:asc" });
  });

  it("requests the surface it was asked for", () => {
    mockResponse({ content: [], totalSize: 0 });

    renderHook(() => useEventTypeActions({ surface: "DEVELOPER" }));

    const [params] = sdkMock.useEventEngineManagementListEventTypeActions.mock.calls[0] ?? [];
    expect(params).toMatchObject({ surface: "DEVELOPER" });
  });

  it("treats a non-200 response as an empty list rather than reading its body", () => {
    mockResponse(undefined, 403);

    const { result } = renderHook(() => useEventTypeActions({ surface: "CUSTOMER_CARE" }));

    expect(result.current.actions).toEqual([]);
    expect(result.current.totalSize).toBe(0);
  });

  it("does not report loading while disabled", () => {
    sdkMock.useEventEngineManagementListEventTypeActions.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      refetch: vi.fn(),
    });

    const { result } = renderHook(() =>
      useEventTypeActions({ surface: "CUSTOMER_CARE", enabled: false })
    );

    expect(result.current.isLoading).toBe(false);
  });
});
