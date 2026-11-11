import {
  useEntitySearchSearchEntities,
  type SearchResponse,
  type SearchResultResponse,
} from "@loom-loyalty/sdk";
import type { ComponentType } from "react";
import { useCallback, useMemo, useState } from "react";

import { useCommandPaletteShortcut } from "../hooks/use-command-palette-shortcut";
import { useDebouncedValue } from "../hooks/use-debounced-value";
import { createScopePrefixMap, parseScopeWithPrefixes } from "./command-palette-utils";
import {
  readRecentItems,
  rememberRecentItem,
  writeRecentItems,
  type CommandPaletteRecentItem,
} from "./recent-items";
import type {
  CommandPaletteErrorState,
  CommandPaletteQuickAction,
  CommandPaletteScope,
} from "./types";

const MIN_QUERY_LENGTH = 3;
const SEARCH_DEBOUNCE_MS = 250;
const PAGE_SIZE = 10;

export interface CommandPaletteController {
  open: boolean;
  setOpen: (next: boolean) => void;
  toggle: () => void;
  query: string;
  setQuery: (next: string) => void;
  results: SearchResultResponse[];
  isLoading: boolean;
  errorState: CommandPaletteErrorState | null;
  didYouMean: string | null;
  onSelect: (result: SearchResultResponse) => void;
  activeScope: string | null;
  onActiveScopeChange: (nextScopeKey: string | null) => void;
  onDidYouMeanClick: (suggestion: string) => void;
  effectiveQueryLength: number;
  scopes: CommandPaletteScope[];
  entityTypeLabels: Record<string, string>;
  entityTypeIcons: Record<string, ComponentType<{ className?: string }>>;
  minQueryLength: number;
  /** Results recently opened from the palette, newest first (empty without a key). */
  recentItems: SearchResultResponse[];
  quickActions: CommandPaletteQuickAction[];
  onQuickActionSelect: (action: CommandPaletteQuickAction) => void;
}

export interface UseCommandPaletteControllerOptions {
  onSelect: (result: SearchResultResponse) => void;
  scopes: CommandPaletteScope[];
  entityTypeLabels: Record<string, string>;
  entityTypeIcons: Record<string, ComponentType<{ className?: string }>>;
  /**
   * Browser-storage key for the "Recent" list, from `buildRecentItemsKey`. Pass null until the
   * user and organization environment are known; nothing is remembered without a key.
   */
  recentItemsKey?: string | null;
  /** Fixed shortcuts shown when the palette opens with an empty query. */
  quickActions?: CommandPaletteQuickAction[];
}

const NO_QUICK_ACTIONS: CommandPaletteQuickAction[] = [];

function toSearchResult(item: CommandPaletteRecentItem): SearchResultResponse {
  return {
    entityId: item.entityId,
    entityType: item.entityType,
    displayLabel: item.displayLabel,
    sourceUrl: item.sourceUrl,
    snippetText: "",
    matchRanges: [],
    score: 0,
  };
}

/**
 * Shared command-palette state and Platform search orchestration. Applications
 * retain ownership of result navigation through the required `onSelect`.
 */
