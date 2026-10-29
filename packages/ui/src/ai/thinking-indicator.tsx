"use client";

import type { Message } from "@openuidev/react-headless";
import { useThread } from "@openuidev/react-headless";

import { useAssistantName } from "./assistant-name";

// While a turn has tool calls but no answer text yet, the tool activity card
// already says what Weave is doing, so a second indicator would just repeat it.
function turnShowsActivity(messages: Message[]): boolean {
  let hasTools = false;
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (!m || m.role === "user") break;
    if (m.role !== "assistant") continue;
    if (m.content) return false;
    if (m.toolCalls && m.toolCalls.length > 0) hasTools = true;
  }
  return hasTools;
}

/**
 * Shown under the thread while a run is in flight and nothing else on screen
 * shows progress: before the first token, or under a streaming answer.
 */
export function LoomThinkingIndicator() {
  const messages = useThread((s) => s.messages);
  const { short } = useAssistantName();
  if (turnShowsActivity(messages)) return null;

  return (
    <div role="status" data-testid="loom-thinking-indicator" className="flex min-h-11 items-center">
      <span className="loom-shimmer text-sm">{short} is thinking</span>
    </div>
  );
}
