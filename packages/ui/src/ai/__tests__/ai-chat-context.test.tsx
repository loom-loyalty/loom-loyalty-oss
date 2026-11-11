import "@testing-library/jest-dom/vitest";
import { act, render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AiChatProvider, useAiChat } from "../ai-chat-context";

type Snapshot = ReturnType<typeof useAiChat>;

function Probe({ onRender }: { onRender: (value: Snapshot) => void }) {
  onRender(useAiChat());
  return null;
}

function mount() {
  let latest!: Snapshot;
  render(
    <AiChatProvider>
      <Probe onRender={(v) => (latest = v)} />
    </AiChatProvider>
  );
  return () => latest;
}

describe("AiChatProvider — thread handoff", () => {
  it("starts closed with no handoff", () => {
    const current = mount();
    expect(current().aiPanelOpen).toBe(false);
    expect(current().aiInitialMessage).toBeUndefined();
    expect(current().aiInitialThreadId).toBeUndefined();
  });

  it("openThread opens the panel on that thread and clearInitialThread forgets it", () => {
    const current = mount();

    act(() => current().openThread("t-1"));
    expect(current().aiPanelOpen).toBe(true);
    expect(current().aiInitialThreadId).toBe("t-1");
    expect(current().aiInitialMessage).toBeUndefined();

    act(() => current().clearInitialThread());
    expect(current().aiInitialThreadId).toBeUndefined();
    expect(current().aiPanelOpen).toBe(true);
  });

  it("openWithMessage after openThread drops the thread handoff, and the reverse", () => {
    const current = mount();

    act(() => current().openThread("t-1"));
    act(() => current().openWithMessage("hello"));
    expect(current().aiInitialMessage).toBe("hello");
    expect(current().aiInitialThreadId).toBeUndefined();

    act(() => current().openThread("t-2"));
    expect(current().aiInitialThreadId).toBe("t-2");
    expect(current().aiInitialMessage).toBeUndefined();
  });
});
