"use client";

import { useCallback, useState, useSyncExternalStore } from "react";

// Same-tab writes don't fire the window "storage" event, so toggles notify
// subscribers directly; other tabs come through the event.
const listeners = new Set<() => void>();

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

function readStored(storageKey: string): boolean | null {
  try {
    const stored = localStorage.getItem(storageKey);
    return stored === null ? null : stored === "true";
  } catch {
    // localStorage may be unavailable in private browsing or when blocked.
    return null;
  }
}

/**
 * A collapsed flag remembered in localStorage under `storageKey`. Reads go
 * through `useSyncExternalStore`, so a server render and the hydration pass
 * both use `defaultCollapsed` and the stored value takes over right after,
 * with no hydration mismatch. Without a key, or when storage is unavailable,
 * the flag lives in component state for the session.
 */
export function usePersistedCollapse(
  storageKey: string | undefined,
  defaultCollapsed = false
): [collapsed: boolean, toggle: () => void] {
  const [fallback, setFallback] = useState(defaultCollapsed);

  const collapsed = useSyncExternalStore(
    subscribe,
    () => (storageKey ? (readStored(storageKey) ?? fallback) : fallback),
    () => defaultCollapsed
  );

  const toggle = useCallback(() => {
    const next = !collapsed;
    setFallback(next);
    if (storageKey) {
      try {
        localStorage.setItem(storageKey, String(next));
      } catch {
        // The flag still flips for this session through `fallback`.
      }
    }
    for (const notify of listeners) notify();
  }, [collapsed, storageKey]);

  return [collapsed, toggle];
}
