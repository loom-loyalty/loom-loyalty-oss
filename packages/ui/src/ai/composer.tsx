"use client";

import { useThread } from "@openuidev/react-headless";
import { ArrowUp, Paperclip, Square } from "lucide-react";
import { useContext, useEffect, useLayoutEffect, useRef, useState } from "react";

import { cn } from "../lib/utils";
import { ChatAiLimitContext } from "./ai-limit-context";
import { AiLimitNotice } from "./ai-limit-notice";
import { useAssistantName } from "./assistant-name";
import { AttachmentChip } from "./attachment-chip";
import { InitialMessageSender } from "./initial-message-sender";

// 750ms lets the server lock release before the follow-up POST (see chat-stop-then-resend-race changeset).
const POST_CANCEL_COOLDOWN_MS = 750;

/**
 * Allowed program-template file extensions and the MIME types we expect the
 * platform's /api/templates/parse endpoint to accept. .md and .xlsx ship
 * today; .docx is intentionally excluded until that format lands.
 */
const ACCEPTED_EXTENSIONS = {
  ".md": "text/markdown",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
} as const;

const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024; // 5 MB

interface PendingAttachment {
  file: File;
  /** Base64 payload without the `data:mime;base64,` prefix. */
  data: string;
  mimeType: string;
}

/**
 * Kept for compatibility with OpenUI's composer-slot signature. All fields are
 * ignored: the composer sends `InputContent[]` (AG-UI's mixed text + binary
 * content) through `useThread().processMessage` instead of a string `onSend`.
 */
export interface LoomComposerProps {
  onSend?: (message: string) => void;
  onCancel?: () => void;
  isRunning?: boolean;
  isLoadingMessages?: boolean;
}

const extOf = (filename: string): string => {
  const dot = filename.lastIndexOf(".");
  return dot === -1 ? "" : filename.slice(dot).toLowerCase();
};

/**
 * LoomComposer — drop-in replacement for OpenUI's default Composer that adds
 * file-attachment support. Files are submitted as AG-UI `BinaryInputContent`
 * on the user message so the AI agent can receive .md or .xlsx program
 * templates inline; the chat panel callback orchestrates the parse + chat
 * round trip.
 *
 * This component reads `processMessage`, `cancelMessage`, and `isRunning`
 * from `useThread()`, not from `props`, so it only works inside a
 * `<ChatProvider>` tree (AiChatPanel mounts it there).
 */
