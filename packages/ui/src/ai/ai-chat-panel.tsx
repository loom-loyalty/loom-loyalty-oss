"use client";

import { AI_LIMIT_MESSAGE, type AiLimit, readAiLimit } from "@loom-loyalty/core";
import {
  agUIAdapter,
  type ChatLLM,
  ChatProvider,
  type ChatStorage,
  type Message,
  type StreamProtocolAdapter,
  type Thread,
  type UserMessage,
  useThread,
  useThreadList,
} from "@openuidev/react-headless";
import { AgentInterface } from "@openuidev/react-ui";
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

import { cn } from "../lib/utils";
import { OpenUIRuntimeProvider } from "../openui";
import { Sheet, SheetContent, SheetOverlay, SheetPortal } from "../primitives/sheet";
import { Skeleton } from "../primitives/skeleton";
import { AiLimitProvider, ChatAiLimitContext, useAiLimitConfig } from "./ai-limit-context";
import { LoomAssistantMessage } from "./assistant-message";
import { AssistantNameContext, assistantNameFor } from "./assistant-name";
import { AiChatActionContext } from "./chat-action-context";
import { ChatHeader } from "./chat-header";
import { ChatWelcome } from "./chat-welcome";
import { LoomComposer } from "./composer";
import { InitialMessageContext, type InitialMessageHandoff } from "./initial-message-sender";
import { LoomThinkingIndicator } from "./thinking-indicator";
import { LoomToolActivity } from "./tool-activity";
import type { AiChatPanelProps, ChatStarter } from "./types";
import { LoomUserMessage } from "./user-message";

/**
 * UPDATE-mode body block forwarded to /api/ai/chat alongside template_parse.
 * Shape matches the Zod schema in apps/ai-server/src/routes/chat.ts; kept
 * narrow on the client (no shared type yet) because the chat-body contract
 * is one-way client→server.
 */
type TemplateUpdatePayload = {
  mode: "update" | "update-failed-detection";
  existingSpec?: unknown;
  entityIds?: Record<string, unknown>;
  updateSafe?: boolean;
  truncatedEntities?: string[];
  crossProgramEventTypeCodes?: string[] | null;
  incompleteSpec?: boolean;
};

type FreeformExtractionResult = {
  expectedField: string;
  value: unknown;
  confidence: number;
  sourceLocation?: { line: number; col: number };
};
type ExtractWarning = { code: string; field?: string; message: string };
type TemplateExtractionsPayload = {
  mode: "ok" | "all-failed" | "extract-failed-detection";
  extractions?: FreeformExtractionResult[];
  warnings?: ExtractWarning[];
};

/**
 * Build common headers for AI API requests.
 */
async function buildHeaders(getToken?: () => Promise<string>): Promise<Record<string, string>> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (getToken) {
    headers["Authorization"] = `Bearer ${await getToken()}`;
  }
  return headers;
}

/**
 * AiChatPanel — OpenUI-powered AI chat container.
 *
 * A right-side Sheet with Loom chrome (header, welcome, tool activity,
 * thinking indicator, composer) around OpenUI's headless chat store and its
 * message list:
 * - AG-UI streaming protocol (via agUIAdapter)
 * - Loom Loyalty OpenUI component library for generative UI
 * - Thread storage backed by the AI server's /api/ai/threads endpoints
 */
