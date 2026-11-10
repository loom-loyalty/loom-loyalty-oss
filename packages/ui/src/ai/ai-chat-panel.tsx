"use client";

import { Sheet, SheetContent, SheetOverlay, SheetPortal } from "../primitives/sheet";
import { AiChatProviders } from "./ai-chat-providers";
import { ChatHeader } from "./chat-header";
import { ChatThread } from "./chat-thread";
import { LoomComposer } from "./composer";
import { useInitialHandoffs } from "./initial-handoffs";
import { DEFAULT_CHAT_STARTERS } from "./starters";
import type { AiChatPanelProps } from "./types";

/**
 * AiChatPanel — the Weave chat as a right-side Sheet.
 *
 * Loom chrome (header, welcome, tool activity, thinking indicator, composer)
 * inside `AiChatProviders`, which owns the chat store, transport and thread
 * storage.
 */
export function AiChatPanel({ open, onOpenChange, ...providerProps }: AiChatPanelProps) {
  // Built here, where the component stays mounted across a close and reopen,
  // so a handoff the host hasn't cleared yet isn't claimed twice.
  const handoffs = useInitialHandoffs(providerProps);
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetPortal>
        <SheetOverlay />
        <SheetContent
          side="right"
          className="bg-background flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-[40vw] sm:min-w-[420px] lg:max-w-[40vw] xl:max-w-[38vw]"
          hideCloseButton
        >
          <AiChatProviders {...providerProps} handoffs={handoffs}>
            <ChatHeader onClose={() => onOpenChange(false)} />
            <ChatThread starters={DEFAULT_CHAT_STARTERS} />
            <LoomComposer />
          </AiChatProviders>
        </SheetContent>
      </SheetPortal>
    </Sheet>
  );
}
