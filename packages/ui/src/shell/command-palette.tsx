"use client";

import { AlertTriangle, Loader2, Lock, Search } from "lucide-react";
import * as React from "react";

import type { CommandPaletteErrorState, CommandPaletteScope } from "@loom-loyalty/core";

import { cn } from "../lib/utils";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "../primitives/command";

/**
 * One result row in the palette. Mirrors `SearchResultResponse` from the SDK
 * structurally so consumers can pass SDK results directly without coupling
 * this UI package to the SDK type.
 */
export interface CommandPaletteResult {
  displayLabel: string;
  entityId: string;
  entityType: string;
  snippetText: string;
  matchRanges: Array<{ start: number; end: number }>;
  score: number;
  sourceUrl?: string;
}

export type { CommandPaletteErrorState, CommandPaletteScope } from "@loom-loyalty/core";

export interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  query: string;
  onQueryChange: (next: string) => void;
  results: CommandPaletteResult[];
  isLoading?: boolean;
  errorState?: CommandPaletteErrorState | null;
  /** Server-side trigram suggestion when totalSize == 0. */
  didYouMean?: string | null;
  onDidYouMeanClick?: (suggestion: string) => void;
  onSelect: (result: CommandPaletteResult) => void;
  /** Below this length we don't render the query-too-short hint as an error. */
  minQueryLength?: number;
  placeholder?: string;
  /** Pretty label per `entityType` (e.g. PROGRAM -> "Programs"). Falls back to type. */
  entityTypeLabels?: Record<string, string>;
  /** Optional icon per `entityType` for the row leading visual. */
  entityTypeIcons?: Record<string, React.ComponentType<{ className?: string }>>;
  /**
   * Selectable scopes shown as chips above the results. Selecting a scope
   * filters visible results to that entity type. Order is preserved.
   */
  scopes?: CommandPaletteScope[];
  /** Currently selected scope `key`, or null/undefined for all. */
  activeScope?: string | null;
  onActiveScopeChange?: (next: string | null) => void;
  /**
   * Optional override for the length the palette uses to gate idle/too-short
   * messaging. When scopes are wired via a query-prefix (e.g. `customer:`)
   * the chip click leaves text in the input, but the user hasn't entered a
   * search term yet — pass the unprefixed body length so the idle/hint
   * copy still reflects the user's actual intent.
   */
  effectiveQueryLength?: number;
}

const DEFAULT_MIN_QUERY_LENGTH = 3;

export function CommandPalette({
  open,
  onOpenChange,
  query,
  onQueryChange,
  results,
  isLoading = false,
  errorState = null,
  didYouMean = null,
  onDidYouMeanClick,
  onSelect,
  minQueryLength = DEFAULT_MIN_QUERY_LENGTH,
  placeholder = "Search across customers, programs, offers…",
  entityTypeLabels,
  entityTypeIcons,
  scopes,
  activeScope = null,
  onActiveScopeChange,
  effectiveQueryLength,
}: CommandPaletteProps) {
  const trimmedQuery = query.trim();
  // When the consumer passes `effectiveQueryLength` (e.g. just the unprefixed
  // body), use it to decide idle/too-short copy so chip clicks that leave a
  // bare `prefix:` in the input don't read as a failed search.
  const gateLength = effectiveQueryLength ?? trimmedQuery.length;
  const isQueryTooShort = gateLength > 0 && gateLength < minQueryLength;
  const isIdle = gateLength === 0;

  const filteredResults = React.useMemo(
    () => (activeScope ? results.filter((r) => r.entityType === activeScope) : results),
    [results, activeScope]
  );
  const hasResults = filteredResults.length > 0;
  const grouped = React.useMemo(() => groupByEntityType(filteredResults), [filteredResults]);

  // Smart scope suggestion: when the user's typed text matches a scope's
  // label (case-insensitive, word-prefix), surface that scope as a callout
  // at the top so they can scope without learning prefix syntax.
  const suggestedScope = React.useMemo(
    () => suggestScope(trimmedQuery, scopes, activeScope, minQueryLength),
    [trimmedQuery, scopes, activeScope, minQueryLength]
  );

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Search"
      description="Search for customers, programs, offers, and more."
      commandProps={{ shouldFilter: false }}
    >
      <PaletteBody
        query={query}
        onQueryChange={onQueryChange}
        isLoading={isLoading}
        errorState={errorState}
        didYouMean={didYouMean}
        onDidYouMeanClick={onDidYouMeanClick}
        onSelect={onSelect}
        minQueryLength={minQueryLength}
        placeholder={placeholder}
        isIdle={isIdle}
        isQueryTooShort={isQueryTooShort}
        hasResults={hasResults}
        grouped={grouped}
        entityTypeLabels={entityTypeLabels}
        entityTypeIcons={entityTypeIcons}
        scopes={scopes}
        activeScope={activeScope}
        suggestedScope={suggestedScope}
        onActiveScopeChange={onActiveScopeChange}
        onOpenChange={onOpenChange}
      />
    </CommandDialog>
  );
}

