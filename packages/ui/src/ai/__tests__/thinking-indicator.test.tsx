import "@testing-library/jest-dom/vitest";

import type { Message } from "@openuidev/react-headless";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const threadState: { messages: Message[] } = { messages: [] };

vi.mock("@openuidev/react-headless", () => ({
  useThread: <T,>(selector: (s: typeof threadState) => T) => selector(threadState),
}));

import { LoomThinkingIndicator } from "../thinking-indicator";

const user: Message = { id: "u1", role: "user", content: "hi" };
const toolCall = {
  id: "tc",
  type: "function" as const,
  function: { name: "weave", arguments: "" },
};

describe("LoomThinkingIndicator", () => {
  beforeEach(() => {
    threadState.messages = [];
  });

  it("shows before the first assistant token", () => {
    threadState.messages = [user];
    render(<LoomThinkingIndicator />);
    expect(screen.getByRole("status")).toHaveTextContent("Weave is thinking");
  });

  it("hides while the tool activity card is the only progress on screen", () => {
    threadState.messages = [user, { id: "a1", role: "assistant", toolCalls: [toolCall] }];
    render(<LoomThinkingIndicator />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("shows again under a streaming answer", () => {
    threadState.messages = [
      user,
      { id: "a1", role: "assistant", toolCalls: [toolCall] },
      { id: "a2", role: "assistant", content: "root = Stack(" },
    ];
    render(<LoomThinkingIndicator />);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("ignores tool calls from earlier turns", () => {
    threadState.messages = [
      { id: "u0", role: "user", content: "first" },
      { id: "a0", role: "assistant", toolCalls: [toolCall] },
      user,
    ];
    render(<LoomThinkingIndicator />);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });
});
