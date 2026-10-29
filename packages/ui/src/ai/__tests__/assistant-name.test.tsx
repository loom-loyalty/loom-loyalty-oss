import "@testing-library/jest-dom/vitest";

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const store = { messages: [], isRunning: false, switchToNewThread: vi.fn() };

vi.mock("@openuidev/react-headless", () => ({
  useThread: <T,>(selector: (s: typeof store) => T) => selector(store),
  useThreadList: <T,>(selector: (s: typeof store) => T) => selector(store),
}));

vi.mock("../../primitives/sheet", () => ({
  SheetTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  SheetDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
}));

import { AssistantNameContext, assistantNameFor, WEAVE_ASSISTANT_NAME } from "../assistant-name";
import { ChatHeader } from "../chat-header";

describe("assistantNameFor", () => {
  it("is Weave without a white-label brand", () => {
    expect(assistantNameFor(undefined)).toEqual(WEAVE_ASSISTANT_NAME);
    expect(assistantNameFor("")).toEqual(WEAVE_ASSISTANT_NAME);
  });

  it("is '<Brand> AI' for a white-label brand", () => {
    expect(assistantNameFor("Acme Rewards")).toEqual({
      title: "Acme Rewards AI",
      short: "Acme Rewards AI",
    });
  });
});

describe("ChatHeader title", () => {
  it("says Weave AI by default", () => {
    render(<ChatHeader onClose={vi.fn()} />);
    expect(screen.getByRole("heading", { name: "Weave AI" })).toBeInTheDocument();
  });

  it("names the white-label brand's assistant", () => {
    render(
      <AssistantNameContext.Provider value={assistantNameFor("Acme Rewards")}>
        <ChatHeader onClose={vi.fn()} />
      </AssistantNameContext.Provider>
    );
    expect(screen.getByRole("heading", { name: "Acme Rewards AI" })).toBeInTheDocument();
    expect(screen.queryByText(/Weave/)).not.toBeInTheDocument();
  });
});
