"use client";

import { useThread, useThreadList } from "@openuidev/react-headless";
import { AgentInterface } from "@openuidev/react-ui";
import { useContext } from "react";

import { cn } from "../lib/utils";
import { Skeleton } from "../primitives/skeleton";
import { ChatAiLimitContext } from "./ai-limit-context";
import { LoomAssistantMessage } from "./assistant-message";
import { ChatWelcome } from "./chat-welcome";
import { LoomThinkingIndicator } from "./thinking-indicator";
import { LoomToolActivity } from "./tool-activity";
import type { ChatStarter } from "./types";
import { LoomUserMessage } from "./user-message";

export interface ChatThreadProps {
  /** One-click prompts shown while the thread is empty. */
  starters: ChatStarter[];
}

/** The thread body: welcome when empty, a skeleton while a thread loads, else messages. */
export function ChatThread({ starters }: ChatThreadProps) {
  const isEmpty = useThread((s) => s.messages.length === 0);
  const isLoadingMessages = useThread((s) => s.isLoadingMessages);
  const threadError = useThread((s) => s.threadError);
  const selectedThreadId = useThreadList((s) => s.selectedThreadId);
  const selectThread = useThreadList((s) => s.selectThread);
  const switchToNewThread = useThreadList((s) => s.switchToNewThread);
  // OpenUI's own "Something went wrong" callout would repeat a limit refusal
  // the composer already shows as an AiLimitNotice.
  const hasAiLimit = useContext(ChatAiLimitContext)?.limit != null;

  if (isLoadingMessages) {
    return (
      <div className="flex flex-1 flex-col gap-6 px-5 py-6" aria-busy="true">
        <Skeleton className="ml-auto h-10 w-2/3 rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="ml-auto h-10 w-1/2 rounded-xl" />
      </div>
    );
  }
  // A selected thread with no messages and an error is a history that failed
  // to load (a send failure leaves the optimistic user message in place).
  // Showing the welcome here would invite a send into a thread whose history
  // is hidden, so offer a retry instead.
  if (isEmpty && threadError && selectedThreadId) {
    const threadId = selectedThreadId;
    return (
      <div
        data-loom-thread-load-error
        className="flex flex-1 flex-col items-center justify-center gap-3 px-5 text-center"
      >
        <p className="text-foreground text-sm font-medium">Couldn&apos;t load this conversation.</p>
        <p className="text-muted-foreground text-sm">{threadError.message}</p>
        <button
          type="button"
          onClick={() => {
            // selectThread ignores the thread that is already selected, so
            // step off it first.
            switchToNewThread();
            selectThread(threadId);
          }}
          className="text-primary-dark hover:bg-muted focus-visible:ring-ring inline-flex min-h-11 items-center rounded-md px-3 text-sm font-medium focus-visible:ring-2 focus-visible:outline-none"
        >
          Retry
        </button>
      </div>
    );
  }
  if (isEmpty) return <ChatWelcome starters={starters} />;

  return (
    // role="log": screen readers announce each new message (additions only,
    // so a streaming reply isn't read out chunk by chunk).
    <div
      role="log"
      aria-label="Conversation"
      aria-live="polite"
      aria-relevant="additions"
      className={cn(
        "loom-chat-thread flex min-h-0 flex-1 flex-col",
        hasAiLimit && "[&_.openui-agent-thread-error]:hidden"
      )}
    >
      <AgentInterface.ScrollArea>
        <AgentInterface.Messages
          loader={<LoomThinkingIndicator />}
          assistantMessage={LoomAssistantMessage}
          userMessage={LoomUserMessage}
          toolCallTimeline={LoomToolActivity}
        />
      </AgentInterface.ScrollArea>
    </div>
  );
}
