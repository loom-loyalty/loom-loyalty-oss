"use client";

import { ArrowUp } from "lucide-react";
import { useCallback, useState } from "react";

import { cn } from "../lib/utils";
import { useAiChat } from "./ai-chat-context";
import { assistantNameFor } from "./assistant-name";
import type { ChatStarter } from "./types";
import { WeaveMark } from "./weave-mark";

export interface HomePromptProps {
  /** One-click prompts under the box. */
  starters: ChatStarter[];
  /** White-label brand; the box is named "Message <brand> AI". Omit for Weave. */
  brandName?: string;
  className?: string;
}

/**
 * HomePrompt — a Weave prompt box for an app's home page. Enter, Send or a
 * starter chip hands the text to the chat sheet (`useAiChat().openWithMessage`),
 * which opens with that message already sent as a new conversation. The box
 * itself never talks to the AI server.
 */
export function HomePrompt({ starters, brandName, className }: HomePromptProps) {
  const { openWithMessage } = useAiChat();
  const { short } = assistantNameFor(brandName);
  const [text, setText] = useState("");

  // React flushes the cleared box before the next discrete keydown, so a
  // second Enter finds an empty box and sends nothing.
  const send = useCallback(
    (message: string) => {
      const trimmed = message.trim();
      if (!trimmed) return;
      openWithMessage(trimmed);
      setText("");
    },
    [openWithMessage]
  );

  const canSend = text.trim().length > 0;

  return (
    <section
      aria-label={`Ask ${short}`}
      className={cn("border-border bg-card rounded-lg border p-4 shadow-sm sm:p-5", className)}
    >
      <div className="flex items-start gap-3">
        <WeaveMark size="md" className="mt-1 hidden sm:inline-flex" />
        <div className="min-w-0 flex-1 space-y-3">
          <div
            className={cn(
              "border-input-border bg-background flex items-end gap-1 rounded-xl border p-1 transition-shadow",
              "focus-within:border-secondary focus-within:ring-ring focus-within:ring-2"
            )}
          >
            <textarea
              rows={1}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(text);
                }
              }}
              aria-label={`Message ${short}`}
              placeholder={`Ask ${short} anything about your loyalty program…`}
              className="text-foreground placeholder:text-muted-foreground field-sizing-content max-h-40 min-h-11 flex-1 resize-none bg-transparent px-3 py-3 text-sm focus:outline-none"
            />
            <button
              type="button"
              onClick={() => send(text)}
              disabled={!canSend}
              aria-label="Send"
              className={cn(
                "bg-primary text-primary-foreground hover:bg-primary-dark inline-flex h-11 w-11 shrink-0",
                "items-center justify-center rounded-lg transition-colors disabled:opacity-50",
                "focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
              )}
            >
              <ArrowUp size="1em" aria-hidden="true" />
            </button>
          </div>
          <ul className="flex flex-wrap gap-2" aria-label="Suggested prompts">
            {starters.map((starter) => (
              <li key={starter.prompt}>
                <button
                  type="button"
                  onClick={() => send(starter.prompt)}
                  className={cn(
                    "border-border bg-background text-foreground hover:border-primary hover:text-primary-dark",
                    "inline-flex min-h-11 items-center rounded-full border px-4 text-sm transition-colors",
                    "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none"
                  )}
                >
                  {starter.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
