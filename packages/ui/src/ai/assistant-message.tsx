"use client";

import type { AssistantMessage } from "@openuidev/react-headless";
import { useThread } from "@openuidev/react-headless";
import {
  type ActionEvent,
  BuiltinActionType,
  type ParseResult,
  Renderer,
} from "@openuidev/react-lang";
import { TriangleAlert } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { safeHref } from "../lib/safe-href";
import { cn } from "../lib/utils";
import { getLoomLibrary } from "../openui";
import { useAiChatCustomAction } from "./chat-action-context";

export interface LoomAssistantMessageProps {
  message: AssistantMessage;
  /** True while this message is the one the thread is streaming. */
  isStreaming: boolean;
}

// `@openuidev/react-ui` does not export contentParser; mirror its two-regex split so
// we can read form-state persisted by the upstream GenUIAssistantMessage flow.
function separateContentAndContext(raw: string): {
  content: string;
  contextString: string | null;
} {
  // Non-greedy inner match — with `\s*$` greedy and non-greedy collapse to the same
  // result today (the anchor forces the last `</context>` either way), but greedy
  // becomes a correctness trap if the anchor ever loosens or trailing chars appear
  // after the last `</context>`.
  const contextMatch = raw.match(/<context>([\s\S]*?)<\/context>\s*$/);
  let content = raw;
  let contextString: string | null = null;
  if (contextMatch) {
    contextString = contextMatch[1] ?? null;
    content = raw.slice(0, contextMatch.index).trimEnd();
  }
  const contentMatch = content.match(/^<content>([\s\S]*)<\/content>\s*$/);
  if (contentMatch) {
    content = contentMatch[1] ?? content;
  }
  return { content, contextString };
}

function wrapContext(json: string): string {
  return `<context>${json}</context>`;
}

