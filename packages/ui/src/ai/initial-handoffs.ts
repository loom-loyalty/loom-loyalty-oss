"use client";

import { useMemo, useRef } from "react";

import type { InitialMessageHandoff } from "./initial-message-sender";
import type { InitialThreadHandoff } from "./initial-thread-selector";

export interface InitialHandoffs {
  initialMessageHandoff: InitialMessageHandoff | null;
  initialThreadHandoff: InitialThreadHandoff | null;
}

/**
 * The claim-once handoffs for a message (`openWithMessage`) and a thread
 * (`openThread`). Call it from a component that stays mounted while the chat
 * sheet closes and reopens (`AiChatPanel`), so a handoff the host has not
 * cleared yet is still claimed after a reopen instead of sending or selecting
 * again. A new value makes a new, unclaimed handoff, so the same text handed
 * off twice (cleared in between) sends twice. The thread callback lives in a
 * ref so an inline `onInitialThreadOpened` doesn't mint a fresh handoff on
 * every host render.
 */
export function useInitialHandoffs({
  initialMessage,
  initialThreadId,
  onInitialThreadOpened,
}: {
  initialMessage?: string;
  initialThreadId?: string;
  onInitialThreadOpened?: () => void;
}): InitialHandoffs {
  const initialMessageHandoff = useMemo<InitialMessageHandoff | null>(() => {
    if (!initialMessage) return null;
    let claimed = false;
    return {
      message: initialMessage,
      claim: () => {
        if (claimed) return false;
        claimed = true;
        return true;
      },
    };
  }, [initialMessage]);

  const onInitialThreadOpenedRef = useRef(onInitialThreadOpened);
  onInitialThreadOpenedRef.current = onInitialThreadOpened;
  const initialThreadHandoff = useMemo<InitialThreadHandoff | null>(() => {
    if (!initialThreadId) return null;
    let claimed = false;
    return {
      threadId: initialThreadId,
      onOpened: () => onInitialThreadOpenedRef.current?.(),
      claim: () => {
        if (claimed) return false;
        claimed = true;
        return true;
      },
    };
  }, [initialThreadId]);

  return useMemo(
    () => ({ initialMessageHandoff, initialThreadHandoff }),
    [initialMessageHandoff, initialThreadHandoff]
  );
}
