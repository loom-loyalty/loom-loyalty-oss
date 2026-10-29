import { setApiBaseUrl } from "@loom-loyalty/sdk";
import { HttpResponse, http, paginatedListHandler, setupServer } from "@loom-loyalty/test-utils";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { createQueryWrapper } from "../../test/query-client-wrapper";
import { useProgramField } from "./use-program-field";

const API_BASE = "https://api.test";
setApiBaseUrl(API_BASE);

interface ProgramLike {
  programId: string;
  name: string;
  code: string;
}

const PROGRAMS: ProgramLike[] = Array.from({ length: 137 }, (_, i) => ({
  programId: `prog-${i}`,
  name: `Program ${i}`,
  code: `PR${String(i).padStart(3, "0")}`,
}));

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("[audit] useProgramField paginated wrapper", () => {
  beforeEach(() => {
    server.use(paginatedListHandler({ url: `${API_BASE}/programs`, items: PROGRAMS }));
  });

  it("fetches the first page on mount", async () => {
    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useProgramField(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.programs).toHaveLength(50);
    expect(result.current.hasNextPage).toBe(true);
  });

  it("respects caller pageSize", async () => {
    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useProgramField({ pageSize: 25 }), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.programs).toHaveLength(25));
  });

  it("fetchNextPage concatenates", async () => {
    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useProgramField(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.programs).toHaveLength(50));
    act(() => result.current.fetchNextPage());
    await waitFor(() => expect(result.current.programs).toHaveLength(100));
    expect(result.current.programs[50]?.programId).toBe("prog-50");
  });

  it("hasNextPage becomes false on the last page", async () => {
    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useProgramField(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.programs).toHaveLength(50));
    act(() => result.current.fetchNextPage());
    await waitFor(() => expect(result.current.programs).toHaveLength(100));
    act(() => result.current.fetchNextPage());
    await waitFor(() => expect(result.current.programs).toHaveLength(137));
    expect(result.current.hasNextPage).toBe(false);
  });

  it("debounces search at 250ms then filters by name+code", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useProgramField(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.programs).toHaveLength(50));

    act(() => result.current.setSearchValue("PR017"));
    await act(async () => {
      vi.advanceTimersByTime(250);
    });

    await waitFor(() => expect(result.current.options).toHaveLength(1));
    expect(result.current.options[0]?.id).toBe("prog-17");
    vi.useRealTimers();
  });

  it("falls back to programId or code when both present, using programId first", async () => {
    server.use(
      paginatedListHandler({
        url: `${API_BASE}/programs`,
        items: [
          { programId: "p1", name: "Alpha", code: "ALPHA" },
          { programId: null as unknown as string, name: "Code-only", code: "CODE_ONLY" },
        ],
      })
    );
    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useProgramField(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.programs).toHaveLength(2));
    expect(result.current.options).toEqual([
      { id: "p1", name: "Alpha", secondaryText: "ALPHA" },
      { id: "CODE_ONLY", name: "Code-only", secondaryText: "CODE_ONLY" },
    ]);
  });

  it("handles a bare-array response shape (BE quirk)", async () => {
    server.use(
      http.get(`${API_BASE}/programs`, () =>
        HttpResponse.json([{ programId: "p1", name: "Alpha", code: "ALPHA" }])
      )
    );
    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useProgramField(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.programs).toHaveLength(1));
    expect(result.current.hasNextPage).toBe(false);
  });

  it("surfaces SDK error and keeps options empty", async () => {
    server.use(
      http.get(`${API_BASE}/programs`, () =>
        HttpResponse.json(
          { success: false, errors: [{ code: "ERR", message: "boom" }] },
          { status: 400 }
        )
      )
    );
    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useProgramField(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.options).toEqual([]);
  });
});