export function useCommandPaletteController({
  onSelect,
  scopes,
  entityTypeLabels,
  entityTypeIcons,
  recentItemsKey = null,
  quickActions = NO_QUICK_ACTIONS,
}: UseCommandPaletteControllerOptions): CommandPaletteController {
  const [open, setOpenState] = useState(false);
  // Recents are tied to the key they were read for, so switching org environment never shows
  // the previous environment's list, even for one render.
  const [recentState, setRecentState] = useState<{
    key: string | null;
    items: CommandPaletteRecentItem[];
  }>(() => ({ key: recentItemsKey, items: readRecentItems(recentItemsKey) }));
  const recent = useMemo(
    () =>
      recentState.key === recentItemsKey ? recentState.items : readRecentItems(recentItemsKey),
    [recentState, recentItemsKey]
  );
  const [query, setQuery] = useState("");
  const scopePrefixes = useMemo(() => createScopePrefixMap(scopes), [scopes]);
  const parsed = useMemo(
    () => parseScopeWithPrefixes(query, scopePrefixes),
    [query, scopePrefixes]
  );
  const debouncedFullQuery = useDebouncedValue(query.trim(), SEARCH_DEBOUNCE_MS);
  const debouncedBody = useDebouncedValue(parsed.rest.trim(), SEARCH_DEBOUNCE_MS);
  const enabled = debouncedBody.length >= MIN_QUERY_LENGTH;

  const setOpen = useCallback((next: boolean) => {
    setOpenState(next);
    if (!next) setQuery("");
  }, []);

  const onActiveScopeChange = useCallback(
    (nextScopeKey: string | null) => {
      setQuery((previous) => {
        const { rest } = parseScopeWithPrefixes(previous, scopePrefixes);
        if (nextScopeKey === null) return rest;

        const scope = scopes.find((candidate) => candidate.key === nextScopeKey);
        if (!scope?.prefix) return rest;

        const body = rest.trimStart();
        return body ? `${scope.prefix}:${body}` : `${scope.prefix}:`;
      });
    },
    [scopePrefixes, scopes]
  );

  // Keep the established behavior: keyboard toggling does not clear a query.
  useCommandPaletteShortcut(setOpenState);

  const search = useEntitySearchSearchEntities(
    { q: debouncedFullQuery, page: 0, size: PAGE_SIZE },
    { query: { enabled, staleTime: 30_000, refetchOnWindowFocus: false } }
  );

  const successPayload = useMemo<SearchResponse | undefined>(() => {
    if (!search.data) return undefined;
    return search.data.status === 200 ? search.data.data : undefined;
  }, [search.data]);

  const errorState = useMemo<CommandPaletteErrorState | null>(() => {
    if (!search.isError && !search.data) return null;
    if (search.data?.status === 429) return "rate-limited";
    // A missing scope is a 403 on newer releases and was a 401 on older ones; both read as a
    // failed search. Session refresh on a genuine 401 happens in the SDK client, not here.
    // Widened: the spec does not list 403 for search yet, so the generated union omits it.
    const status: number | undefined = search.data?.status;
    if (status === 401 || status === 403 || search.isError) return "error";
    return null;
  }, [search.data, search.isError]);

  const onDidYouMeanClick = useCallback(
    (suggestion: string) => {
      setQuery((previous) => {
        const { scope } = parseScopeWithPrefixes(previous, scopePrefixes);
        if (!scope) return suggestion;

        const definition = scopes.find((candidate) => candidate.key === scope);
        return definition?.prefix ? `${definition.prefix}:${suggestion}` : suggestion;
      });
    },
    [scopePrefixes, scopes]
  );

  const toggle = useCallback(() => setOpenState((previous) => !previous), []);

  const handleSelect = useCallback(
    (result: SearchResultResponse) => {
      if (recentItemsKey) {
        const next = rememberRecentItem(readRecentItems(recentItemsKey), {
          entityId: result.entityId,
          entityType: result.entityType,
          displayLabel: result.displayLabel,
          sourceUrl: result.sourceUrl,
        });
        writeRecentItems(recentItemsKey, next);
        setRecentState({ key: recentItemsKey, items: next });
      }
      onSelect(result);
    },
    [onSelect, recentItemsKey]
  );

  const onQuickActionSelect = useCallback(
    (action: CommandPaletteQuickAction) => {
      onSelect(
        toSearchResult({
          entityId: action.id,
          entityType: "QUICK_ACTION",
          displayLabel: action.label,
          sourceUrl: action.sourceUrl,
        })
      );
    },
    [onSelect]
  );

  const recentItems = useMemo(() => recent.map(toSearchResult), [recent]);

  return {
    open,
    setOpen,
    toggle,
    query,
    setQuery,
    results: successPayload?.content ?? [],
    isLoading: enabled && search.isFetching,
    errorState,
    didYouMean: successPayload?.didYouMean ?? null,
    onSelect: handleSelect,
    activeScope: parsed.scope,
    onActiveScopeChange,
    onDidYouMeanClick,
    effectiveQueryLength: parsed.rest.trim().length,
    scopes,
    entityTypeLabels,
    entityTypeIcons,
    minQueryLength: MIN_QUERY_LENGTH,
    recentItems,
    quickActions,
    onQuickActionSelect,
  };
}