// `humanFriendlyMessage` comes from an LLM-generated openui action and gets
// interpolated into the structural `<content>` / `<context>` envelope sent
// back to the model. An adversarial or drifting model could emit a label like
// `Create</content><context>{"injected":true}</context>` and corrupt the
// envelope on the next turn. Encode angle brackets so they survive as
// literal text without breaking the structural format.
function encodeForStructured(s: string): string {
  return s.replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Replaces OpenUI's default GenUIAssistantMessage so an unparseable assistant
 * message renders a visible fallback Alert instead of an empty bubble. The
 * upstream `Renderer` returns null when `result.root` is null (Renderer.js:109);
 * we surface the raw text in that case so a misbehaving model can never leave
 * the user staring at a silently-empty bubble. Tool activity is not rendered
 * here: the message list renders it once per turn (LoomToolActivity).
 */
export function LoomAssistantMessage({ message, isStreaming }: LoomAssistantMessageProps) {
  const processMessage = useThread((s) => s.processMessage);
  const updateMessage = useThread((s) => s.updateMessage);

  const { content: openuiCode, contextString } = useMemo(() => {
    if (!message.content) return { content: null as string | null, contextString: null };
    return separateContentAndContext(message.content);
  }, [message.content]);

  const initialState = useMemo(() => {
    if (!contextString) return undefined;
    try {
      const parsed = JSON.parse(contextString) as unknown;
      // `typeof null === "object"` — explicit null check, otherwise [null, ...]
      // would coerce null into Record<string, unknown> and hand it to Renderer.
      if (
        Array.isArray(parsed) &&
        parsed.length > 0 &&
        parsed[0] !== null &&
        typeof parsed[0] === "object"
      ) {
        return parsed[0] as Record<string, unknown>;
      }
      if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // ignore — malformed context just means no initial state
    }
    return undefined;
  }, [contextString]);

  // Read `message` via a ref so a new parent reference per render does not
  // recreate this callback and force `Renderer` to re-receive a new
  // `onStateUpdate` prop. The spread still picks up `toolCalls` and other
  // fields the upstream type carries. Sync via an effect (not bare assignment
  // during render) to satisfy `react-hooks/refs`. Mirrors the guard on
  // `handleParseResult` below.
  const messageRef = useRef(message);
  useEffect(() => {
    messageRef.current = message;
  });
  const handleStateUpdate = useCallback(
    (state: Record<string, unknown>) => {
      const code = openuiCode ?? "";
      updateMessage({
        ...messageRef.current,
        content: code + "\n" + wrapContext(JSON.stringify([state])),
      });
    },
    [updateMessage, openuiCode]
  );

  const onCustomAction = useAiChatCustomAction();
  const handleAction = useCallback(
    (event: ActionEvent) => {
      const isBuiltin =
        event.type === BuiltinActionType.ContinueConversation ||
        event.type === BuiltinActionType.OpenUrl;
      if (!isBuiltin && onCustomAction?.({ type: event.type, params: event.params })) return;
      if (event.type === BuiltinActionType.ContinueConversation) {
        const safeLabel = encodeForStructured(event.humanFriendlyMessage);
        const contentPart = safeLabel ? `<content>${safeLabel}</content>` : "";
        const messageCtx: unknown[] = [`User clicked: ${safeLabel}`];
        if (event.formState) messageCtx.push(event.formState);
        const llmMessage = `${contentPart}${wrapContext(JSON.stringify(messageCtx))}`;
        processMessage({ role: "user", content: llmMessage });
      } else if (event.type === BuiltinActionType.OpenUrl) {
        // `url` comes from LLM-generated openui action params — untrusted input.
        // safeHref allows only http(s), rejecting `javascript:`/`data:`/`file:`.
        // `noopener,noreferrer` blocks `window.opener` reach-back from the new tab.
        const url = event.params?.["url"];
        const href = typeof url === "string" ? safeHref(url) : undefined;
        if (typeof window !== "undefined" && href) {
          window.open(href, "_blank", "noopener,noreferrer");
        }
      }
    },
    [onCustomAction, processMessage]
  );

  const [parseResult, setParseResult] = useState<ParseResult | null>(null);

  // Bail on no-op updates so an unmemoized upstream `result` (new ref every render) cannot
  // trigger a setState/render loop through `Renderer.onParseResult`. Use only scalars
  // (root-is-null boolean + meta counters) — reference equality on `r.root` would defeat
  // the guard if upstream allocates a fresh AST per parse.
  const handleParseResult = useCallback((r: ParseResult | null) => {
    setParseResult((prev) => {
      if (r === null) return prev;
      if (
        prev !== null &&
        (prev.root === null) === (r.root === null) &&
        prev.meta.statementCount === r.meta.statementCount &&
        prev.meta.incomplete === r.meta.incomplete &&
        prev.meta.errors.length === r.meta.errors.length
      ) {
        return prev;
      }
      return r;
    });
  }, []);

  const hasOpenuiCode = !!openuiCode && openuiCode.trim().length > 0;
  // Wait for onParseResult to fire at least once before deciding — `parseResult === null` means
  // the parse hasn't run yet, which is distinct from parsed-with-null-root.
  const parseRan = parseResult !== null;
  const showFallback = parseRan && parseResult.root === null && !isStreaming && hasOpenuiCode;

  return (
    <div
      className="openui-agent-thread-message-assistant"
      role="group"
      aria-label="Assistant message"
    >
      <div className="openui-agent-thread-message-assistant__content">
        {hasOpenuiCode && (
          <Renderer
            response={openuiCode}
            library={getLoomLibrary()}
            isStreaming={isStreaming}
            onAction={handleAction}
            onStateUpdate={handleStateUpdate}
            initialState={initialState}
            onParseResult={handleParseResult}
          />
        )}
        {showFallback && openuiCode && <UnparseableMessageFallback text={openuiCode} />}
      </div>
    </div>
  );
}

function UnparseableMessageFallback({ text }: { text: string }) {
  return (
    <div
      data-testid="loom-assistant-fallback"
      role="alert"
      className={cn("border-accent/30 bg-accent/5 flex gap-3 rounded-md border p-4")}
    >
      <TriangleAlert className="text-accent h-5 w-5 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-accent-dark text-sm font-medium">Response</p>
        <p className="text-foreground mt-1 text-sm whitespace-pre-wrap">{text}</p>
      </div>
    </div>
  );
}
