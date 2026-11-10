import "@testing-library/jest-dom/vitest";

import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const chat = vi.hoisted(() => ({
  openWithMessage: vi.fn(),
  openThread: vi.fn(),
}));

vi.mock("../ai-chat-context", () => ({
  useAiChat: () => ({
    aiPanelOpen: false,
    setAiPanelOpen: vi.fn(),
    aiInitialMessage: undefined,
    aiInitialThreadId: undefined,
    openWithMessage: chat.openWithMessage,
    clearInitialMessage: vi.fn(),
    openThread: chat.openThread,
    clearInitialThread: vi.fn(),
  }),
}));

import { HomePrompt } from "../home-prompt";

const starters = [
  { label: "Set up a new loyalty program", prompt: "Set up a new loyalty program" },
  { label: "Attach a program template", prompt: "Attach a program template" },
  { label: "What can you do?", prompt: "What can you do?" },
];

beforeEach(() => {
  chat.openWithMessage.mockClear();
  chat.openThread.mockClear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("HomePrompt — render", () => {
  it("is a region named Ask Weave with a Message Weave box, Send and the starters", () => {
    const fetchSpy = vi.spyOn(global, "fetch");
    render(<HomePrompt starters={starters} />);

    const region = screen.getByRole("region", { name: "Ask Weave" });
    expect(within(region).getByRole("textbox", { name: "Message Weave" })).toBeVisible();
    expect(within(region).getByRole("button", { name: "Send" })).toBeVisible();
    const chips = within(region).getAllByRole("button", { name: /program|can you do/ });
    expect(chips.map((c) => c.textContent)).toEqual(starters.map((s) => s.label));
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("names the box after a white-label brand", () => {
    render(<HomePrompt starters={starters} brandName="Acme" />);
    expect(screen.getByRole("region", { name: "Ask Acme AI" })).toBeVisible();
    expect(screen.getByRole("textbox", { name: "Message Acme AI" })).toBeVisible();
  });

  it("gives every control a 44px target", () => {
    render(<HomePrompt starters={starters} />);
    expect(screen.getByRole("textbox", { name: "Message Weave" }).className).toMatch(/min-h-11/);
    for (const button of screen.getAllByRole("button")) {
      expect(button.className).toMatch(/(min-)?h-11/);
    }
  });
});

describe("HomePrompt — sending", () => {
  it("Enter hands the text to openWithMessage once and clears the box", async () => {
    const user = userEvent.setup();
    render(<HomePrompt starters={starters} />);
    const box = screen.getByRole("textbox", { name: "Message Weave" });

    await user.type(box, "How many members joined this week?{Enter}");

    expect(chat.openWithMessage).toHaveBeenCalledTimes(1);
    expect(chat.openWithMessage).toHaveBeenCalledWith("How many members joined this week?");
    expect(box).toHaveValue("");
  });

  it("Send does the same and trims the text", async () => {
    const user = userEvent.setup();
    render(<HomePrompt starters={starters} />);
    const box = screen.getByRole("textbox", { name: "Message Weave" });

    await user.type(box, "  Find a customer  ");
    await user.click(screen.getByRole("button", { name: "Send" }));

    expect(chat.openWithMessage).toHaveBeenCalledTimes(1);
    expect(chat.openWithMessage).toHaveBeenCalledWith("Find a customer");
    expect(box).toHaveValue("");
  });

  it("a double Enter in one frame sends exactly once", () => {
    render(<HomePrompt starters={starters} />);
    const box = screen.getByRole("textbox", { name: "Message Weave" });

    fireEvent.change(box, { target: { value: "Show me my program analytics" } });
    fireEvent.keyDown(box, { key: "Enter" });
    fireEvent.keyDown(box, { key: "Enter" });

    expect(chat.openWithMessage).toHaveBeenCalledTimes(1);
  });

  it("does nothing for an empty or whitespace box", async () => {
    const user = userEvent.setup();
    render(<HomePrompt starters={starters} />);
    const box = screen.getByRole("textbox", { name: "Message Weave" });

    await user.click(box);
    await user.keyboard("{Enter}");
    await user.type(box, "   {Enter}");
    await user.click(screen.getByRole("button", { name: "Send" }));

    expect(chat.openWithMessage).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
  });

  it("Shift+Enter inserts a newline instead of sending", async () => {
    const user = userEvent.setup();
    render(<HomePrompt starters={starters} />);
    const box = screen.getByRole("textbox", { name: "Message Weave" });

    await user.type(box, "first line{Shift>}{Enter}{/Shift}second line");

    expect(chat.openWithMessage).not.toHaveBeenCalled();
    expect(box).toHaveValue("first line\nsecond line");
  });

  it("a starter chip sends its prompt", async () => {
    const user = userEvent.setup();
    render(<HomePrompt starters={starters} />);

    await user.click(screen.getByRole("button", { name: "What can you do?" }));

    expect(chat.openWithMessage).toHaveBeenCalledTimes(1);
    expect(chat.openWithMessage).toHaveBeenCalledWith("What can you do?");
  });

  it("can send again after the first handoff", async () => {
    const user = userEvent.setup();
    render(<HomePrompt starters={starters} />);
    const box = screen.getByRole("textbox", { name: "Message Weave" });

    await user.type(box, "one{Enter}");
    await user.type(box, "two{Enter}");

    expect(chat.openWithMessage.mock.calls.map((c) => c[0])).toEqual(["one", "two"]);
  });
});
