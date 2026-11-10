import type { Dispatch, ReactNode, SetStateAction } from "react";
import { createContext, useCallback, useContext, useMemo, useState } from "react";

interface AiChatContextValue {
  /** Whether the AI chat panel is open */
  aiPanelOpen: boolean;
  /** Set the AI chat panel open state */
  setAiPanelOpen: Dispatch<SetStateAction<boolean>>;
  /** Initial message to send when the panel opens */
  aiInitialMessage: string | undefined;
  /** Open the chat panel and pre-populate with a message */
  openWithMessage: (message: string) => void;
  /** Clear the initial message (after it's been sent) */
  clearInitialMessage: () => void;
  /** An existing thread to select when the panel opens (from the home page's recent list) */
  aiInitialThreadId: string | undefined;
  /** Open the chat panel on an existing thread */
  openThread: (threadId: string) => void;
  /** Clear the initial thread (after the panel has selected it) */
  clearInitialThread: () => void;
}

const AiChatContext = createContext<AiChatContextValue | null>(null);

/**
 * Provider for AI chat panel state.
 * Any descendant can open the chat panel with a message already sent via
 * useAiChat().openWithMessage(...), or on an existing conversation via
 * useAiChat().openThread(id).
 *
 * Wrap the app root with this provider, then render <AiChatPanel /> bound to the
 * context values. Consumers throughout the app call useAiChat() to drive it.
 */
export function AiChatProvider({ children }: { children: ReactNode }): ReactNode {
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [aiInitialMessage, setAiInitialMessage] = useState<string | undefined>(undefined);
  const [aiInitialThreadId, setAiInitialThreadId] = useState<string | undefined>(undefined);

  // A message and a thread are two ways to open the panel; the later call
  // wins, so the panel never both selects a thread and starts a new one.
  const openWithMessage = useCallback((message: string) => {
    setAiInitialThreadId(undefined);
    setAiInitialMessage(message);
    setAiPanelOpen(true);
  }, []);

  const clearInitialMessage = useCallback(() => {
    setAiInitialMessage(undefined);
  }, []);

  const openThread = useCallback((threadId: string) => {
    setAiInitialMessage(undefined);
    setAiInitialThreadId(threadId);
    setAiPanelOpen(true);
  }, []);

  const clearInitialThread = useCallback(() => {
    setAiInitialThreadId(undefined);
  }, []);

  // Memoize the context value so descendants re-render only when the actual state changes.
  // Without this, every render of <AiChatProvider> (caused by any state change anywhere in
  // its tree) produces a new value object, forcing all useAiChat() consumers to re-run.
  const value = useMemo(
    () => ({
      aiPanelOpen,
      setAiPanelOpen,
      aiInitialMessage,
      openWithMessage,
      clearInitialMessage,
      aiInitialThreadId,
      openThread,
      clearInitialThread,
    }),
    [
      aiPanelOpen,
      aiInitialMessage,
      openWithMessage,
      clearInitialMessage,
      aiInitialThreadId,
      openThread,
      clearInitialThread,
    ]
  );

  return <AiChatContext.Provider value={value}>{children}</AiChatContext.Provider>;
}

/**
 * Hook to access AI chat panel controls.
 * Throws if called outside an AiChatProvider.
 */
export function useAiChat(): AiChatContextValue {
  const ctx = useContext(AiChatContext);
  if (!ctx) {
    throw new Error("useAiChat must be used within an AiChatProvider");
  }
  return ctx;
}

/**
 * Like useAiChat, but returns null outside an AiChatProvider, for components
 * that offer the chat only when the host app has one.
 */
export function useOptionalAiChat(): AiChatContextValue | null {
  return useContext(AiChatContext);
}
