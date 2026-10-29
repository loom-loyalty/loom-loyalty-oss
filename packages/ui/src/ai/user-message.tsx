"use client";

import type { InputContent, UserMessage } from "@openuidev/react-headless";

import { AttachmentChip } from "./attachment-chip";

export interface LoomUserMessageProps {
  message: UserMessage;
}

// Replaces OpenUI's default user-message renderer so a binary attachment shows the filename chip instead of an empty bubble. CustomUserMessage replaces UserMessageContainer entirely (see @openuidev/react-ui/AgentInterface/Thread.js), so we also render the openui-agent-thread-message-user wrapper here: ScrollArea anchors new turns on that class.
export function LoomUserMessage({ message }: LoomUserMessageProps) {
  return (
    <div className="openui-agent-thread-message-user" role="group" aria-label="User message">
      <div className="openui-agent-thread-message-user__content">
        {renderContent(message.content)}
      </div>
    </div>
  );
}

// triggerAction wraps payload as <content>…</content><context>…</context>; strip for display.
const TRIGGERED_ACTION_RE = /^<content>([\s\S]*?)<\/content>(?:<context>[\s\S]*?<\/context>)?\s*$/;

function stripTriggeredActionWrapper(content: string): string {
  const m = content.match(TRIGGERED_ACTION_RE);
  return m ? (m[1] ?? "") : content;
}

function renderContent(content: UserMessage["content"]) {
  if (typeof content === "string") {
    const display = stripTriggeredActionWrapper(content);
    return display ? <span>{display}</span> : null;
  }
  if (!Array.isArray(content)) return null;
  return (
    <>
      {(content as InputContent[]).map((part, idx) => {
        // Composite key — survives reconciliation if mixed text/binary parts ever stream in piece by piece.
        if (part.type === "text") {
          return <span key={`text-${idx}`}>{stripTriggeredActionWrapper(part.text ?? "")}</span>;
        }
        if (part.type === "binary") {
          return <AttachmentChip key={`binary-${idx}`} filename={part.filename ?? "Attachment"} />;
        }
        return null;
      })}
    </>
  );
}
