"use client";

import { useThread, useThreadList } from "@openuidev/react-headless";
import { SquarePen, X } from "lucide-react";

import { cn } from "../lib/utils";
import { SheetDescription, SheetTitle } from "../primitives/sheet";
import { useAssistantName } from "./assistant-name";
import { WeaveMark } from "./weave-mark";

const ICON_BUTTON = cn(
  "text-chrome-muted-foreground inline-flex size-11 items-center justify-center rounded-md transition-colors",
  "hover:bg-card/70 hover:text-chrome-foreground disabled:pointer-events-none disabled:opacity-40",
  "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none"
);

export interface ChatHeaderProps {
  onClose: () => void;
}

/** The chat sheet's title bar, in the same chrome as the app's top header. */
export function ChatHeader({ onClose }: ChatHeaderProps) {
  const hasMessages = useThread((s) => s.messages.length > 0);
  const isRunning = useThread((s) => s.isRunning);
  const switchToNewThread = useThreadList((s) => s.switchToNewThread);
  const { title } = useAssistantName();

  return (
    <header className="border-chrome-border bg-chrome text-chrome-foreground flex h-16 shrink-0 items-center gap-3 border-b pr-2 pl-4">
      <WeaveMark />
      <div className="min-w-0 flex-1">
        <SheetTitle className="text-chrome-foreground text-base leading-tight font-semibold">
          {title}
        </SheetTitle>
        <SheetDescription className="text-chrome-muted-foreground truncate text-xs">
          Your loyalty program assistant
        </SheetDescription>
      </div>
      <button
        type="button"
        onClick={(e) => {
          switchToNewThread();
          // This button disables itself once the thread is empty; hand focus
          // to the composer so keyboard users aren't dropped to <body>.
          e.currentTarget
            .closest('[role="dialog"]')
            ?.querySelector<HTMLTextAreaElement>("[data-loom-composer-input]")
            ?.focus();
        }}
        disabled={!hasMessages || isRunning}
        aria-label="New chat"
        title="New chat"
        className={ICON_BUTTON}
      >
        <SquarePen className="size-5" aria-hidden="true" />
      </button>
      <button type="button" onClick={onClose} aria-label="Close AI chat" className={ICON_BUTTON}>
        <X className="size-5" aria-hidden="true" />
      </button>
    </header>
  );
}
