import { setApiBaseUrl } from "@loom-loyalty/sdk";
import { paginatedListHandler, setupServer } from "@loom-loyalty/test-utils";
import { fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { createQueryWrapper } from "../../test/query-client-wrapper";
import { EventSubTypeField } from "./event-sub-type-field";
import { toEventSubTypeSource } from "./sub-type-sources";
import { useEventSubTypeOptions } from "./use-event-sub-type-options";

const API_BASE = "https://api.test";
setApiBaseUrl(API_BASE);

interface TargetRow {
  targetId: string;
  name: string;
  code: string;
}

// 60 targets so the 55th sits past the first page of 50.
const TARGETS: TargetRow[] = Array.from({ length: 60 }, (_, i) => ({
  targetId: `tgt-${i}`,
  name: `Target ${i}`,
  code: `TG${String(i).padStart(3, "0")}`,
}));

const byCodeOrName = (item: { code: string; name: string }, params: URLSearchParams) => {
  const search = params.get("search")?.toLowerCase();
  if (!search) return true;
  return item.code.toLowerCase().includes(search) || item.name.toLowerCase().includes(search);
};

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function useTargets(): void {
  server.use(
    paginatedListHandler({ url: `${API_BASE}/targets`, items: TARGETS, filter: byCodeOrName })
  );
}

describe("toEventSubTypeSource", () => {
  it("reads the sources the Hub knows and drops any other value", () => {
    expect(toEventSubTypeSource("TARGET")).toBe("TARGET");
    expect(toEventSubTypeSource("COUPON")).toBe("COUPON");
    expect(toEventSubTypeSource("SOMETHING_NEW")).toBeUndefined();
    expect(toEventSubTypeSource(undefined)).toBeUndefined();
  });
});

describe("useEventSubTypeOptions", () => {
  it("looks an offer up by code through the list's search", async () => {
    const seen: string[] = [];
    server.use(
      paginatedListHandler({
        url: `${API_BASE}/offers`,
        items: [{ offerId: "o1", code: "WELCOME-10", name: "Ten off your first order" }],
        filter: (item, params) => {
          seen.push(params.toString());
          const search = params.get("search");
          return !search || item.code.includes(search) || item.name.includes(search);
        },
      })
    );
    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useEventSubTypeOptions("OFFER", "WELCOME-10"), {
      wrapper: Wrapper,
    });
    await waitFor(() => expect(result.current.valueRecord?.name).toBe("Ten off your first order"));
    expect(seen.some((query) => query.includes("name="))).toBe(false);
  });

  it("lists event rules as current versions only, so a rule shows once (P1)", async () => {
    const seen: string[] = [];
    server.use(
      paginatedListHandler({
        url: `${API_BASE}/event-rules`,
        items: [{ eventRuleId: "r2", code: "EARN", name: "Earn points" }],
        filter: (_item, params) => {
          seen.push(params.get("currentVersionsOnly") ?? "");
          return true;
        },
      })
    );
    const { Wrapper } = createQueryWrapper();
    renderHook(() => useEventSubTypeOptions("EVENT_RULE", ""), { wrapper: Wrapper });
    await waitFor(() => expect(seen).toContain("true"));
    expect(seen).not.toContain("");
  });

  it("lists a target as its name, keyed by its code", async () => {
    useTargets();
    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useEventSubTypeOptions("TARGET", ""), {
      wrapper: Wrapper,
    });
    await waitFor(() => expect(result.current.options).toHaveLength(50));
    expect(result.current.options[0]).toEqual({
      id: "TG000",
      name: "Target 0",
      secondaryText: "TG000",
    });
    expect(result.current.isValueMissing).toBe(false);
  });

  it("finds a stored code past the first page by looking it up", async () => {
    useTargets();
    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useEventSubTypeOptions("TARGET", "TG055"), {
      wrapper: Wrapper,
    });
    await waitFor(() => expect(result.current.valueRecord?.name).toBe("Target 55"));
    expect(result.current.isValueMissing).toBe(false);
    expect(result.current.optionsAll.some((option) => option.id === "TG055")).toBe(true);
  });

  it("marks a stored code no target has as missing", async () => {
    useTargets();
    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useEventSubTypeOptions("TARGET", "OLD-FREE-TEXT"), {
      wrapper: Wrapper,
    });
    await waitFor(() => expect(result.current.isValueMissing).toBe(true));
    expect(result.current.valueRecord).toBeUndefined();
  });

  it("matches codes exactly, so a different case is missing", async () => {
    useTargets();
    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useEventSubTypeOptions("TARGET", "tg001"), {
      wrapper: Wrapper,
    });
    await waitFor(() => expect(result.current.isValueMissing).toBe(true));
  });

  it("lists coupon codes, not offer codes, and can't tell whether one is missing", async () => {
    server.use(
      paginatedListHandler({
        url: `${API_BASE}/coupons`,
        items: [
          { couponId: "c1", couponCode: "SAVE10-AB12", couponOffer: { name: "Save 10" } },
          { couponId: "c2", couponCode: "SAVE10-CD34", couponOffer: { name: "Save 10" } },
        ],
      })
    );
    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useEventSubTypeOptions("COUPON", "GONE"), {
      wrapper: Wrapper,
    });
    await waitFor(() => expect(result.current.options).toHaveLength(2));
    expect(result.current.options[0]).toEqual({
      id: "SAVE10-AB12",
      name: "SAVE10-AB12",
      secondaryText: "Save 10",
    });
    expect(result.current.isValueMissing).toBeUndefined();
  });

  it("fetches nothing while disabled", async () => {
    const { Wrapper } = createQueryWrapper();
    // No handler is registered: any request would fail the test (onUnhandledRequest: "error").
    const { result } = renderHook(
      () => useEventSubTypeOptions("TARGET", "TG001", { enabled: false }),
      { wrapper: Wrapper }
    );
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(result.current.options).toHaveLength(0);
    expect(result.current.isValueMissing).toBeUndefined();
  });
});

