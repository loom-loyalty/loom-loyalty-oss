import "@testing-library/jest-dom/vitest";

import type { UserMessage } from "@openuidev/react-headless";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LoomUserMessage } from "../user-message";

function makeMessage(content: UserMessage["content"]): UserMessage {
  return {
    id: "msg-1",
    role: "user",
    content,
  };
}

describe("LoomUserMessage", () => {
  it("renders plain-string content as a text span", () => {
    render(<LoomUserMessage message={makeMessage("hello world")} />);
    const content = document.querySelector(".openui-agent-thread-message-user__content");
    expect(content).toBeInTheDocument();
    expect(content).toHaveTextContent("hello world");
    // No attachment chip when there's no binary part.
    expect(screen.queryByTestId("attachment-chip")).not.toBeInTheDocument();
  });

  it("renders a binary-only message as a single attachment chip with filename", () => {
    render(
      <LoomUserMessage
        message={makeMessage([
          {
            type: "binary",
            mimeType: "text/markdown",
            data: "ZmFrZS1iYXNlNjQ=",
            filename: "coffee-program.md",
          },
        ])}
      />
    );
    const chip = screen.getByTestId("attachment-chip");
    expect(chip).toBeInTheDocument();
    expect(chip).toHaveTextContent("coffee-program.md");
    // Filename also shows in the title attribute for hover truncation.
    expect(within(chip).getByTitle("coffee-program.md")).toBeInTheDocument();
    // No remove button — the chip is read-only in the bubble.
    expect(screen.queryByRole("button", { name: /remove attachment/i })).not.toBeInTheDocument();
  });

  it("renders text + binary in order: text span first, then chip", () => {
    render(
      <LoomUserMessage
        message={makeMessage([
          { type: "text", text: "Here is my template:" },
          {
            type: "binary",
            mimeType: "text/markdown",
            data: "ZmFrZQ==",
            filename: "rewards.md",
          },
        ])}
      />
    );
    const content = document.querySelector(".openui-agent-thread-message-user__content");
    expect(content).toBeInTheDocument();
    expect(content!.textContent).toMatch(/^Here is my template:rewards\.md/);

    const chip = screen.getByTestId("attachment-chip");
    expect(chip).toHaveTextContent("rewards.md");
  });

  it("falls back to 'Attachment' label when a binary part has no filename", () => {
    render(
      <LoomUserMessage
        message={makeMessage([
          { type: "binary", mimeType: "application/octet-stream", data: "Zg==" },
        ])}
      />
    );
    expect(screen.getByTestId("attachment-chip")).toHaveTextContent("Attachment");
  });

  it("strips <content>/<context> wrapper from triggerAction-sent strings", () => {
    render(
      <LoomUserMessage
        message={makeMessage(
          '<content>Show me available program templates</content><context>["User clicked: Show me available program templates"]</context>'
        )}
      />
    );
    const content = document.querySelector(".openui-agent-thread-message-user__content");
    expect(content).toHaveTextContent("Show me available program templates");
    // No raw angle brackets leak through.
    expect(content!.textContent).not.toContain("<content>");
    expect(content!.textContent).not.toContain("<context>");
  });

  it("strips <content> wrapper even when no <context> is present", () => {
    render(<LoomUserMessage message={makeMessage("<content>Just a content tag</content>")} />);
    const content = document.querySelector(".openui-agent-thread-message-user__content");
    expect(content).toHaveTextContent("Just a content tag");
    expect(content!.textContent).not.toContain("<content>");
  });

  it("passes plain strings through unchanged when no wrapper is present", () => {
    render(<LoomUserMessage message={makeMessage("just a plain message")} />);
    const content = document.querySelector(".openui-agent-thread-message-user__content");
    expect(content).toHaveTextContent("just a plain message");
  });

  it("strips wrapper from text parts inside an InputContent array", () => {
    render(
      <LoomUserMessage
        message={makeMessage([
          {
            type: "text",
            text: '<content>Use this template</content><context>["selected: HOTEL_REWARDS"]</context>',
          },
        ])}
      />
    );
    const content = document.querySelector(".openui-agent-thread-message-user__content");
    expect(content).toHaveTextContent("Use this template");
    expect(content!.textContent).not.toContain("<content>");
  });

  it("renders the OpenUI bubble container so teal styling + scroll anchor selectors match", () => {
    render(<LoomUserMessage message={makeMessage("hi")} />);
    // CSS in globals.css targets .openui-agent-thread-message-user__content (teal pill); OpenUI's ScrollArea anchors new turns on the outer .openui-agent-thread-message-user.
    expect(document.querySelector(".openui-agent-thread-message-user")).toBeInTheDocument();
  });
});
