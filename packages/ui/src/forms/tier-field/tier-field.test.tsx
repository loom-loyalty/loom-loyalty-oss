import { setApiBaseUrl } from "@loom-loyalty/sdk";
import { HttpResponse, http, paginatedListHandler, setupServer } from "@loom-loyalty/test-utils";
import { act, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { createQueryWrapper } from "../../test/query-client-wrapper";
import { TierField } from "./tier-field";
import { useTierField } from "./use-tier-field";

const API_BASE = "https://api.test";
setApiBaseUrl(API_BASE);

interface TierLike {
  tierId: string;
  name: string;
  code: string;
}

const TIERS: TierLike[] = Array.from({ length: 137 }, (_, i) => ({
  tierId: `tier_${String(i).padStart(2, "0")}_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa`,
  name: `Tier ${i}`,
  code: `T${String(i).padStart(3, "0")}`,
}));

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("[audit] useTierField paginated wrapper", () => {
  beforeEach(() => {
    server.use(paginatedListHandler({ url: `${API_BASE}/tiers`, items: TIERS }));
  });

  it("fetches the first page", async () => {
    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useTierField(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.tiers).toHaveLength(50));
  });

  it("uses tier.tierId as the option id by default (FK semantics)", async () => {
    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useTierField(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.tiers).toHaveLength(50));
    expect(result.current.options[0]?.id).toBe("tier_00_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
    expect(result.current.options[0]?.secondaryText).toBe("T000");
  });

  it("uses tier.code as the option id when idField='code' (legacy)", async () => {
    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useTierField({ idField: "code" }), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.tiers).toHaveLength(50));
    expect(result.current.options[0]?.id).toBe("T000");
    expect(result.current.options[0]?.secondaryText).toBe("T000");
  });

  it("falls back to code when tierId is absent (defensive)", async () => {
    server.use(
      paginatedListHandler({
        url: `${API_BASE}/tiers`,
        items: [
          { tierId: "tier_a_b", name: "Has id", code: "HAS_ID" },
          { tierId: null as unknown as string, name: "Code-only", code: "CODE_ONLY" },
        ],
      })
    );
    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useTierField(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.tiers).toHaveLength(2));
    expect(result.current.options).toEqual([
      { id: "tier_a_b", name: "Has id", secondaryText: "HAS_ID" },
      { id: "CODE_ONLY", name: "Code-only", secondaryText: "CODE_ONLY" },
    ]);
  });

  it("excludeIds hides matching options from both options and optionsAll", async () => {
    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(
      () =>
        useTierField({
          excludeIds: ["tier_00_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"],
        }),
      { wrapper: Wrapper }
    );
    await waitFor(() => expect(result.current.tiers).toHaveLength(50));
    expect(result.current.options.find((o) => o.id.startsWith("tier_00_"))).toBeUndefined();
    expect(result.current.optionsAll.find((o) => o.id.startsWith("tier_00_"))).toBeUndefined();
  });

  it("paginates", async () => {
    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useTierField(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.tiers).toHaveLength(50));
    act(() => result.current.fetchNextPage());
    await waitFor(() => expect(result.current.tiers).toHaveLength(100));
  });

  it("debounces search at 250ms", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useTierField(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.tiers).toHaveLength(50));
    act(() => result.current.setSearchValue("T017"));
    await act(async () => {
      vi.advanceTimersByTime(250);
    });
    await waitFor(() => expect(result.current.options).toHaveLength(1));
    expect(result.current.options[0]?.id).toBe("tier_17_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
    vi.useRealTimers();
  });

  it("searches the server, finding a tier beyond the loaded pages", async () => {
    const searches: string[] = [];
    server.use(
      http.get(`${API_BASE}/tiers`, ({ request }) => {
        const search = new URL(request.url).searchParams.get("search");
        if (search) searches.push(search);
        return undefined;
      }),
      paginatedListHandler({
        url: `${API_BASE}/tiers`,
        items: TIERS,
        filter: (tier, params) => {
          const search = params.get("search")?.toLowerCase();
          if (!search) return true;
          return tier.code.toLowerCase().includes(search) || tier.name.toLowerCase() === search;
        },
      })
    );
    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useTierField(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.tiers).toHaveLength(50));

    act(() => result.current.setSearchValue("  T120 "));
    await waitFor(() =>
      expect(result.current.options.map((o) => o.secondaryText)).toEqual(["T120"])
    );
    expect(searches).toContain("T120");
    // The searched tier stays resolvable for the trigger once the search clears.
    act(() => result.current.setSearchValue(""));
    await waitFor(() => expect(result.current.options).toHaveLength(50));
    expect(result.current.findTier(TIERS[120]!.tierId)?.code).toBe("T120");
    expect(result.current.optionsAll.some((o) => o.secondaryText === "T120")).toBe(true);
  });

  it("hasNextPage flips on the last page", async () => {
    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useTierField(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.tiers).toHaveLength(50));
    act(() => result.current.fetchNextPage());
    await waitFor(() => expect(result.current.tiers).toHaveLength(100));
    act(() => result.current.fetchNextPage());
    await waitFor(() => expect(result.current.tiers).toHaveLength(137));
    expect(result.current.hasNextPage).toBe(false);
  });

  it("findTier looks up by tierId in default mode", async () => {
    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useTierField(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.tiers).toHaveLength(50));
    const found = result.current.findTier("tier_03_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
    expect(found?.code).toBe("T003");
  });

  it("findTier looks up by code in legacy mode", async () => {
    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useTierField({ idField: "code" }), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.tiers).toHaveLength(50));
    const found = result.current.findTier("T004");
    expect(found?.name).toBe("Tier 4");
  });

  it("createTier posts to /tiers and returns the created entity", async () => {
    server.use(
      http.post(`${API_BASE}/tiers`, async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({
          tierId: "tier_99_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          name: body.name as string,
          code: body.code as string,
        });
      })
    );
    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useTierField(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.tiers.length).toBeGreaterThan(0));
    const created = await result.current.createTier({
      name: "Diamond",
      code: "diamond",
      rank: 1,
    });
    expect(created.tierId).toBe("tier_99_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
    expect(created.code).toBe("diamond");
  });

  it("surfaces SDK error", async () => {
    server.use(
      http.get(`${API_BASE}/tiers`, () =>
        HttpResponse.json(
          { success: false, errors: [{ code: "E", message: "x" }] },
          { status: 400 }
        )
      )
    );
    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useTierField(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.options).toEqual([]);
  });
});