export function AiChatPanel({
  open,
  onOpenChange,
  baseUrl,
  getToken,
  credentials,
  initialMessage,
  onInitialMessageSent,
  onCustomAction,
  aiLimitUpgradeHref,
  brandName,
}: AiChatPanelProps) {
  const assistantName = useMemo(() => assistantNameFor(brandName), [brandName]);
  // A daily AI limit refusal captured from the chat stream or a budgeted
  // template call. OpenUI turns RUN_ERROR into a plain Error and drops the
  // event's code, so the stream adapter below records it here for the
  // composer to render as an AiLimitNotice.
  const [aiLimit, setAiLimit] = useState<AiLimit | null>(null);
  const clearAiLimit = useCallback(() => setAiLimit(null), []);
  const chatAiLimit = useMemo(
    () => ({ limit: aiLimit, clear: clearAiLimit }),
    [aiLimit, clearAiLimit]
  );
  const parentAiLimitConfig = useAiLimitConfig();
  // Counts sends, so a stream left over from an earlier send can't set a limit
  // after a newer send has cleared it.
  const sendSeq = useRef(0);

  // The handed-off message is sent automatically once (InitialMessageSender).
  // The claim is per handoff object, so a new openWithMessage with the same
  // text after the last one was cleared sends again.
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

  // Thread API callbacks — maps our REST endpoints to ChatProvider's interface
  const fetchThreadList = useCallback(
    async (cursor?: string) => {
      const headers = await buildHeaders(getToken);
      const url = cursor
        ? `${baseUrl}/api/ai/threads?cursor=${encodeURIComponent(cursor)}`
        : `${baseUrl}/api/ai/threads`;

      const res = await fetch(url, { headers, credentials: credentials ?? undefined });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      return {
        threads: data.threads.map(
          (t: { thread_id: string; title: string | null; created_at: string }) => ({
            id: t.thread_id,
            title: t.title || "Untitled",
            createdAt: t.created_at,
          })
        ),
        nextCursor: data.next_cursor ?? undefined,
      };
    },
    [baseUrl, getToken, credentials]
  );

  const createThread = useCallback(async (_firstMessage: UserMessage): Promise<Thread> => {
    // Thread is created server-side on first message.
    // Generate a UUID here that sendMessage will send as thread_id.
    const id = crypto.randomUUID();
    return { id, title: "", createdAt: new Date().toISOString() };
  }, []);

  const deleteThread = useCallback(
    async (id: string) => {
      const headers = await buildHeaders(getToken);
      const res = await fetch(`${baseUrl}/api/ai/threads/${id}`, {
        method: "DELETE",
        headers,
        credentials: credentials ?? undefined,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    },
    [baseUrl, getToken, credentials]
  );

  const loadThread = useCallback(
    async (threadId: string): Promise<Message[]> => {
      const headers = await buildHeaders(getToken);
      const res = await fetch(`${baseUrl}/api/ai/threads/${threadId}/messages`, {
        headers,
        credentials: credentials ?? undefined,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      // Thread history loads as plain-string content; binary part metadata is dropped, so post-reload bubbles render text only and no attachment chip.
      return data.messages
        .filter((m: { role: string }) => m.role === "user" || m.role === "assistant")
        .map(
          (m: { role: string; content: string; agent?: string }, i: number): Message =>
            m.role === "user"
              ? { id: `${threadId}-${i}`, role: "user" as const, content: m.content }
              : { id: `${threadId}-${i}`, role: "assistant" as const, content: m.content }
        );
    },
    [baseUrl, getToken, credentials]
  );

  // Chat API — the ChatLLM transport's send(). When the user
  // attaches a program template (.md or .xlsx) via LoomComposer, the message
  // content arrives as an AG-UI `InputContent[]` array with a `BinaryInputContent`
  // entry. We first POST the file to `/api/templates/parse`, then include the
  // parsed `{ spec, warnings, pendingExtractions }` in the `/api/ai/chat`
  // request body under `template_parse` so the agent can pick up the
  // pre-parsed spec as its starting point. Parse errors are thrown so the
  // composer's inline error path surfaces them.
  const sendMessage = useCallback(
    async ({
      threadId,
      messages,
      signal,
    }: {
      threadId: string;
      messages: Message[];
      signal: AbortSignal;
    }): Promise<Response> => {
      // A new send retires the previous limit notice; a refusal sets it again.
      sendSeq.current += 1;
      setAiLimit(null);
      // Resolve the auth token ONCE up-front so the parse and chat fetches
      // below share a single JWT round trip instead of calling getToken()
      // twice on the binary-attachment path.
      const token = getToken ? await getToken() : null;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      // Extract the last user message content, handling both string (plain
      // text) and InputContent[] (text + binary attachment) shapes.
      const lastMessage = messages[messages.length - 1];
      const rawContent = lastMessage?.content;
      let userText = "";
      let binaryPart: { mimeType: string; data?: string; url?: string; filename?: string } | null =
        null;

      if (typeof rawContent === "string") {
        userText = rawContent;
      } else if (Array.isArray(rawContent)) {
        for (const part of rawContent as Array<{
          type?: string;
          text?: string;
          mimeType?: string;
          data?: string;
          url?: string;
          filename?: string;
        }>) {
          if (part.type === "text" && typeof part.text === "string") {
            userText = userText ? `${userText}\n${part.text}` : part.text;
          } else if (part.type === "binary" && part.mimeType) {
            // Only one binary part is supported (M1 composer enforces this).
            binaryPart = {
              mimeType: part.mimeType,
              data: part.data,
              url: part.url,
              filename: part.filename,
            };
          }
        }
      }

      // Parse the attached template (if any) via the platform's existing
      // multipart endpoint. The two-call shape keeps the chat route stable
      // and lets parse errors surface inline in the composer.
      let templateParse:
        | {
            spec: unknown;
            warnings?: { code: string; field?: string; message: string }[];
            pendingExtractions?: unknown[];
            filename: string;
          }
        | undefined;
      // UPDATE-vs-CREATE detection. Mirrors the Hub upload-page flow
      // (apps/hub/src/features/template-upload/upload-page.tsx:214-271).
      // 200 → UPDATE with hydrated existing spec; 404 → CREATE (omit); 422 → UPDATE
      // with incompleteSpec=true; 5xx → mode="update-failed-detection" so the agent
      // surfaces that to the user instead of silently falling back to CREATE.
      let templateUpdate: TemplateUpdatePayload | undefined;
      // template_extractions carries LLM-filled values for the markdown
      // parser's freeform sections (descriptions, marketing copy, etc.).
      // When non-empty, the agent renders PendingExtractionList for the
      // low-confidence subset and waits for user ack before apply.
      let templateExtractions: TemplateExtractionsPayload | undefined;
      if (binaryPart) {
        const filename = binaryPart.filename || "template";
        // BinaryInputContent must carry either `data` (inline base64) or
        // `url` (server reference). LoomComposer always populates `data`,
        // but a future caller via the OpenUI slot could omit both — throw
        // a clear error here rather than silently sending an empty file
        // that the parse endpoint would 400 on.
        if (!binaryPart.data && !binaryPart.url) {
          throw new Error(`Attachment "${filename}" has no accessible content.`);
        }
        const fileBytes = binaryPart.data
          ? Uint8Array.from(atob(binaryPart.data), (c) => c.charCodeAt(0))
          : await fetch(binaryPart.url!, { signal: signal })
              .then((r) => r.arrayBuffer())
              .then((b) => new Uint8Array(b));
        const blob = new Blob([fileBytes], { type: binaryPart.mimeType });
        const formData = new FormData();
        formData.set("file", new File([blob], filename, { type: binaryPart.mimeType }));

        const parseHeaders: Record<string, string> = {};
        if (token) parseHeaders["Authorization"] = `Bearer ${token}`;
        // /api/ai/* is the worker-proxied prefix in both dev (Vite + CF
        // plugin) and prod (CF Worker rewrites it to ai-server's
        // /api/templates/parse). Mirror the prefix used by /api/ai/chat.
        const parseRes = await fetch(`${baseUrl}/api/ai/templates/parse`, {
          method: "POST",
          headers: parseHeaders,
          credentials: credentials ?? undefined,
          body: formData,
          signal: signal,
        });
        if (!parseRes.ok) {
          let detail = `HTTP ${parseRes.status}`;
          try {
            const errBody = (await parseRes.json()) as { message?: string; error?: string };
            detail = errBody.message || errBody.error || detail;
          } catch {
            // Body wasn't JSON; the status text alone has to do.
          }
          throw new Error(`Could not parse template "${filename}": ${detail}`);
        }
        // Matches the /api/templates/parse response: warnings are
        // { code, field, message } objects (not strings) and pendingExtractions
        // are FreeformExtractionRequest objects. We forward both opaquely.
        const parseBody = (await parseRes.json()) as {
          spec: unknown;
          warnings?: { code: string; field?: string; message: string }[];
          pendingExtractions?: unknown[];
        };
        templateParse = {
          spec: parseBody.spec,
          warnings: parseBody.warnings,
          pendingExtractions: parseBody.pendingExtractions,
          filename,
        };

        // Probe /program-state to decide UPDATE vs CREATE. Only fire when the
        // parsed spec has a program.code — without one, there's nothing to
        // match against an existing program, so it's unambiguously CREATE.
        const parsedProgramCode = (parseBody.spec as { program?: { code?: string } } | undefined)
          ?.program?.code;
        if (parsedProgramCode) {
          try {
            const probeRes = await fetch(
              `${baseUrl}/api/ai/templates/program-state?programCode=${encodeURIComponent(parsedProgramCode)}`,
              {
                headers: token ? { Authorization: `Bearer ${token}` } : {},
                credentials: credentials ?? undefined,
                signal: signal,
              }
            );
            if (probeRes.status === 200) {
              const probeBody = (await probeRes.json()) as {
                spec: unknown;
                entityIds?: Record<string, unknown>;
                updateSafe?: boolean;
                truncatedEntities?: string[];
                crossProgramEventTypeCodes?: string[] | null;
              };
              templateUpdate = {
                mode: "update",
                existingSpec: probeBody.spec,
                entityIds: probeBody.entityIds,
                updateSafe: probeBody.updateSafe,
                truncatedEntities: probeBody.truncatedEntities,
                // Coerce missing to null so the defensive "treat as shared" branch fires.
                crossProgramEventTypeCodes: probeBody.crossProgramEventTypeCodes ?? null,
              };
            } else if (probeRes.status === 422) {
              templateUpdate = { mode: "update", incompleteSpec: true };
            } else if (probeRes.status === 404) {
              // CREATE path — leave templateUpdate undefined.
            } else {
              // 5xx / unexpected status — surface to the agent so the user
              // can decide whether to retry, treat as CREATE, or abort.
              templateUpdate = { mode: "update-failed-detection" };
            }
          } catch (err) {
            // AbortError → re-throw so the outer caller's abort path runs.
            if (err instanceof Error && err.name === "AbortError") throw err;
            // Network failure on the probe — fall through to detection-failed,
            // same as a 5xx so the agent surfaces the gap.
            templateUpdate = { mode: "update-failed-detection" };
          }
        }

        // Fire /extract for the parser's pending freeform sections. The
        // returned per-field values feed PendingExtractionList for the
        // low-confidence subset; high-confidence values are silently
        // applied. 200 → mode=ok; 422 → all extractions failed (each
        // chip can flip to a "failed" state); 5xx/network → flagged as
        // detection-failed so the agent surfaces the gap.
        const pendingExtractionsArr = (parseBody.pendingExtractions ?? []) as unknown[];
        if (pendingExtractionsArr.length > 0) {
          let limit: AiLimit | null = null;
          try {
            const extractRes = await fetch(`${baseUrl}/api/ai/templates/extract`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
              },
              credentials: credentials ?? undefined,
              body: JSON.stringify({
                partial: parseBody.spec,
                pendingExtractions: pendingExtractionsArr,
              }),
              signal: signal,
            });
            if (extractRes.status === 200) {
              const extractBody = (await extractRes.json()) as {
                extractions: FreeformExtractionResult[];
                warnings?: ExtractWarning[];
              };
              templateExtractions = {
                mode: "ok",
                extractions: extractBody.extractions,
                warnings: extractBody.warnings,
              };
            } else if (extractRes.status === 429 && (limit = await readAiLimit(extractRes))) {
              // The daily AI allowance refused extraction. Stop here and show
              // the limit notice rather than reporting a failed detection —
              // the chat turn would be refused for the same reason.
              setAiLimit(limit);
              throw new Error(AI_LIMIT_MESSAGE);
            } else if (extractRes.status === 422) {
              const errBody = (await extractRes.json().catch(() => ({}))) as {
                warnings?: ExtractWarning[];
              };
              templateExtractions = {
                mode: "all-failed",
                warnings: errBody.warnings ?? [],
              };
            } else {
              templateExtractions = { mode: "extract-failed-detection" };
            }
          } catch (err) {
            if (err instanceof Error && err.name === "AbortError") throw err;
            if (limit) throw err;
            templateExtractions = { mode: "extract-failed-detection" };
          }
        }

        if (!userText) {
          // Empty text with an attachment — synthesize a user message so the
          // chat thread reads naturally and the supervisor has something to
          // route on. Strip syntax characters from the filename (same
          // whitelist the server-side prompt sanitizer uses) so a hostile
          // filename can't smuggle instructions into the user-role bubble.
          const safeFilename = filename.replace(/[^\w.\- ()]/g, "_").slice(0, 255);
          userText = `I uploaded a program template (${safeFilename}).`;
        }
      }

      // Mark initial message as consumed once it's been sent
      if (initialMessage && userText.toLowerCase() === initialMessage.toLowerCase()) {
        onInitialMessageSent?.();
      }

      const response = await fetch(`${baseUrl}/api/ai/chat`, {
        method: "POST",
        headers,
        credentials: credentials ?? undefined,
        body: JSON.stringify({
          message: userText,
          thread_id: threadId,
          ...(templateParse ? { template_parse: templateParse } : {}),
          ...(templateUpdate ? { template_update: templateUpdate } : {}),
          ...(templateExtractions ? { template_extractions: templateExtractions } : {}),
        }),
        signal: signal,
      });
      if (response.status === 429) {
        const limit = await readAiLimit(response);
        if (limit) setAiLimit(limit);
      }
      return response;
    },
    [baseUrl, getToken, credentials, initialMessage, onInitialMessageSent]
  );

  // agUIAdapter, wrapped to capture a coded RUN_ERROR before OpenUI turns it
  // into a plain Error. Events pass through unchanged.
  const streamProtocol = useMemo<StreamProtocolAdapter>(() => {
    const base = agUIAdapter();
    return {
      async *parse(response: Response) {
        const seq = sendSeq.current;
        for await (const event of base.parse(response)) {
          if ((event as { type?: unknown }).type === "RUN_ERROR") {
            const limit = readAiLimit(event as unknown);
            if (limit && seq === sendSeq.current) setAiLimit(limit);
          }
          yield event;
        }
      },
    };
  }, []);

  const llm = useMemo<ChatLLM>(
    () => ({ send: sendMessage, streamProtocol }),
    [sendMessage, streamProtocol]
  );

  const storage = useMemo<ChatStorage>(
    () => ({
      thread: {
        listThreads: fetchThreadList,
        createThread,
        getMessages: loadThread,
        // Titles are set server-side from the first message; nothing to persist.
        updateThread: async (thread: Thread) => thread,
        deleteThread,
      },
    }),
    [fetchThreadList, createThread, loadThread, deleteThread]
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetPortal>
        <SheetOverlay />
        <SheetContent
          side="right"
          className="bg-background flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-[40vw] sm:min-w-[420px] lg:max-w-[40vw] xl:max-w-[38vw]"
          hideCloseButton
        >
          <OpenUIRuntimeProvider baseUrl={baseUrl} getToken={getToken} credentials={credentials}>
            <AiChatActionContext.Provider value={onCustomAction}>
              <InitialMessageContext.Provider value={initialMessageHandoff}>
                <AiLimitProvider
                  upgradeHref={aiLimitUpgradeHref ?? parentAiLimitConfig.upgradeHref}
                  renderLink={parentAiLimitConfig.renderLink}
                >
                  <ChatAiLimitContext.Provider value={chatAiLimit}>
                    <ChatProvider llm={llm} storage={storage}>
                      <AssistantNameContext.Provider value={assistantName}>
                        <AiLimitThreadReset onThreadChange={clearAiLimit} />
                        <ChatHeader onClose={() => onOpenChange(false)} />
                        <ChatThread />
                        <LoomComposer />
                      </AssistantNameContext.Provider>
                    </ChatProvider>
                  </ChatAiLimitContext.Provider>
                </AiLimitProvider>
              </InitialMessageContext.Provider>
            </AiChatActionContext.Provider>
          </OpenUIRuntimeProvider>
        </SheetContent>
      </SheetPortal>
    </Sheet>
  );
}

const CONVERSATION_STARTERS: ChatStarter[] = [
  { label: "Set up a new loyalty program", prompt: "Set up a new loyalty program" },
  { label: "Show me my program analytics", prompt: "Show me my program analytics" },
  { label: "Create a new Event Rule", prompt: "Create a new Event Rule" },
];

/**
 * Clears a captured AI limit notice when the user leaves a thread. A new
 * conversation getting its first id (none to an id) is not leaving, and may
 * land just after its first send was refused.
 */
function AiLimitThreadReset({ onThreadChange }: { onThreadChange: () => void }) {
  const selectedThreadId = useThreadList((s) => s.selectedThreadId);
  const previous = useRef(selectedThreadId);
  useEffect(() => {
    if (previous.current === selectedThreadId) return;
    const left = previous.current != null;
    previous.current = selectedThreadId;
    if (left) onThreadChange();
  }, [selectedThreadId, onThreadChange]);
  return null;
}

/** The thread body: welcome when empty, a skeleton while a thread loads, else messages. */
function ChatThread() {
  const isEmpty = useThread((s) => s.messages.length === 0);
  const isLoadingMessages = useThread((s) => s.isLoadingMessages);
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
  if (isEmpty) return <ChatWelcome starters={CONVERSATION_STARTERS} />;

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
