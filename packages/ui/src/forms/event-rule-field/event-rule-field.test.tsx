import { setApiBaseUrl } from "@loom-loyalty/sdk";
import { HttpResponse, http, paginatedListHandler, setupServer } from "@loom-loyalty/test-utils";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { createQueryWrapper } from "../../test/query-client-wrapper";
import { useEventRuleField } from "./use-event-rule-field";

const API_BASE = "https://api.test";
setApiBaseUrl(API_BASE);

interface RuleLike {
  eventRuleId: string;
  name: string;
  code: string;
}

const RULES: RuleLike[] = Array.from({ length: 137 }, (_, i) => ({
  eventRuleId: `rule-${i}`,
  name: `Rule ${i}`,
  code: `R${String(i).padStart(3, "0")}`,
}));

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("[audit] useEventRuleField paginated wrapper", () => {
  beforeEach(() => {
    server.use(paginatedListHandler({ url: `${API_BASE}/event-rules`, items: RULES }));
  });

  it("fetches the first page", async () => {
    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useEventRuleField(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.eventRules).toHaveLength(50));
  });

  it("paginates", async () => {
    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useEventRuleField(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.eventRules).toHaveLength(50));
    act(() => result.current.fetchNextPage());
    await waitFor(() => expect(result.current.eventRules).toHaveLength(100));
  });

  it("debounces search and filters by name+code", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useEventRuleField(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.eventRules).toHaveLength(50));
    act(() => result.current.setSearchValue("R017"));
    await act(async () => {
      vi.advanceTimersByTime(250);
    });
    await waitFor(() => expect(result.current.options).toHaveLength(1));
    expect(result.current.options[0]?.id).toBe("rule-17");
    vi.useRealTimers();
  });

  it("hasNextPage flips on the last page", async () => {
    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useEventRuleField(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.eventRules).toHaveLength(50));
    act(() => result.current.fetchNextPage());
    await waitFor(() => expect(result.current.eventRules).toHaveLength(100));
    act(() => result.current.fetchNextPage());
    await waitFor(() => expect(result.current.eventRules).toHaveLength(137));
    expect(result.current.hasNextPage).toBe(false);
  });

  it("surfaces SDK error", async () => {
    server.use(
      http.get(`${API_BASE}/event-rules`, () =>
        HttpResponse.json(
          { success: false, errors: [{ code: "E", message: "x" }] },
          { status: 400 }
        )
      )
    );
    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useEventRuleField(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.error).not.toBeNull());
  });
});