describe("[audit] TierField compound — render + interaction", () => {
  beforeEach(() => {
    server.use(paginatedListHandler({ url: `${API_BASE}/tiers`, items: TIERS.slice(0, 5) }));
  });

  it("renders a combobox trigger with the Tier label", async () => {
    const { Wrapper } = createQueryWrapper();
    render(<TierField id="downgrade" value="" onValueChange={() => {}} />, { wrapper: Wrapper });
    await waitFor(() => {
      const trigger = screen.getByRole("combobox", { name: /select tier/i });
      expect(trigger).not.toBeNull();
    });
  });

  it("propagates id, aria-invalid, and aria-describedby to the trigger", async () => {
    const { Wrapper } = createQueryWrapper();
    render(
      <TierField
        id="t-id"
        value=""
        onValueChange={() => {}}
        aria-invalid
        aria-describedby="t-err"
      />,
      { wrapper: Wrapper }
    );
    await waitFor(() => {
      const trigger = document.querySelector("#t-id");
      expect(trigger).not.toBeNull();
      expect(trigger?.getAttribute("aria-invalid")).toBe("true");
      expect(trigger?.getAttribute("aria-describedby")).toBe("t-err");
    });
  });

  it("does not render an Add New option without renderCreateSheet", async () => {
    const { Wrapper } = createQueryWrapper();
    render(<TierField id="x" value="" onValueChange={() => {}} />, { wrapper: Wrapper });
    // Wait for fetch to settle so the trigger is not disabled by isLoading.
    const trigger = (await screen.findByRole("combobox", {
      name: /select tier/i,
    })) as HTMLButtonElement;
    await waitFor(() => expect(trigger.disabled).toBe(false));
    fireEvent.click(trigger);
    await waitFor(() => expect(screen.queryByPlaceholderText(/Search tiers/i)).not.toBeNull());
    expect(screen.queryByText(/Add New Tier/i)).toBeNull();
  });

  it("renders Add New Tier in the dropdown when renderCreateSheet is provided", async () => {
    const { Wrapper } = createQueryWrapper();
    render(
      <TierField
        id="x"
        value=""
        onValueChange={() => {}}
        renderCreateSheet={(open) => (open ? <div data-testid="create-sheet">create</div> : null)}
      />,
      { wrapper: Wrapper }
    );
    const trigger = (await screen.findByRole("combobox", {
      name: /select tier/i,
    })) as HTMLButtonElement;
    await waitFor(() => expect(trigger.disabled).toBe(false));
    fireEvent.click(trigger);
    await waitFor(() => expect(screen.queryByPlaceholderText(/Search tiers/i)).not.toBeNull());
    expect(screen.getByText(/Add New Tier/i)).toBeInTheDocument();
    // Sheet is not auto-opened — only the dropdown entry exists.
    expect(screen.queryByTestId("create-sheet")).toBeNull();
  });
});
