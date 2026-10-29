"use client";

import { useThread, useThreadList } from "@openuidev/react-headless";
import { createContext, useContext, useEffect } from "react";

/**
 * A message handed to the chat with `openWithMessage`, and a claim that
 * returns true only for the first caller per message. The claim guards the
 * send against effects that run twice (StrictMode, a composer remount).
 */
export interface InitialMessageHandoff {
  message: string;
  claim: () => boolean;
}

export const InitialMessageContext = createContext<InitialMessageHandoff | null>(null);

/**
 * Sends the handed-off message as the first message of a new thread as soon
 * as the chat mounts, so "Draft it" (and any other `openWithMessage` caller)
 * starts the conversation instead of leaving a suggestion to click. Renders
 * nothing; it must sit inside the Copilot's ChatProvider.
 */
export function InitialMessageSender() {
  const handoff = useContext(InitialMessageContext);
  const processMessage = useThread((s) => s.processMessage);
  const switchToNewThread = useThreadList((s) => s.switchToNewThread);

  useEffect(() => {
    if (!handoff || !handoff.claim()) return;
    switchToNewThread();
    void processMessage({ role: "user", content: handoff.message });
  }, [handoff, processMessage, switchToNewThread]);

  return null;
}