function openPicker(container: HTMLElement): void {
  const trigger = container.querySelector('[role="combobox"]');
  if (!trigger) throw new Error("combobox trigger missing");
  fireEvent.click(trigger);
}

describe("EventSubTypeField", () => {
  it("defaults to any target and stores a picked target's code", async () => {
    useTargets();
    const onValueChange = vi.fn();
    const { Wrapper } = createQueryWrapper();
    const { container } = render(
      <EventSubTypeField source="TARGET" value="" onValueChange={onValueChange} />,
      { wrapper: Wrapper }
    );
    expect(container.querySelector('[role="combobox"]')?.textContent).toContain("Any target");

    openPicker(container);
    fireEvent.click(await screen.findByText("Target 3"));
    expect(onValueChange).toHaveBeenCalledWith("TG003");
  });

  it("stores nothing when Any is picked", async () => {
    useTargets();
    const onValueChange = vi.fn();
    const { Wrapper } = createQueryWrapper();
    const { container } = render(
      <EventSubTypeField source="TARGET" value="TG003" onValueChange={onValueChange} />,
      { wrapper: Wrapper }
    );
    await waitFor(() =>
      expect(container.querySelector('[role="combobox"]')?.textContent).toContain("Target 3")
    );
    openPicker(container);
    fireEvent.click(await screen.findByText("Any target"));
    expect(onValueChange).toHaveBeenCalledWith("");
  });

  it("shows a stored code no target has as not found and keeps it", async () => {
    useTargets();
    const onValueChange = vi.fn();
    const { Wrapper } = createQueryWrapper();
    const { container } = render(
      <EventSubTypeField
        id="sub-type"
        source="TARGET"
        value="OLD-FREE-TEXT"
        onValueChange={onValueChange}
      />,
      { wrapper: Wrapper }
    );
    const note = await screen.findByText(/No target has the code “OLD-FREE-TEXT”/);
    expect(note.id).toBe("sub-type-not-found");
    const combobox = container.querySelector('[role="combobox"]');
    expect(combobox?.textContent).toContain("OLD-FREE-TEXT");
    expect(combobox?.getAttribute("aria-describedby")).toContain("sub-type-not-found");
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("shows a stored coupon code as itself, not as Any, though it can't be looked up", async () => {
    server.use(
      paginatedListHandler({
        url: `${API_BASE}/coupons`,
        items: [{ couponId: "c1", couponCode: "SAVE10-AB12", couponOffer: { name: "Save 10" } }],
      })
    );
    const { Wrapper } = createQueryWrapper();
    const { container } = render(
      <EventSubTypeField source="COUPON" value="FAR-DOWN-THE-LIST" onValueChange={vi.fn()} />,
      { wrapper: Wrapper }
    );
    await waitFor(() =>
      expect(container.querySelector('[role="combobox"]')?.textContent).toContain(
        "FAR-DOWN-THE-LIST"
      )
    );
    expect(container.querySelector('[role="combobox"]')?.textContent).not.toContain("Any");
    expect(screen.queryByText(/has the code/)).toBeNull();
  });
});
