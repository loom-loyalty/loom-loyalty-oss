import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useSpindleTranslate } from "../hooks/use-spindle-translate";
import type { SpindleTranslateResponse } from "../types";

// ── fetch + getAccessToken mocks ──

function mockRes(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

let fetchMock: ReturnType<typeof vi.fn>;
const getAccessToken = vi.fn(async () => "tok-123");

function lastBody(): Record<string, unknown> {
  const calls = fetchMock.mock.calls;
  const call = calls[calls.length - 1]!;
  const init = call[1] as RequestInit;
  return JSON.parse(init.body as string) as Record<string, unknown>;
}

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  getAccessToken.mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

const OK_RESPONSE: SpindleTranslateResponse = {
  sql: "SELECT count() FROM mv_events FINAL LIMIT 100",
  explanation: "Counts events.",
  assumptions: ["Applied FINAL."],
  clarifyingQuestion: null,
};

describe("useSpindleTranslate.translate", () => {
  it("posts the request with a bearer token and returns the parsed proposal", async () => {
    fetchMock.mockResolvedValueOnce(mockRes(OK_RESPONSE));
    const { result } = renderHook(() => useSpindleTranslate(getAccessToken));

    let out: SpindleTranslateResponse | null = null;
    await act(async () => {
      out = await result.current.translate({
        mode: "nl_to_sql",
        prompt: "count events",
        schema: [],
      });
    });

    expect(out).toEqual(OK_RESPONSE);
    expect(result.current.data).toEqual(OK_RESPONSE);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();

    expect(getAccessToken).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/api/ai/spindle/translate");
    expect((init as RequestInit).method).toBe("POST");
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer tok-123");
    expect(headers["Content-Type"]).toBe("application/json");
    expect(lastBody()).toEqual({ mode: "nl_to_sql", prompt: "count events", schema: [] });
  });

  it("returns the abstention shape without injecting SQL", async () => {
    fetchMock.mockResolvedValueOnce(
      mockRes({
        sql: null,
        explanation: "Too vague.",
        assumptions: [],
        clarifyingQuestion: "Which metric?",
      })
    );
    const { result } = renderHook(() => useSpindleTranslate(getAccessToken));

    let out: SpindleTranslateResponse | null = null;
    await act(async () => {
      out = await result.current.translate({ mode: "nl_to_sql", prompt: "stuff", schema: [] });
    });

    expect(out!.sql).toBeNull();
    expect(out!.clarifyingQuestion).toBe("Which metric?");
  });

  it("sends previousError for an auto-fix re-call", async () => {
    fetchMock.mockResolvedValueOnce(mockRes(OK_RESPONSE));
    const { result } = renderHook(() => useSpindleTranslate(getAccessToken));

    await act(async () => {
      await result.current.translate({
        mode: "fix",
        sql: "SELECT nope FROM mv_events",
        previousError: "Unknown column 'nope'",
        schema: [],
      });
    });

    const body = lastBody();
    expect(body.mode).toBe("fix");
    expect(body.previousError).toBe("Unknown column 'nope'");
  });

  it("includes prior turns in a refinement request body", async () => {
    fetchMock.mockResolvedValueOnce(mockRes(OK_RESPONSE));
    const { result } = renderHook(() => useSpindleTranslate(getAccessToken));
    const turns = [{ prompt: "count events", sql: "SELECT count() FROM mv_events LIMIT 100" }];

    await act(async () => {
      await result.current.translate({
        mode: "nl_to_sql",
        prompt: "group by type",
        sql: turns[0]!.sql,
        turns,
        schema: [],
      });
    });

    expect(lastBody().turns).toEqual(turns);
  });

  it("maps a 429 to a friendly rate-limit message and returns null", async () => {
    fetchMock.mockResolvedValueOnce(mockRes({ error: "Too many requests" }, 429));
    const { result } = renderHook(() => useSpindleTranslate(getAccessToken));

    let out: SpindleTranslateResponse | null = OK_RESPONSE;
    await act(async () => {
      out = await result.current.translate({ mode: "nl_to_sql", prompt: "x", schema: [] });
    });

    expect(out).toBeNull();
    expect(result.current.error).toMatch(/too many requests/i);
    expect(result.current.isLoading).toBe(false);
  });

  it("maps a budget 429 to the AI limit state instead of the rate-limit copy", async () => {
    fetchMock.mockResolvedValueOnce(
      mockRes(
        {
          error: "Daily AI limit reached",
          code: "DAILY_LIMIT_REACHED",
          retry_after: 60,
          upgrade: true,
          resets_at: "2026-10-15T00:00:00.000Z",
        },
        429
      )
    );
    const { result } = renderHook(() => useSpindleTranslate(getAccessToken));

    await act(async () => {
      await result.current.translate({ mode: "nl_to_sql", prompt: "x", schema: [] });
    });

    expect(result.current.limit).toEqual({
      resetsAt: new Date("2026-10-15T00:00:00.000Z"),
      upgrade: true,
    });
    expect(result.current.error).not.toMatch(/too many requests/i);
  });

  it("keeps the rate-limit copy for a RATE_LIMITED 429", async () => {
    fetchMock.mockResolvedValueOnce(
      mockRes({ error: "Too many requests", code: "RATE_LIMITED", retry_after: 30 }, 429)
    );
    const { result } = renderHook(() => useSpindleTranslate(getAccessToken));

    await act(async () => {
      await result.current.translate({ mode: "nl_to_sql", prompt: "x", schema: [] });
    });

    expect(result.current.limit).toBeNull();
    expect(result.current.error).toMatch(/too many requests/i);
  });

  it("maps a budget 429 on explain-results to explainLimit", async () => {
    fetchMock.mockResolvedValueOnce(
      mockRes({ error: "Daily AI limit reached", code: "DAILY_LIMIT_REACHED" }, 429)
    );
    const { result } = renderHook(() => useSpindleTranslate(getAccessToken));

    await act(async () => {
      await result.current.explainResults({ sql: "select 1", columns: [], rows: [] });
    });

    expect(result.current.explainLimit).toEqual({ resetsAt: null, upgrade: false });
    expect(result.current.limit).toBeNull();
  });

  it("maps a 401 to a session-expired message", async () => {
    fetchMock.mockResolvedValueOnce(mockRes({ error: "Unauthorized" }, 401));
    const { result } = renderHook(() => useSpindleTranslate(getAccessToken));

    await act(async () => {
      await result.current.translate({ mode: "nl_to_sql", prompt: "x", schema: [] });
    });

    expect(result.current.error).toMatch(/session expired/i);
  });

  it("maps a SQL_WORKBENCH_NOT_ENABLED 403 to the server's plan message, not session-expired", async () => {
    fetchMock.mockResolvedValueOnce(
      mockRes(
        {
          error: "SQL Workbench is not available on your plan.",
          code: "SQL_WORKBENCH_NOT_ENABLED",
        },
        403
      )
    );
    const { result } = renderHook(() => useSpindleTranslate(getAccessToken));

    await act(async () => {
      await result.current.translate({ mode: "nl_to_sql", prompt: "x", schema: [] });
    });

    expect(result.current.error).toBe("SQL Workbench is not available on your plan.");
    expect(result.current.error).not.toMatch(/session expired/i);
  });

  it("swallows an AbortError without surfacing an error", async () => {
    fetchMock.mockRejectedValueOnce(new DOMException("aborted", "AbortError"));
    const { result } = renderHook(() => useSpindleTranslate(getAccessToken));

    let out: SpindleTranslateResponse | null = OK_RESPONSE;
    await act(async () => {
      out = await result.current.translate({ mode: "nl_to_sql", prompt: "x", schema: [] });
    });

    expect(out).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("aborts the in-flight request on unmount", async () => {
    let signal: AbortSignal | undefined;
    fetchMock.mockImplementation((_url: string, init: RequestInit) => {
      signal = init.signal ?? undefined;
      return new Promise<Response>(() => {}); // never resolves — stays in flight
    });
    const { result, unmount } = renderHook(() => useSpindleTranslate(getAccessToken));
    await act(async () => {
      void result.current.translate({ mode: "nl_to_sql", prompt: "x", schema: [] });
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(signal).toBeDefined();
    expect(signal!.aborted).toBe(false);
    unmount();
    expect(signal!.aborted).toBe(true);
  });
});

describe("useSpindleTranslate.explainResults", () => {
  it("posts to the explain-results endpoint and caps rows to 50", async () => {
    fetchMock.mockResolvedValueOnce(mockRes({ summary: "Gold leads." }));
    const { result } = renderHook(() => useSpindleTranslate(getAccessToken));

    const rows = Array.from({ length: 60 }, (_, i) => ({ id: i }));
    let out: { summary: string } | null = null;
    await act(async () => {
      out = await result.current.explainResults({
        sql: "SELECT * FROM mv_customers FINAL",
        columns: [{ name: "id", type: "Int32" }],
        rows,
      });
    });

    expect(out).toEqual({ summary: "Gold leads." });
    const [url] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/api/ai/spindle/explain-results");
    expect((lastBody().rows as unknown[]).length).toBe(50);
  });

  it("does not overwrite translate `data`", async () => {
    fetchMock.mockResolvedValueOnce(mockRes(OK_RESPONSE));
    const { result } = renderHook(() => useSpindleTranslate(getAccessToken));
    await act(async () => {
      await result.current.translate({ mode: "nl_to_sql", prompt: "x", schema: [] });
    });
    expect(result.current.data).toEqual(OK_RESPONSE);

    fetchMock.mockResolvedValueOnce(mockRes({ summary: "ok" }));
    await act(async () => {
      await result.current.explainResults({ sql: "SELECT 1", columns: [], rows: [] });
    });
    // `data` still reflects the last translate, not the summary.
    expect(result.current.data).toEqual(OK_RESPONSE);
  });

  it("uses separate loading/error state — explain failures never touch the translate surface", async () => {
    fetchMock.mockResolvedValueOnce(mockRes({ error: "boom" }, 502));
    const { result } = renderHook(() => useSpindleTranslate(getAccessToken));

    await act(async () => {
      await result.current.explainResults({ sql: "SELECT 1", columns: [], rows: [] });
    });

    // The explain error lands on the explain channel, NOT the translate channel
    // (which the Ask-AI bar reads). isLoading/error stay clean.
    expect(result.current.explainError).toMatch(/unavailable/i);
    expect(result.current.error).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.explainLoading).toBe(false);
  });
});
