import {
  type SearchResponse,
  type SearchResultResponse,
  useEntitySearchSearchEntities,
} from "@loom-loyalty/sdk";
import type { ComponentType } from "react";
import { useCallback, useMemo, useState } from "react";

import { useCommandPaletteShortcut } from "../hooks/use-command-palette-shortcut";
import { useDebouncedValue } from "../hooks/use-debounced-value";
import { createScopePrefixMap, parseScopeWithPrefixes } from "./command-palette-utils";
import type { CommandPaletteErrorState, CommandPaletteScope } from "./types";

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
}

export interface UseCommandPaletteControllerOptions {
  onSelect: (result: SearchResultResponse) => void;
  scopes: CommandPaletteScope[];
  entityTypeLabels: Record<string, string>;
  entityTypeIcons: Record<string, ComponentType<{ className?: string }>>;
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
}: UseCommandPaletteControllerOptions): CommandPaletteController {
  const [open, setOpenState] = useState(false);
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
    onSelect,
    activeScope: parsed.scope,
    onActiveScopeChange,
    onDidYouMeanClick,
    effectiveQueryLength: parsed.rest.trim().length,
    scopes,
    entityTypeLabels,
    entityTypeIcons,
    minQueryLength: MIN_QUERY_LENGTH,
  };
}
