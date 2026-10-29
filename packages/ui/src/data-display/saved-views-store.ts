// Persistence seam for named list-view presets. Swap this localStorage adapter for a BE-synced one later with no UI/hook churn. Scope (e.g. `org:env:entity`) keeps presets from leaking across tenants.

import { z } from "zod";

/** Maximum presets retained per scope; oldest-over-cap are dropped on save. */
const MAX_VIEWS = 50;
const DEFAULT_NAMESPACE = "loom-hub-saved-views";
const CHANGE_EVENT = "loom-hub-saved-views-changed";

const EMPTY: readonly SavedView[] = Object.freeze([]);

const SavedViewSchema = z.object({
  id: z.string().min(1).max(100),
  name: z.string().min(1).max(120),
  search: z.record(z.string(), z.unknown()),
  createdAt: z.number().int().nonnegative(),
});

const StorageSchema = z.object({
  version: z.literal(1),
  views: z.array(SavedViewSchema).max(MAX_VIEWS),
});

/** A named snapshot of a list view's URL search state. */
export interface SavedView {
  id: string;
  name: string;
  /** Cleaned URL search object for this view. */
  search: Record<string, unknown>;
  createdAt: number;
}

/** Storage seam for saved views. Swap the implementation to sync to a backend. */
export interface SavedViewsAdapter {
  /** Current views for a scope. Returns a stable reference until changed. */
  list(scope: string): readonly SavedView[];
  /** Upsert a view by id (most recent first); returns the new list. */
  save(scope: string, view: SavedView): readonly SavedView[];
  /** Remove a view by id; returns the new list. */
  remove(scope: string, viewId: string): readonly SavedView[];
  /** Subscribe to changes for a scope (same-tab + cross-tab). Returns cleanup. */
  subscribe(scope: string, listener: () => void): () => void;
}

interface ChangeDetail {
  key: string;
}

// localStorage adapter: Zod-validated, cross-tab sync, SSR/quota guards, per-scope stable refs for useSyncExternalStore.
export function createLocalStorageSavedViewsAdapter(opts?: {
  namespace?: string;
}): SavedViewsAdapter {
  const namespace = opts?.namespace ?? DEFAULT_NAMESPACE;
  const cache = new Map<string, { raw: string | null; views: readonly SavedView[] }>();

  const storageKey = (scope: string): string => `${namespace}:${scope}`;

  function parse(key: string, raw: string | null): readonly SavedView[] {
    if (raw === null) return EMPTY;
    try {
      const result = StorageSchema.safeParse(JSON.parse(raw) as unknown);
      if (!result.success) {
        safeRemove(key);
        return EMPTY;
      }
      return Object.freeze(result.data.views.slice(0, MAX_VIEWS));
    } catch {
      safeRemove(key);
      return EMPTY;
    }
  }

  function safeRemove(key: string): void {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // ignore
    }
  }

  function read(scope: string): readonly SavedView[] {
    if (typeof window === "undefined") return EMPTY;
    const key = storageKey(scope);
    let raw: string | null;
    try {
      raw = window.localStorage.getItem(key);
    } catch {
      return EMPTY;
    }
    const cached = cache.get(scope);
    if (cached && cached.raw === raw) return cached.views;
    const views = parse(key, raw);
    cache.set(scope, { raw, views });
    return views;
  }

  function write(scope: string, views: readonly SavedView[]): readonly SavedView[] {
    const capped = Object.freeze(views.slice(0, MAX_VIEWS));
    if (typeof window === "undefined") {
      cache.set(scope, { raw: null, views: capped });
      return capped;
    }
    const key = storageKey(scope);
    const raw = JSON.stringify({ version: 1, views: capped });
    try {
      window.localStorage.setItem(key, raw);
      cache.set(scope, { raw, views: capped });
      // Only notify on a persisted change — otherwise readers re-read stale storage.
      broadcast(key);
    } catch {
      // private browsing / quota — drop silently; storage stays the source of truth
    }
    return capped;
  }

  function broadcast(key: string): void {
    if (typeof window === "undefined") return;
    window.dispatchEvent(new CustomEvent<ChangeDetail>(CHANGE_EVENT, { detail: { key } }));
  }

  return {
    list: (scope) => read(scope),

    save: (scope, view) => {
      const current = read(scope);
      const next = [view, ...current.filter((v) => v.id !== view.id)];
      return write(scope, next);
    },

    remove: (scope, viewId) => {
      const current = read(scope);
      if (!current.some((v) => v.id === viewId)) return current;
      return write(
        scope,
        current.filter((v) => v.id !== viewId)
      );
    },

    subscribe: (scope, listener) => {
      if (typeof window === "undefined") return () => {};
      const key = storageKey(scope);
      const onStorage = (event: StorageEvent) => {
        if (event.key === key) listener();
      };
      const onSameTab = (event: Event) => {
        if ((event as CustomEvent<ChangeDetail>).detail?.key === key) listener();
      };
      window.addEventListener("storage", onStorage);
      window.addEventListener(CHANGE_EVENT, onSameTab);
      return () => {
        window.removeEventListener("storage", onStorage);
        window.removeEventListener(CHANGE_EVENT, onSameTab);
      };
    },
  };
}
