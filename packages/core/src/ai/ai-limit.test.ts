import { describe, expect, it } from "vitest";

import { parseAiLimit, readAiLimit } from "./ai-limit";

const RESETS_AT = "2026-10-15T00:00:00.000Z";

function jsonResponse(body: unknown, status = 429): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("readAiLimit", () => {
  it("parses a budget 429 and leaves the body readable", async () => {
    const res = jsonResponse({
      error: "Daily AI limit reached",
      code: "DAILY_LIMIT_REACHED",
      retry_after: 3600,
      request_id: "req-1",
      upgrade: true,
      resets_at: RESETS_AT,
    });

    const limit = await readAiLimit(res);

    expect(limit).toEqual({ resetsAt: new Date(RESETS_AT), upgrade: true });
    await expect(res.json()).resolves.toMatchObject({ code: "DAILY_LIMIT_REACHED" });
  });

  it("ignores the request limiter's RATE_LIMITED 429", async () => {
    const res = jsonResponse({ error: "Too many requests", code: "RATE_LIMITED", retry_after: 30 });
    await expect(readAiLimit(res)).resolves.toBeNull();
  });

  it("ignores a 429 with a non-JSON body", async () => {
    const res = new Response("Too Many Requests", { status: 429 });
    await expect(readAiLimit(res)).resolves.toBeNull();
  });

  it("ignores a non-429 response even when it carries the code", async () => {
    const res = jsonResponse({ code: "DAILY_LIMIT_REACHED" }, 500);
    await expect(readAiLimit(res)).resolves.toBeNull();
  });

  it("treats a missing upgrade as false and derives resetsAt from retry_after", () => {
    const now = new Date("2026-10-14T23:00:00.000Z");
    const limit = parseAiLimit({ error: "x", code: "DAILY_LIMIT_REACHED", retry_after: 3600 }, now);
    expect(limit).toEqual({ resetsAt: new Date("2026-10-15T00:00:00.000Z"), upgrade: false });
  });

  it("returns a null resetsAt when the server gives neither field", () => {
    expect(readAiLimit({ code: "DAILY_LIMIT_REACHED" })).toEqual({
      resetsAt: null,
      upgrade: false,
    });
  });

  it("parses a coded chat RUN_ERROR event", () => {
    const limit = readAiLimit({
      type: "RUN_ERROR",
      message: "Daily AI limit reached",
      code: "DAILY_LIMIT_REACHED",
      upgrade: false,
      resets_at: RESETS_AT,
    });
    expect(limit).toEqual({ resetsAt: new Date(RESETS_AT), upgrade: false });
  });

  it("ignores an uncoded RUN_ERROR and non-objects", () => {
    expect(readAiLimit({ type: "RUN_ERROR", message: "boom" })).toBeNull();
    expect(readAiLimit(null)).toBeNull();
    expect(readAiLimit("DAILY_LIMIT_REACHED")).toBeNull();
  });
});
