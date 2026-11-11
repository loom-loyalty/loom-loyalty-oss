// Compile-only checks, run by `pnpm type-check`: the tools must be accepted as an AI SDK tool set
// without a cast. The package's types come from whichever `ai` the app installs, so this checks
// the dev copy (7); ai-sdk-compat.test.ts runs the tools on 5 and 7.
import type { ToolSet as ToolSetV7 } from "ai";
import { streamText } from "ai";

import { memberTools } from "../src/index";

const tools = memberTools({ customerExternalId: "shopper-1", apiUrl: "https://x", apiKey: "k" });

export const asV7: ToolSetV7 = tools;
export const streamed = () =>
  streamText({ model: "anthropic/claude-haiku-5.5", prompt: "hi", tools });
