import "@testing-library/jest-dom/vitest";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

const switchToNewThread = vi.fn();
const store = { messages: [{ id: "u1" }], isRunning: false, switchToNewThread };

vi.mock("@openuidev/react-headless", () => ({
  useThread: <T,>(selector: (s: typeof store) => T) => selector(store),
  useThreadList: <T,>(selector: (s: typeof store) => T) => selector(store),
}));

// SheetTitle/SheetDescription need a Radix Dialog root; plain elements stand in.
vi.mock("../../primitives/sheet", () => ({
  SheetTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  SheetDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
}));

import { ChatHeader } from "../chat-header";

describe("ChatHeader", () => {
  it("starts a new thread and hands focus to the composer", async () => {
    const user = userEvent.setup();
    render(
      <div role="dialog">
        <ChatHeader onClose={vi.fn()} />
        <textarea aria-label="Message" data-loom-composer-input />
      </div>
    );
    await user.click(screen.getByRole("button", { name: "New chat" }));
    expect(switchToNewThread).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("textbox", { name: "Message" })).toHaveFocus();
  });

  it("closes the sheet", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<ChatHeader onClose={onClose} />);
    await user.click(screen.getByRole("button", { name: "Close AI chat" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