interface PaletteBodyProps
  extends
    Omit<CommandPaletteProps, "open" | "results">,
    Required<Pick<CommandPaletteProps, "onOpenChange">> {
  isIdle: boolean;
  isQueryTooShort: boolean;
  hasResults: boolean;
  grouped: Array<[string, CommandPaletteResult[]]>;
  suggestedScope: CommandPaletteScope | null;
}

function PaletteBody({
  query,
  onQueryChange,
  isLoading,
  errorState,
  didYouMean,
  onDidYouMeanClick,
  onSelect,
  minQueryLength = DEFAULT_MIN_QUERY_LENGTH,
  placeholder,
  isIdle,
  isQueryTooShort,
  hasResults,
  grouped,
  entityTypeLabels,
  entityTypeIcons,
  scopes,
  activeScope = null,
  suggestedScope,
  onActiveScopeChange,
  onOpenChange,
}: PaletteBodyProps) {
  const showSuggestedScope = !!suggestedScope && !activeScope;
  return (
    <>
      <CommandInput
        value={query}
        onValueChange={onQueryChange}
        placeholder={placeholder}
        aria-label="Search query"
      />
      {scopes && scopes.length > 0 && (
        <ScopeRail
          scopes={scopes}
          activeScope={activeScope}
          onActiveScopeChange={onActiveScopeChange}
        />
      )}
      <CommandList>
        {/* CommandEmpty is required by cmdk to suppress its own "no results" state.
            We render contextual content above it; cmdk will show this only when
            no CommandItem matches its (disabled) filter — which can still happen
            when results is empty. */}
        <CommandEmpty>
          {renderEmptyState({
            isIdle,
            isQueryTooShort,
            isLoading: !!isLoading,
            errorState: errorState ?? null,
            didYouMean: didYouMean ?? null,
            onDidYouMeanClick,
            minQueryLength,
          })}
        </CommandEmpty>

        {isLoading && hasResults && (
          <div
            role="status"
            aria-live="polite"
            className="text-muted-foreground flex items-center gap-2 px-3 py-2 text-xs"
          >
            <Loader2 className="size-3 motion-safe:animate-spin" aria-hidden="true" />
            Updating results…
          </div>
        )}

        {showSuggestedScope && suggestedScope && (
          <CommandGroup heading="Search in">
            <CommandItem
              key={`scope-suggest-${suggestedScope.key}`}
              value={`scope-suggest-${suggestedScope.key}`}
              onSelect={() => {
                onActiveScopeChange?.(suggestedScope.key);
              }}
              className="flex items-center gap-3"
            >
              {suggestedScope.icon ? (
                <suggestedScope.icon className="size-4 shrink-0" aria-hidden="true" />
              ) : (
                <Search className="size-4 shrink-0 opacity-60" aria-hidden="true" />
              )}
              <span className="flex min-w-0 flex-1 items-baseline gap-2 text-sm">
                <span className="font-medium">Search only {suggestedScope.label}</span>
                <span className="text-muted-foreground truncate text-xs">
                  Limit results to {suggestedScope.label.toLowerCase()}
                </span>
              </span>
            </CommandItem>
          </CommandGroup>
        )}

        {hasResults &&
          grouped.map(([entityType, rows]) => (
            <CommandGroup
              key={entityType}
              heading={entityTypeLabels?.[entityType] ?? humanizeEntityType(entityType)}
            >
              {rows.map((result) => {
                const Icon = entityTypeIcons?.[result.entityType];
                return (
                  <CommandItem
                    key={result.entityId}
                    value={result.entityId}
                    onSelect={() => {
                      onSelect(result);
                      onOpenChange(false);
                    }}
                    className="flex items-start gap-3"
                  >
                    {Icon ? (
                      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                    ) : (
                      <Search className="mt-0.5 size-4 shrink-0 opacity-60" aria-hidden="true" />
                    )}
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="truncate text-sm font-medium">{result.displayLabel}</span>
                      {result.snippetText && (
                        <span className="text-muted-foreground line-clamp-2 text-xs">
                          {renderHighlightedSnippet(result.snippetText, result.matchRanges)}
                        </span>
                      )}
                    </div>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          ))}
      </CommandList>
      <PaletteFooter />
    </>
  );
}

interface EmptyStateInput {
  isIdle: boolean;
  isQueryTooShort: boolean;
  isLoading: boolean;
  errorState: CommandPaletteErrorState | null;
  didYouMean: string | null;
  onDidYouMeanClick?: (suggestion: string) => void;
  minQueryLength: number;
}

function renderEmptyState({
  isIdle,
  isQueryTooShort,
  isLoading,
  errorState,
  didYouMean,
  onDidYouMeanClick,
  minQueryLength,
}: EmptyStateInput) {
  if (errorState === "rate-limited") {
    return (
      <div className="flex flex-col items-center gap-1 px-6 py-4 text-xs">
        <AlertTriangle className="text-destructive size-4" aria-hidden="true" />
        <p className="text-foreground font-medium">Slow down a moment</p>
        <p className="text-muted-foreground">
          You&rsquo;re searching faster than the platform can keep up. Try again in a few seconds.
        </p>
      </div>
    );
  }

  if (errorState === "error") {
    return (
      <div className="flex flex-col items-center gap-1 px-6 py-4 text-xs">
        <AlertTriangle className="text-destructive size-4" aria-hidden="true" />
        <p className="text-foreground font-medium">Search failed</p>
        <p className="text-muted-foreground">Try again or pick a result from the sidebar.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="text-muted-foreground flex items-center justify-center gap-2 py-4 text-xs"
      >
        <Loader2 className="size-3 motion-safe:animate-spin" aria-hidden="true" />
        Searching…
      </div>
    );
  }

  if (isIdle) {
    return (
      <p className="text-muted-foreground px-6 py-4 text-xs">
        Search by name, code, or pick a scope above to narrow.
      </p>
    );
  }

  if (isQueryTooShort) {
    return (
      <p className="text-muted-foreground px-6 py-4 text-xs">
        Keep typing — at least {minQueryLength} characters needed.
      </p>
    );
  }

  return (
    <div className="flex flex-col items-center gap-1 px-6 py-4 text-xs">
      <p className="text-foreground font-medium">No matches</p>
      {didYouMean ? (
        <p className="text-muted-foreground">
          Did you mean{" "}
          <button
            type="button"
            className="text-primary hover:text-primary/80 focus-visible:ring-primary/30 rounded-sm underline focus-visible:ring-2 focus-visible:outline-none"
            onClick={() => onDidYouMeanClick?.(didYouMean)}
          >
            {didYouMean}
          </button>
          ?
        </p>
      ) : (
        <p className="text-muted-foreground">Try a different keyword or prefix.</p>
      )}
    </div>
  );
}

function PaletteFooter() {
  return (
    <div
      className={cn(
        "text-muted-foreground border-border flex items-center justify-end gap-3",
        "border-t px-3 py-2 text-[11px]"
      )}
    >
      <span className="flex items-center gap-1">
        <kbd className="bg-muted rounded border px-1.5 py-0.5 font-mono">↑</kbd>
        <kbd className="bg-muted rounded border px-1.5 py-0.5 font-mono">↓</kbd>
        navigate
      </span>
      <span className="flex items-center gap-1">
        <kbd className="bg-muted rounded border px-1.5 py-0.5 font-mono">↵</kbd>
        select
      </span>
      <span className="flex items-center gap-1">
        <kbd className="bg-muted rounded border px-1.5 py-0.5 font-mono">esc</kbd>
        close
      </span>
    </div>
  );
}

function ScopeRail({
  scopes,
  activeScope,
  onActiveScopeChange,
}: {
  scopes: CommandPaletteScope[];
  activeScope: string | null;
  onActiveScopeChange?: (next: string | null) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Scope filters"
      // Hidden on mobile: the compact `text-xs` chips would fall below
      // CLAUDE.md's 44x44 touch-target minimum. Mobile users still get the
      // smart "Search only X" suggestion and can type the prefix directly
      // (e.g. `customer:`).
      className="border-border hidden flex-wrap items-center gap-1.5 border-b px-3 py-2 md:flex"
    >
      <ScopeChip active={!activeScope} onClick={() => onActiveScopeChange?.(null)} label="All" />
      {scopes.map((scope) => (
        <ScopeChip
          key={scope.key}
          active={activeScope === scope.key}
          onClick={() => onActiveScopeChange?.(activeScope === scope.key ? null : scope.key)}
          label={scope.label}
          icon={scope.icon}
          requiresPrefix={scope.requiresPrefix}
        />
      ))}
    </div>
  );
}

function ScopeChip({
  active,
  onClick,
  label,
  icon: Icon,
  requiresPrefix,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  requiresPrefix?: boolean;
}) {
  const lockTitle = requiresPrefix ? `${label} only show up when scoped` : undefined;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={lockTitle}
      className={cn(
        "border-border focus-visible:ring-primary/30 inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs transition-colors focus-visible:ring-2 focus-visible:outline-none",
        active
          ? "bg-primary text-primary-foreground border-primary"
          : "text-muted-foreground hover:bg-muted"
      )}
    >
      {Icon && <Icon className="size-3" aria-hidden="true" />}
      {label}
      {requiresPrefix && <Lock className="size-2.5 opacity-70" aria-hidden="true" />}
    </button>
  );
}

/**
 * Returns the scope whose label the typed query most plausibly indicates.
 * Matches when any whitespace-separated query token is a prefix of any
 * whitespace-separated word in the scope label (case-insensitive). Skips
 * very short tokens to avoid surfacing on "a" / "an" etc.
 */
function suggestScope(
  query: string,
  scopes: CommandPaletteScope[] | undefined,
  activeScope: string | null,
  minQueryLength: number
): CommandPaletteScope | null {
  if (!scopes || scopes.length === 0) return null;
  if (activeScope) return null;
  if (query.length < minQueryLength) return null;
  const tokens = query
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length >= minQueryLength);
  if (tokens.length === 0) return null;
  for (const scope of scopes) {
    const words = scope.label.toLowerCase().split(/\s+/);
    const matches = tokens.every((token) => words.some((word) => word.startsWith(token)));
    if (matches) return scope;
  }
  return null;
}

function groupByEntityType(
  results: CommandPaletteResult[]
): Array<[string, CommandPaletteResult[]]> {
  if (results.length === 0) return [];
  const order: string[] = [];
  const map = new Map<string, CommandPaletteResult[]>();
  for (const r of results) {
    const bucket = map.get(r.entityType);
    if (bucket) {
      bucket.push(r);
    } else {
      map.set(r.entityType, [r]);
      order.push(r.entityType);
    }
  }
  return order.map((type) => [type, map.get(type)!] as const);
}

function humanizeEntityType(entityType: string): string {
  // PROGRAM -> Program, CUSTOMER_AUDIENCE -> Customer audience
  const lower = entityType
    .split("_")
    .map((segment, idx) =>
      idx === 0
        ? segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase()
        : segment.toLowerCase()
    )
    .join(" ");
  // Crude pluralization for the group heading.
  return lower.endsWith("s") ? lower : `${lower}s`;
}

/**
 * Renders snippetText with `<mark>` spans wrapping each match range. Ranges
 * arrive as `{start, end}` half-open offsets from the API; we clamp + skip
 * any that fall outside the snippet length.
 */
function renderHighlightedSnippet(
  text: string,
  ranges: Array<{ start: number; end: number }>
): React.ReactNode {
  if (!text) return null;
  if (!ranges || ranges.length === 0) return text;

  const sorted = [...ranges]
    .filter((r) => Number.isFinite(r.start) && Number.isFinite(r.end) && r.end > r.start)
    .sort((a, b) => a.start - b.start);
  if (sorted.length === 0) return text;

  const out: React.ReactNode[] = [];
  let cursor = 0;
  for (let i = 0; i < sorted.length; i += 1) {
    const range = sorted[i]!;
    const start = Math.max(cursor, Math.min(range.start, text.length));
    const end = Math.max(start, Math.min(range.end, text.length));
    if (start > cursor) out.push(text.slice(cursor, start));
    if (end > start) {
      out.push(
        <mark
          key={`m-${start}-${end}-${i}`}
          className="text-foreground bg-primary/15 rounded-sm px-0.5"
        >
          {text.slice(start, end)}
        </mark>
      );
    }
    cursor = end;
  }
  if (cursor < text.length) out.push(text.slice(cursor));
  return out;
}