export function LoomComposer(_props: LoomComposerProps = {}) {
  // useThread() with no selector wraps the slice in zustand's useShallow
  // (see @openuidev/react-headless dist/hooks/useThread.js, the no-arg
  // branch calls useStore(store, useShallow(threadSelector))). Destructuring
  // here is therefore one subscription with shallow-equal rerenders, unlike
  // useThread((s) => ({...})) which skips the useShallow wrap.
  const { processMessage, cancelMessage, isRunning, threadError } = useThread();
  // Set by AiChatPanel when the daily AI allowance refused the last send; the
  // notice replaces the generic error text. Null outside the panel.
  const chatAiLimit = useContext(ChatAiLimitContext);
  const aiLimit = chatAiLimit?.limit ?? null;

  const [textContent, setTextContent] = useState("");
  const [attachment, setAttachment] = useState<PendingAttachment | null>(null);
  const assistantName = useAssistantName();
  const [error, setError] = useState<string | null>(null);
  // Mirror of the most recent threadError message we've shown. Lives in
  // local state (not derived from `threadError`) so a retry can clear it
  // synchronously — the OpenUI store never resets threadError, so a derived
  // `error ?? threadError?.message` would leave the stale banner up during
  // the in-flight retry until a NEW threadError landed.
  const [shownError, setShownError] = useState<string | null>(null);
  // Post-cancel cooldown — see POST_CANCEL_COOLDOWN_MS comment above.
  const [coolingDown, setCoolingDown] = useState(false);
  const cooldownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // The OpenUI thread store catches processMessage failures internally and
  // writes them to `threadError` instead of re-throwing. We snapshot the
  // user's input on submit and restore it (along with the error message)
  // when a new threadError lands.
  const lastSubmitRef = useRef<{ text: string; attachment: PendingAttachment | null } | null>(null);
  const lastSeenErrorRef = useRef<Error | null>(null);

  // React to a new threadError: mirror the message into shownError so the
  // banner clears on retry, and restore the snapshotted input. The ref
  // guard makes this fire at most once per Error identity. The
  // eslint-disable is required because eslint-plugin-react-hooks@7+
  // ships a new `set-state-in-effect` rule that flags this pattern —
  // it's the documented "subscribe to an external store and reflect
  // into local state" path (the store never re-throws to our caller and
  // never auto-clears its own threadError, so observing it here is the
  // only failure surface). Removing the disable line breaks CI lint.
  useEffect(() => {
    if (!threadError || threadError === lastSeenErrorRef.current) return;
    lastSeenErrorRef.current = threadError;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- store-sync pattern, see comment above
    setShownError(threadError.message);
    const snap = lastSubmitRef.current;
    if (!snap) return;
    setTextContent(snap.text);
    setAttachment(snap.attachment);
    lastSubmitRef.current = null;
  }, [threadError]);

  // Displayed error: prefer the local file-validation message, fall back
  // to the most-recently-seen threadError (which the user can clear by
  // submitting again).
  const displayedError = error ?? shownError;

  useLayoutEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${ta.scrollHeight}px`;
  }, [textContent]);

  // Cleanup pending cooldown timer if the composer unmounts mid-cooldown.
  useEffect(() => {
    return () => {
      if (cooldownTimerRef.current) clearTimeout(cooldownTimerRef.current);
    };
  }, []);

  const handleCancel = () => {
    cancelMessage();
    setCoolingDown(true);
    if (cooldownTimerRef.current) clearTimeout(cooldownTimerRef.current);
    cooldownTimerRef.current = setTimeout(() => setCoolingDown(false), POST_CANCEL_COOLDOWN_MS);
  };

  const handleFileSelect = (file: File | null) => {
    setError(null);
    if (!file) {
      setAttachment(null);
      return;
    }
    const ext = extOf(file.name);
    if (!(ext in ACCEPTED_EXTENSIONS)) {
      setError("Only .md and .xlsx files are supported.");
      return;
    }
    if (file.size > MAX_ATTACHMENT_BYTES) {
      const limitMb = MAX_ATTACHMENT_BYTES / (1024 * 1024);
      setError(`File is too large (max ${limitMb} MB).`);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        setError("Could not read the file.");
        return;
      }
      const commaIdx = result.indexOf(",");
      const data = commaIdx === -1 ? result : result.slice(commaIdx + 1);
      const mimeType = file.type || ACCEPTED_EXTENSIONS[ext as keyof typeof ACCEPTED_EXTENSIONS];
      setAttachment({ file, data, mimeType });
    };
    reader.onerror = () => setError("Could not read the file.");
    reader.readAsDataURL(file);
  };

  const handleSubmit = () => {
    if (isRunning || coolingDown) return;
    const trimmed = textContent.trim();
    if (!trimmed && !attachment) return;

    // Remember the input so the threadError effect above can restore it if
    // processMessage rejects (the store catches its own throws, so we can't
    // try/catch around the await — observing threadError is the documented
    // failure surface).
    lastSubmitRef.current = { text: textContent, attachment };

    setTextContent("");
    setAttachment(null);
    setError(null);
    setShownError(null);
    chatAiLimit?.clear();
    if (fileInputRef.current) fileInputRef.current.value = "";

    if (attachment) {
      const parts: Array<
        | { type: "text"; text: string }
        | { type: "binary"; mimeType: string; data: string; filename: string }
      > = [];
      if (trimmed) parts.push({ type: "text", text: trimmed });
      parts.push({
        type: "binary",
        mimeType: attachment.mimeType,
        data: attachment.data,
        filename: attachment.file.name,
      });
      void processMessage({ role: "user", content: parts });
    } else {
      void processMessage({ role: "user", content: trimmed });
    }
  };

  const placeholder = attachment
    ? "Add a note (optional) and press Enter"
    : `Ask ${assistantName.short} anything…`;

  return (
    <div className="border-border bg-card shrink-0 border-t p-3">
      <InitialMessageSender />
      {attachment && (
        <AttachmentChip
          filename={attachment.file.name}
          className="mb-2"
          onRemove={() => {
            setAttachment(null);
            if (fileInputRef.current) fileInputRef.current.value = "";
          }}
        />
      )}
      {!error && aiLimit ? (
        <AiLimitNotice limit={aiLimit} className="mb-2" />
      ) : (
        displayedError && (
          <div role="alert" className="text-destructive mb-2 text-xs" data-testid="composer-error">
            {displayedError}
          </div>
        )
      )}
      <div
        className={cn(
          "border-input-border bg-background flex items-end gap-1 rounded-xl border p-1 transition-shadow",
          "focus-within:border-secondary focus-within:ring-ring focus-within:ring-2"
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".md,.xlsx"
          className="sr-only"
          onChange={(e) => handleFileSelect(e.target.files?.[0] ?? null)}
          tabIndex={-1}
          aria-hidden="true"
          data-testid="composer-file-input"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          aria-label="Attach a program template"
          title="Attach a program template (.md or .xlsx)"
          disabled={isRunning}
          className={cn(
            "text-muted-foreground hover:text-foreground hover:bg-muted inline-flex h-11 w-11 shrink-0",
            "items-center justify-center rounded-lg transition-colors disabled:opacity-50",
            "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none"
          )}
        >
          <Paperclip size="1em" aria-hidden="true" />
        </button>
        <textarea
          ref={textareaRef}
          autoFocus
          rows={1}
          value={textContent}
          onChange={(e) => setTextContent(e.target.value)}
          className="text-foreground placeholder:text-muted-foreground max-h-40 min-h-11 flex-1 resize-none bg-transparent py-3 text-sm focus:outline-none"
          placeholder={placeholder}
          aria-label="Message"
          data-loom-composer-input
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmit();
            }
          }}
        />
        <button
          type="button"
          onClick={isRunning ? handleCancel : handleSubmit}
          aria-label={isRunning ? "Stop" : "Send"}
          disabled={!isRunning && (coolingDown || (!textContent.trim() && !attachment))}
          data-testid="composer-send-button"
          className={cn(
            "bg-primary text-primary-foreground hover:bg-primary-dark inline-flex h-11 w-11 shrink-0",
            "items-center justify-center rounded-lg transition-colors disabled:opacity-50",
            "focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          )}
        >
          {isRunning ? (
            <Square size="1em" fill="currentColor" aria-hidden="true" />
          ) : (
            <ArrowUp size="1em" aria-hidden="true" />
          )}
        </button>
      </div>
    </div>
  );
}
