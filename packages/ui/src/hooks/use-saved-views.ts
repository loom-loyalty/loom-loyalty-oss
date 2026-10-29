// Named filter presets for a list view, keyed by a caller-supplied `scope`. Pairs with useListControls (pass its `currentSearch` + `applySearch`). Callers compose the scope (e.g. `${org}:${env}:${entity}`) so the hook stays app-agnostic.

import { useCallback, useMemo, useSyncExternalStore } from "react";

import {
  createLocalStorageSavedViewsAdapter,
  type SavedView,
} from "../data-display/saved-views-store";

const adapter = createLocalStorageSavedViewsAdapter();
const EMPTY: readonly SavedView[] = Object.freeze([]);

function generateId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `view_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Shallow compare two cleaned control-search records (values are primitives). */
function searchEqual(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  const aKeys = Object.keys(a);
  if (aKeys.length !== Object.keys(b).length) return false;
  return aKeys.every((key) => Object.is(a[key], b[key]));
}

export interface UseSavedViewsArgs {
  /** Storage scope (e.g. `${org}:${env}:${entity}`). Pass `null` to disable persistence (pre-auth). */
  scope: string | null;
  /** Current control-only search snapshot (from `useListControls`). */
  currentSearch: Record<string, unknown>;
  /** Apply a view's search (wire to `useListControls.applySearch`). */
  onApply: (search: Record<string, unknown>) => void;
  /**
   * Normalize a stored view's search before comparing against currentSearch. Use to
   * drop keys the current spec strips (e.g. `q` when `disableQ` is set) so older
   * saved views still activate after the spec narrows.
   */
  normalizeView?: (search: Record<string, unknown>) => Record<string, unknown>;
}

export interface UseSavedViewsResult {
  views: readonly SavedView[];
  /** Id of the view matching the current search, or null. */
  activeViewId: string | null;
  saveCurrentAs: (name: string) => void;
  applyView: (id: string) => void;
  deleteView: (id: string) => void;
}

export function useSavedViews({
  scope,
  currentSearch,
  onApply,
  normalizeView,
}: UseSavedViewsArgs): UseSavedViewsResult {
  const subscribe = useCallback(
    (listener: () => void) => (scope ? adapter.subscribe(scope, listener) : () => {}),
    [scope]
  );
  const getSnapshot = useCallback(() => (scope ? adapter.list(scope) : EMPTY), [scope]);
  const views = useSyncExternalStore(subscribe, getSnapshot, () => EMPTY);

  const activeViewId = useMemo(() => {
    const match = views.find((view) =>
      searchEqual(normalizeView ? normalizeView(view.search) : view.search, currentSearch)
    );
    return match?.id ?? null;
  }, [views, currentSearch, normalizeView]);

  const saveCurrentAs = useCallback(
    (name: string) => {
      const trimmed = name.trim();
      if (!scope || !trimmed) return;
      adapter.save(scope, {
        id: generateId(),
        name: trimmed,
        search: currentSearch,
        createdAt: Date.now(),
      });
    },
    [scope, currentSearch]
  );

  const applyView = useCallback(
    (id: string) => {
      const view = views.find((v) => v.id === id);
      if (view) onApply(normalizeView ? normalizeView(view.search) : view.search);
    },
    [views, onApply, normalizeView]
  );

  const deleteView = useCallback(
    (id: string) => {
      if (scope) adapter.remove(scope, id);
    },
    [scope]
  );

  return { views, activeViewId, saveCurrentAs, applyView, deleteView };
}
