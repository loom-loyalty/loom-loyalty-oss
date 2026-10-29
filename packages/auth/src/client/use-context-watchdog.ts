/**
 * Cross-tab auth-context watchdog.
 *
 * When the user switches organization (dashboard) or environment (hub) in one
 * tab, every other open tab keeps a stale in-memory JWT/org context and drifts
 * out of sync with the authoritative session. This module lets the switching
 * tab announce the change and every other tab detect the divergence and
 * `window.location.reload()` to re-sync.
 *
 * Transport is a `BroadcastChannel` with a `localStorage` event fallback for
 * browsers without it (Safari < 15.4). A `visibilitychange` re-check catches
 * any signal a backgrounded tab missed.
 *
 * Everything is guarded for SSR / Cloudflare Workers (no `window`).
 */

import { useEffect, useRef } from "react";

/** Shared BroadcastChannel name. Unique to Loom — does not clash with WorkOS AuthKit. */
const CHANNEL_NAME = "loom-auth-context-change";

/** localStorage key used as the BroadcastChannel fallback transport. */
const STORAGE_KEY = "loom-auth-context-change";

/**
 * sessionStorage timestamp marking how long a freshly reloaded tab should ignore
 * incoming signals. Prevents a reload→broadcast→reload loop right after re-sync.
 */
const SUPPRESS_UNTIL_KEY = "loom-watchdog-suppress-until";

/** Debounce before reloading, so a burst of signals collapses into one reload. */
const RELOAD_DEBOUNCE_MS = 500;

/** How long a reloaded tab suppresses further reloads. */
const SUPPRESS_WINDOW_MS = 5000;

/** In-memory snapshot of the tab's current auth context. */
export interface ContextSnapshot {
  orgKey: string | null;
  envId?: string | null;
}

/** Payload broadcast by the switching tab. */
export interface ContextChangeMessage {
  type: "context-changed";
  orgKey: string;
  envId?: string;
}

/** localStorage fallback payload — same as the message plus a timestamp to force a change event. */
interface StoredContextChange extends ContextChangeMessage {
  ts: number;
}

/**
 * Pure divergence check. Exported for unit testing.
 *
 * Returns true when the tab's in-memory context no longer matches the
 * authoritative context announced by another tab:
 * - the in-memory org id differs from the message, OR
 * - the org matches but both env ids are present and differ.
 *
 * A null in-memory org id means "not loaded yet" — the tab has no context to
 * be stale, so it is never treated as drift (and we never reload a
 * half-initialized tab). An env id is only compared when present on both sides.
 */
export function isOutOfSync(inMemory: ContextSnapshot, message: ContextChangeMessage): boolean {
  // Not loaded yet → nothing to be out of sync with.
  if (inMemory.orgKey === null) return false;

  if (inMemory.orgKey !== message.orgKey) return true;

  // Same org: an env switch only counts when both sides expose an env id.
  if (inMemory.envId != null && message.envId != null && inMemory.envId !== message.envId) {
    return true;
  }
  return false;
}

/**
 * Announce an org/env switch to other tabs. Call this in the switching tab
 * BEFORE its own `window.location.reload()`.
 *
 * Posts a BroadcastChannel message and mirrors the payload to localStorage as
 * a fallback for browsers without BroadcastChannel. The switching tab needs no
 * self-flag: once it reloads onto the new org, isOutOfSync compares equal and
 * it will not reload again.
 *
 * @param orgKey Opaque app-defined org key for the org being switched to (hub
 *   passes its Loom org id; dashboard passes its WorkOS org id — only
 *   consistency within an app matters, so peers compare like-for-like).
 * @param envId Optional environment id being switched to.
 */
export function broadcastContextChange(orgKey: string, envId?: string): void {
  if (typeof window === "undefined") return;

  const message: ContextChangeMessage = { type: "context-changed", orgKey };
  if (envId != null) message.envId = envId;

  // Primary transport: BroadcastChannel.
  try {
    if (typeof BroadcastChannel !== "undefined") {
      const channel = new BroadcastChannel(CHANNEL_NAME);
      channel.postMessage(message);
      channel.close();
    }
  } catch {
    // Ignore — fall back to localStorage below.
  }

  // Fallback transport: localStorage write fires a `storage` event in other tabs.
  // ts guarantees the value changes even when switching to the same ids twice.
  try {
    const stored: StoredContextChange = { ...message, ts: Date.now() };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  } catch {
    // localStorage may be unavailable.
  }
}

