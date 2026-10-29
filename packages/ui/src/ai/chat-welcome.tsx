"use client";

import { useThread } from "@openuidev/react-headless";

import { useAssistantName } from "./assistant-name";
import type { ChatStarter } from "./types";

export interface ChatWelcomeProps {
  starters: ChatStarter[];
}

/** Empty-thread state: what Weave can do, with one-click starters next to the composer. */
export function ChatWelcome({ starters }: ChatWelcomeProps) {
  const processMessage = useThread((s) => s.processMessage);
  const { short } = useAssistantName();
  return (
    <div className="flex flex-1 flex-col justify-end gap-5 overflow-y-auto px-5 pt-10 pb-5">
      <div className="space-y-1.5">
        <h3 className="text-foreground text-xl font-semibold tracking-tight">
          How can {short} help?
        </h3>
        <p className="text-muted-foreground max-w-sm text-sm">
          Ask about your loyalty program, get analytics insights, or draft rules and campaigns.
        </p>
      </div>
      <ul className="divide-border border-border divide-y border-y" aria-label="Suggested prompts">
        {starters.map((starter) => (
          <li key={starter.prompt}>
            <button
              type="button"
              onClick={() => void processMessage({ role: "user", content: starter.prompt })}
              className="text-foreground hover:text-primary-dark focus-visible:ring-ring flex min-h-11 w-full items-center py-2 text-left text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset"
            >
              {starter.label}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
