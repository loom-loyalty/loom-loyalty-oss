import { useCallback, useMemo, useSyncExternalStore } from "react";
import type { SavedQuery } from "../types";

const DEFAULT_STORAGE_KEY = "spindle:saved-queries";

function generateId(): string {
  return `sqy_${crypto.randomUUID().replace(/-/g, "")}`;
}

function readQueries(key: string): SavedQuery[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    return JSON.parse(raw) as SavedQuery[];
  } catch {
    return [];
  }
}

function writeQueries(key: string, queries: SavedQuery[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(queries));
  } catch {
    // localStorage may be full or unavailable
  }
}

// One store per storage key so multi-tenant works correctly
const stores = new Map<
  string,
  {
    listeners: Array<() => void>;
    snapshot: SavedQuery[];
  }
>();

function getStore(key: string) {
  let store = stores.get(key);
  if (!store) {
    store = { listeners: [], snapshot: readQueries(key) };
    stores.set(key, store);
  }
  return store;
}

function emitChange(key: string): void {
  const store = getStore(key);
  store.snapshot = readQueries(key);
  for (const listener of store.listeners) {
    listener();
  }
}

/**
 * Saved queries CRUD hook backed by localStorage.
 *
 * @param storageKey — Optional per-tenant key. Defaults to "spindle:saved-queries".
 *   Pass a tenant-scoped key (e.g. `spindle:saved-queries:${envId}`) to isolate
 *   queries between orgs/environments.
 */
export function useSavedQueries(storageKey?: string): {
  queries: SavedQuery[];
  save: (name: string, sql: string) => SavedQuery;
  update: (id: string, updates: Partial<Pick<SavedQuery, "name" | "sql" | "favorite">>) => void;
  remove: (id: string) => void;
  toggleFavorite: (id: string) => void;
} {
  const key = storageKey ?? DEFAULT_STORAGE_KEY;

  const subscribe = useMemo(
    () => (listener: () => void) => {
      const store = getStore(key);
      store.listeners = [...store.listeners, listener];
      return () => {
        store.listeners = store.listeners.filter((l) => l !== listener);
      };
    },
    [key]
  );

  const getSnapshot = useMemo(() => () => getStore(key).snapshot, [key]);

  const queries = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const save = useCallback(
    (name: string, sql: string): SavedQuery => {
      const now = new Date().toISOString();
      const query: SavedQuery = {
        id: generateId(),
        name,
        sql,
        createdAt: now,
        updatedAt: now,
        favorite: false,
      };
      writeQueries(key, [query, ...readQueries(key)]);
      emitChange(key);
      return query;
    },
    [key]
  );

  const update = useCallback(
    (id: string, updates: Partial<Pick<SavedQuery, "name" | "sql" | "favorite">>) => {
      const all = readQueries(key);
      const existing = all.find((q) => q.id === id);
      if (!existing) return;
      const updated = { ...existing, ...updates, updatedAt: new Date().toISOString() };
      writeQueries(
        key,
        all.map((q) => (q.id === id ? updated : q))
      );
      emitChange(key);
    },
    [key]
  );

  const remove = useCallback(
    (id: string) => {
      writeQueries(
        key,
        readQueries(key).filter((q) => q.id !== id)
      );
      emitChange(key);
    },
    [key]
  );

  const toggleFavorite = useCallback(
    (id: string) => {
      const all = readQueries(key);
      const existing = all.find((q) => q.id === id);
      if (!existing) return;
      const updated = {
        ...existing,
        favorite: !existing.favorite,
        updatedAt: new Date().toISOString(),
      };
      writeQueries(
        key,
        all.map((q) => (q.id === id ? updated : q))
      );
      emitChange(key);
    },
    [key]
  );

  return { queries, save, update, remove, toggleFavorite };
}
