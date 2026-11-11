import { describe, expect, it } from "vitest";

import { memberTools } from "../src/index";
import { A, fakeClient } from "./fake-client";

/**
 * The tools run inside `generateText` on the lowest and highest AI SDK major we support.
 * A mock model asks for `getMyPoints`, then answers with what the tool returned.
 */
const v5Response = {
  finishReason: "tool-calls",
  usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
};
const v7Response = {
  finishReason: { unified: "tool-calls", raw: "tool_calls" },
  usage: {
    inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
    outputTokens: { total: 1, text: 1, reasoning: 0 },
  },
};

// Each major has its own mock model and its own provider response shape.
const versions = [
  ["ai@5", () => import("ai-v5"), () => import("ai-v5/test"), "MockLanguageModelV2", v5Response],
  ["ai@7", () => import("ai"), () => import("ai/test"), "MockLanguageModelV4", v7Response],
] as const;

describe.each(versions)("%s", (_label, loadAi, loadTest, mockName, response) => {
  it("runs getMyPoints through generateText", async () => {
    const ai = (await loadAi()) as unknown as {
      generateText: (
        o: unknown
      ) => Promise<{ toolResults?: unknown[]; steps?: { toolResults?: unknown[] }[] }>;
      stepCountIs?: (n: number) => unknown;
    };
    const testing = (await loadTest()) as unknown as Record<string, new (o: unknown) => unknown>;
    const MockModel = testing[mockName];
    expect(MockModel).toBeDefined();

    const { client } = fakeClient();
    const model = new MockModel!({
      doGenerate: async () => ({
        content: [
          { type: "tool-call", toolCallId: "call-1", toolName: "getMyPoints", input: "{}" },
        ],
        ...response,
        warnings: [],
      }),
    });

    const result = await ai.generateText({
      model,
      tools: memberTools({ customerExternalId: A.externalId, client }),
      prompt: "How many points do I have?",
    });

    const toolResults = JSON.stringify(
      result.toolResults ?? result.steps?.flatMap((s) => s.toolResults ?? [])
    );
    expect(toolResults).toContain('"available":900');
  });
});
