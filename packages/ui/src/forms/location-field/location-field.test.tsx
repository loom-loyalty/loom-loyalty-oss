import { setApiBaseUrl } from "@loom-loyalty/sdk";
import { HttpResponse, http, paginatedListHandler, setupServer } from "@loom-loyalty/test-utils";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { createQueryWrapper } from "../../test/query-client-wrapper";
import { useLocationField } from "./use-location-field";

const API_BASE = "https://api.test";
setApiBaseUrl(API_BASE);

interface LocationLike {
  locationId: string;
  name: string;
  code: string;
}

const LOCATIONS: LocationLike[] = Array.from({ length: 137 }, (_, i) => ({
  locationId: `location-${i}`,
  name: `Location ${i}`,
  code: `L${String(i).padStart(3, "0")}`,
}));

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("[audit] useLocationField paginated wrapper", () => {
  beforeEach(() => {
    server.use(paginatedListHandler({ url: `${API_BASE}/locations`, items: LOCATIONS }));
  });

  it("fetches the first page on mount with the default page size", async () => {
    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useLocationField(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.locations).toHaveLength(50);
    expect(result.current.totalLoaded).toBe(50);
    expect(result.current.totalAvailable).toBe(137);
    expect(result.current.hasNextPage).toBe(true);
  });

  it("respects a caller-supplied pageSize", async () => {
    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useLocationField({ pageSize: 25 }), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.locations).toHaveLength(25);
  });

  it("fetchNextPage loads page 1 and concatenates", async () => {
    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useLocationField(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.locations).toHaveLength(50));

    act(() => {
      result.current.fetchNextPage();
    });

    await waitFor(() => expect(result.current.locations).toHaveLength(100));
    expect(result.current.locations[50]?.locationId).toBe("location-50");
  });

  it("flips hasNextPage to false on the last page", async () => {
    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useLocationField(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.locations).toHaveLength(50));
    act(() => result.current.fetchNextPage());
    await waitFor(() => expect(result.current.locations).toHaveLength(100));
    act(() => result.current.fetchNextPage());
    await waitFor(() => expect(result.current.locations).toHaveLength(137));

    expect(result.current.hasNextPage).toBe(false);
  });

  it("debounces search and applies a client-side substring filter on name+code", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useLocationField(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.locations).toHaveLength(50));

    act(() => result.current.setSearchValue("a"));
    act(() => result.current.setSearchValue("ab"));
    act(() => result.current.setSearchValue("abc"));
    act(() => result.current.setSearchValue("Location 1"));

    expect(result.current.options).toHaveLength(50);

    await act(async () => {
      vi.advanceTimersByTime(250);
    });

    await waitFor(() =>
      expect(result.current.options.every((o) => o.name.startsWith("Location 1"))).toBe(true)
    );

    expect(result.current.searchValue).toBe("Location 1");
    vi.useRealTimers();
  });

  it("auto-fetches remaining pages while a search is active, so a match beyond the first page is still found (code review finding)", async () => {
    // Real timers, not fake -- the debounce itself only needs one short real
    // wait, and the two chained auto-fetches after it (page 2, then page 3)
    // are real MSW round trips that don't need timer control at all.
    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useLocationField(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.locations).toHaveLength(50));
    expect(result.current.hasNextPage).toBe(true);

    // "Location 130" only exists on the third page (locations 100-136) --
    // without auto-fetching further pages, this search would silently find
    // nothing even though the location is real.
    act(() => result.current.setSearchValue("Location 130"));

    // Covers the debounce (250ms) plus two chained auto-fetches (page 2,
    // then page 3) before hasNextPage settles to false.
    await waitFor(() => expect(result.current.hasNextPage).toBe(false), { timeout: 5000 });
    await waitFor(() => expect(result.current.options).toHaveLength(1));
    expect(result.current.options[0]?.id).toBe("location-130");
  }, 10_000);

  it("stops auto-fetching at a fixed page cap rather than draining an arbitrarily large catalog (code review finding)", async () => {
    const manyLocations: LocationLike[] = Array.from({ length: 60 }, (_, i) => ({
      locationId: `location-${i}`,
      name: `Location ${i}`,
      code: `L${String(i).padStart(3, "0")}`,
    }));
    server.use(paginatedListHandler({ url: `${API_BASE}/locations`, items: manyLocations }));
    const { Wrapper } = createQueryWrapper();
    // pageSize 5 makes the fixed 10-page cap (50 locations) reachable
    // with a small, fast fixture instead of needing 500+ real items.
    const { result } = renderHook(() => useLocationField({ pageSize: 5 }), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.locations).toHaveLength(5));

    // "Location 55" sits at index 55 -- past the 50-location (10-page)
    // cap, so it must never be auto-fetched into view; "Location 5" sits
    // within the first page and stays reachable throughout.
    act(() => result.current.setSearchValue("Location 55"));

    // Give the auto-fetch chain time to run to completion (or to its cap)
    // -- there's nothing to waitFor here since staying capped means
    // nothing further changes.
    await new Promise((resolve) => setTimeout(resolve, 2000));

    expect(result.current.locations).toHaveLength(50);
    expect(result.current.hasNextPage).toBe(true);
    expect(result.current.options).toHaveLength(0);
  }, 10_000);

  it("does not auto-fetch further pages when idle (no active search) -- plain browsing stays load-more-on-demand", async () => {
    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useLocationField(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.locations).toHaveLength(50));
    expect(result.current.hasNextPage).toBe(true);

    // No setSearchValue call -- give any errant auto-fetch effect a chance
    // to fire, then confirm it didn't.
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(result.current.locations).toHaveLength(50);
    expect(result.current.hasNextPage).toBe(true);
  });

  it("filter also matches by code", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useLocationField(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.locations).toHaveLength(50));

    act(() => result.current.setSearchValue("L017"));
    await act(async () => {
      vi.advanceTimersByTime(250);
    });

    await waitFor(() => expect(result.current.options).toHaveLength(1));
    expect(result.current.options[0]?.id).toBe("location-17");
    vi.useRealTimers();
  });

  it("maps locations to EntityOption preserving secondaryText (code) and skipping null ids", async () => {
    server.use(
      paginatedListHandler({
        url: `${API_BASE}/locations`,
        items: [
          { locationId: "l1", name: "Downtown", code: "DOWNTOWN" },
          { locationId: null as unknown as string, name: "No-id", code: "X" },
        ],
      })
    );
    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useLocationField(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.locations).toHaveLength(2));
    expect(result.current.options).toEqual([
      { id: "l1", name: "Downtown", secondaryText: "DOWNTOWN" },
    ]);
  });

  it("findLocation resolves a loaded locationId to its full Location record (code included)", async () => {
    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useLocationField(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.locations).toHaveLength(50));

    expect(result.current.findLocation("location-17")?.code).toBe("L017");
    expect(result.current.findLocation("does-not-exist")).toBeUndefined();
  });

  it("surfaces an SDK error as error: Error and keeps options empty", async () => {
    server.use(
      http.get(`${API_BASE}/locations`, () =>
        HttpResponse.json(
          { success: false, errors: [{ code: "ERR_BOOM", message: "boom" }] },
          { status: 400 }
        )
      )
    );
    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useLocationField(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.options).toEqual([]);
    expect(result.current.locations).toEqual([]);
  });
});
