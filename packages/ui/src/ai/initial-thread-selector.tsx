"use client";

import { useThreadList } from "@openuidev/react-headless";
import { createContext, useContext, useEffect } from "react";

/**
 * A thread handed to the chat with `openThread`, and a claim that returns
 * true only for the first caller per handoff, so effects that run twice
 * (StrictMode, a remount) select it once.
 */
export interface InitialThreadHandoff {
  threadId: string;
  claim: () => boolean;
  /** Called once the thread has been selected. */
  onOpened?: () => void;
}

export const InitialThreadContext = createContext<InitialThreadHandoff | null>(null);

/**
 * Selects the handed-off thread as soon as the chat mounts, so a recent
 * conversation clicked on the home page opens in the sheet with its
 * messages loading. Renders nothing; it must sit inside the ChatProvider.
 */
export function InitialThreadSelector() {
  const handoff = useContext(InitialThreadContext);
  const selectThread = useThreadList((s) => s.selectThread);

  useEffect(() => {
    if (!handoff || !handoff.claim()) return;
    selectThread(handoff.threadId);
    handoff.onOpened?.();
  }, [handoff, selectThread]);

  return null;
}