/** True while a freshly reloaded tab should ignore incoming signals. */
function isWithinSuppressWindow(): boolean {
  try {
    const raw = window.sessionStorage.getItem(SUPPRESS_UNTIL_KEY);
    if (!raw) return false;
    const until = Number.parseInt(raw, 10);
    return Number.isFinite(until) && Date.now() < until;
  } catch {
    return false;
  }
}

/** Mark the next-loaded tab to suppress reloads for SUPPRESS_WINDOW_MS. */
function armSuppressWindow(): void {
  try {
    window.sessionStorage.setItem(SUPPRESS_UNTIL_KEY, String(Date.now() + SUPPRESS_WINDOW_MS));
  } catch {
    // sessionStorage may be unavailable.
  }
}

/** Parse a localStorage fallback payload into a message, or null if invalid. */
function parseStoredMessage(raw: string | null): ContextChangeMessage | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<StoredContextChange>;
    if (parsed?.type !== "context-changed" || typeof parsed.orgKey !== "string") {
      return null;
    }
    const message: ContextChangeMessage = {
      type: "context-changed",
      orgKey: parsed.orgKey,
    };
    if (typeof parsed.envId === "string") message.envId = parsed.envId;
    return message;
  } catch {
    return null;
  }
}

/**
 * Watchdog hook. Mount once in each app's root component.
 *
 * @param getInMemoryContext Reader returning the tab's current in-memory
 *   org/env context. Called lazily on each signal so it always sees current
 *   state (kept in a ref to avoid re-subscribing on every render).
 */
export function useContextWatchdog(getInMemoryContext: () => ContextSnapshot): void {
  // Keep the latest reader in a ref so the mount-once effect reads *current*
  // context on each signal — not the closure captured on first render, when
  // auth state is still loading and the org id is null.
  const getContextRef = useRef(getInMemoryContext);
  getContextRef.current = getInMemoryContext;

  useEffect(() => {
    if (typeof window === "undefined") return;

    let reloadTimer: ReturnType<typeof setTimeout> | null = null;
    // Cache the last announced payload so visibilitychange can re-compare
    // without a network/token read.
    let lastMessage: ContextChangeMessage | null = null;

    const scheduleReloadIfDrifted = (message: ContextChangeMessage): void => {
      lastMessage = message;
      // Suppress is checked per signal (not once at mount) so the tab keeps
      // listening for future switches and only skips reloads during the short
      // post-reload window. Registering listeners unconditionally is what keeps
      // a tab from going deaf after it reloads; a tab never reloads on its own
      // announcement because isOutOfSync compares equal once it is on that org.
      if (isWithinSuppressWindow()) return;
      if (!isOutOfSync(getContextRef.current(), message)) return;
      if (reloadTimer !== null) return; // already scheduled
      reloadTimer = setTimeout(() => {
        // Arm the suppress window on the *next* load so the reloaded tab does
        // not immediately bounce again on a lingering signal.
        armSuppressWindow();
        window.location.reload();
      }, RELOAD_DEBOUNCE_MS);
    };

    // (a) Primary transport.
    let channel: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== "undefined") {
      try {
        channel = new BroadcastChannel(CHANNEL_NAME);
        channel.onmessage = (event: MessageEvent) => {
          const data = event.data as ContextChangeMessage | undefined;
          if (data?.type === "context-changed" && typeof data.orgKey === "string") {
            scheduleReloadIfDrifted(data);
          }
        };
      } catch {
        channel = null;
      }
    }

    // (b) Fallback transport: storage events for our key only.
    const handleStorage = (event: StorageEvent): void => {
      if (event.key !== STORAGE_KEY) return;
      const message = parseStoredMessage(event.newValue);
      if (message) scheduleReloadIfDrifted(message);
    };
    window.addEventListener("storage", handleStorage);

    // (c) Re-check on tab focus to catch missed signals. Compares current
    // in-memory context against the last payload we saw — no token fetch.
    const handleVisibility = (): void => {
      if (document.visibilityState !== "visible") return;
      // Prefer the live broadcast payload; fall back to whatever is in storage.
      const message = lastMessage ?? parseStoredMessage(window.localStorage.getItem(STORAGE_KEY));
      if (message) scheduleReloadIfDrifted(message);
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      if (reloadTimer !== null) clearTimeout(reloadTimer);
      window.removeEventListener("storage", handleStorage);
      document.removeEventListener("visibilitychange", handleVisibility);
      if (channel) {
        channel.onmessage = null;
        channel.close();
      }
    };
    // getInMemoryContext is read lazily on each signal; we intentionally
    // subscribe once on mount and do not re-run when the reader identity changes.
  }, []);
}
