import { getOfferManagementListOffersQueryKey, setApiBaseUrl } from "@loom-loyalty/sdk";
import { HttpResponse, http, paginatedListHandler, setupServer } from "@loom-loyalty/test-utils";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { createQueryWrapper } from "../../test/query-client-wrapper";
import { useOfferField } from "./use-offer-field";

const API_BASE = "https://api.test";
setApiBaseUrl(API_BASE);

interface OfferLike {
  offerId: string;
  name: string;
  code: string;
}

const OFFERS: OfferLike[] = Array.from({ length: 137 }, (_, i) => ({
  offerId: `offer-${i}`,
  name: `Offer ${i}`,
  code: `O${String(i).padStart(3, "0")}`,
}));

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("[audit] useOfferField paginated wrapper (server-side name filter)", () => {
  beforeEach(() => {
    server.use(
      paginatedListHandler({
        url: `${API_BASE}/offers`,
        items: OFFERS,
        filter: (offer, params) => {
          const name = params.get("name");
          return name ? offer.name.includes(name) : true;
        },
      })
    );
  });

  it("fetches the first page", async () => {
    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useOfferField(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.offers).toHaveLength(50));
  });

  it("paginates via fetchNextPage", async () => {
    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useOfferField(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.offers).toHaveLength(50));
    act(() => result.current.fetchNextPage());
    await waitFor(() => expect(result.current.offers).toHaveLength(100));
  });

  it("debounced search pushes ?name= to the server (not client-side)", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const requestUrls: string[] = [];
    server.use(
      http.get(`${API_BASE}/offers`, ({ request }) => {
        requestUrls.push(request.url);
        const url = new URL(request.url);
        const name = url.searchParams.get("name");
        const page = Number(url.searchParams.get("page") ?? "0");
        const size = Number(url.searchParams.get("size") ?? "50");
        const filtered = name ? OFFERS.filter((o) => o.name.includes(name)) : OFFERS;
        return HttpResponse.json({
          content: filtered.slice(page * size, page * size + size),
          totalSize: filtered.length,
          totalPages: Math.ceil(filtered.length / size),
          pageNumber: page,
          pageSize: size,
        });
      })
    );

    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useOfferField(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.offers).toHaveLength(50));

    act(() => result.current.setSearchValue("Offer 13"));
    await act(async () => {
      vi.advanceTimersByTime(250);
    });

    await waitFor(() => {
      expect(
        requestUrls.some((u) => u.includes("name=Offer+13") || u.includes("name=Offer%2013"))
      ).toBe(true);
    });
    // Server returned filtered set: "Offer 13" + "Offer 130..136" = 8.
    await waitFor(() => expect(result.current.offers).toHaveLength(8));
    vi.useRealTimers();
  });

  it("hasNextPage flips on the last page", async () => {
    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useOfferField(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.offers).toHaveLength(50));
    act(() => result.current.fetchNextPage());
    await waitFor(() => expect(result.current.offers).toHaveLength(100));
    act(() => result.current.fetchNextPage());
    await waitFor(() => expect(result.current.offers).toHaveLength(137));
    expect(result.current.hasNextPage).toBe(false);
  });

  it("surfaces SDK error", async () => {
    server.use(
      http.get(`${API_BASE}/offers`, () =>
        HttpResponse.json(
          { success: false, errors: [{ code: "E", message: "x" }] },
          { status: 400 }
        )
      )
    );
    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useOfferField(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.error).not.toBeNull());
  });

  it("plumbs a short gcTime on the offer query so inactive search-variant entries are GC'd before the default 5min", async () => {
    const { Wrapper, client } = createQueryWrapper();
    const { result } = renderHook(() => useOfferField(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.offers).toHaveLength(50));
    const offerKeyPrefix = getOfferManagementListOffersQueryKey()[0];
    const offerQueries = client
      .getQueryCache()
      .getAll()
      .filter((q) => q.queryKey[0] === offerKeyPrefix);
    expect(offerQueries.length).toBeGreaterThan(0);
    for (const q of offerQueries) {
      expect(q.gcTime).toBeLessThan(5 * 60 * 1000);
      expect(q.gcTime).toBeGreaterThanOrEqual(30 * 1000);
    }
  });
});
