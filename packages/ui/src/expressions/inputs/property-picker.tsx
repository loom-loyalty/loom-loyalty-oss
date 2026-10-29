/**
 * Property Picker
 *
 * Schema-aware field picker for the sentence-mode field pill (R7/R9). Built on
 * the shared `useJsonPathSchema` data layer (KTD7) — no duplicate fetching.
 *
 * Presentation deltas over `JsonPathBrowser`'s expand-in-place tree: a search
 * box that filters only the CURRENT breadcrumb level, single-level
 * breadcrumb-scoped navigation (drilling into a field replaces the visible
 * level rather than expanding it in place), a live breadcrumb trail, field
 * type icons, and a resolved-path footer with an "Edit path" escape hatch
 * offering async schema-aware live validation (R8/KTD8).
 *
 * Accessibility (R9) — this REPLACES `JsonPathBrowser`'s WAI-ARIA tree pattern
 * rather than preserving it, because a single-level drill-down is a listbox/
 * menu model, not a tree:
 *   - ARIA `listbox`/`option` for the fields at one level at a time.
 *   - Enter/Right-arrow drills into a non-primitive option; Enter or Space on a
 *     primitive option commits and closes.
 *   - Left-arrow/Backspace/breadcrumb-click navigates back up a level.
 *   - Left/Right-arrow navigate levels ONLY when an option has focus — the
 *     search box is a text input and keeps native cursor-movement semantics.
 *     Down-arrow/Tab moves focus from the search box into the option list;
 *     Up-arrow from the first option returns focus to the search box.
 *   - `aria-live` announces level changes; focus restores to the field that
 *     was drilled into when navigating back up, and moves to the first
 *     option (or the search box) on drill-in.
 *   - Escape closes without committing, returning focus to the field pill.
 */

import {
  ChevronDown,
  ChevronRight as ChevronRightIcon,
  Hash,
  ListTree,
  Pencil,
  Search,
  Type as TypeIcon,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";

import { cn } from "../../lib/utils.js";
import { Button } from "../../primitives/button.js";
import { Input } from "../../primitives/input.js";
import { Popover, PopoverContent, PopoverTrigger } from "../../primitives/popover.js";
import { Skeleton } from "../../primitives/skeleton.js";
import { isRootPathMode, type ExpressionSurfaceMode } from "../expression-context.js";
import { useExpressionPathValidation } from "../expression-modal.js";
import { splitArraySuffix, type RawPathSegment } from "./json-path-parsing.js";
import {
  useJsonPathSchema,
  type PathResolutionResult,
  type RootSection,
  type SchemaNode,
} from "./use-json-path-schema.js";

export interface PropertyPickerProps {
  value: string;
  onSelect: (path: string) => void;
  disabled?: boolean;
  className?: string;
}

interface BreadcrumbEntry {
  attribute: string;
  label: string;
  isArray: boolean;
}

const NUMERIC_TYPES = new Set(["INTEGER", "LONG", "DOUBLE", "FLOAT", "DECIMAL", "NUMBER"]);

const EVENT_ROOT_NODES: SchemaNode[] = [
  {
    attribute: "eventData",
    name: "Event Data",
    typeReference: "",
    isArray: false,
    isPrimitive: false,
  },
  {
    attribute: "eventTarget",
    name: "Event Target",
    typeReference: "",
    isArray: false,
    isPrimitive: false,
  },
];

function fieldIcon(node: SchemaNode): ReactNode {
  if (!node.isPrimitive) return <ListTree className="text-muted-foreground h-3.5 w-3.5" />;
  if (NUMERIC_TYPES.has(node.typeReference.toUpperCase())) {
    return <Hash className="text-muted-foreground h-3.5 w-3.5" />;
  }
  return <TypeIcon className="text-muted-foreground h-3.5 w-3.5" />;
}

function segmentString(attribute: string, isArray: boolean): string {
  return isArray ? `${attribute}[*]` : attribute;
}

function buildPath(rootSection: RootSection, trail: BreadcrumbEntry[], node: SchemaNode): string {
  const segments = [
    ...trail.map((t) => segmentString(t.attribute, t.isArray)),
    segmentString(node.attribute, node.isArray),
  ];
  const prefix = rootSection === "customer" ? "$." : `$.${rootSection}.`;
  return prefix + segments.join(".");
}

/**
 * Parses a committed path into its raw (non-humanized) segments so the
 * picker can drill down to the field's own level on open, rather than always
 * resetting to the root section. Root-section resolution stays local (rather
 * than importing `use-json-path-schema.ts`'s private `parsePath`) to avoid
 * touching that already-hardened file for a presentational nicety, but the
 * underlying segment-splitting logic is shared via json-path-parsing.ts
 * (adversarial review finding: this used to be a byte-for-byte duplicate).
 */
function parsePathForNavigation(
  path: string,
  mode: ExpressionSurfaceMode
): { rootSection: RootSection; segments: RawPathSegment[] } | null {
  if (!path.startsWith("$.")) return null;
  const rest = path.slice(2);
  if (!rest) return null;
  const rawSegments = rest
    .split(".")
    .map(splitArraySuffix)
    .filter((s) => s.attribute.length > 0);
  if (rawSegments.length === 0) return null;

  if (isRootPathMode(mode)) return { rootSection: "customer", segments: rawSegments };

  const [first, ...remainder] = rawSegments;
  if (first!.attribute !== "eventData" && first!.attribute !== "eventTarget") return null;
  return { rootSection: first!.attribute as RootSection, segments: remainder };
}

function resolutionMessage(result: PathResolutionResult | null): {
  text: string;
  tone: "muted" | "success" | "error" | "pending";
  /** Non-blocking states (pending / load-failure) must never gate Save (fix #11). */
  blocksSave: boolean;
} {
  if (!result) return { text: "", tone: "muted", blocksSave: false };
  switch (result.status) {
    case "valid": {
      const last = result.breadcrumbs[result.breadcrumbs.length - 1];
      const trail = result.breadcrumbs.map((b) => b.name).join(" › ");
      return {
        text: `Valid path — ${trail} (${last?.typeReference.toLowerCase() ?? result.typeReference.toLowerCase()})`,
        tone: "success",
        blocksSave: false,
      };
    }
    case "invalid-prefix":
      return { text: "Path must start with $.", tone: "error", blocksSave: true };
    case "unresolved":
      return {
        text: "This path could not be resolved against the schema.",
        tone: "error",
        blocksSave: true,
      };
    case "load-failure":
      return {
        text: "Couldn't load schema fields to validate this path. You can still save it.",
        tone: "pending",
        blocksSave: false,
      };
    case "pending":
      return { text: "Resolving path…", tone: "pending", blocksSave: false };
    case "schema-unavailable":
      return {
        text: "Schema unavailable — you can still save a manually entered path.",
        tone: "muted",
        blocksSave: false,
      };
    default:
      return { text: "", tone: "muted", blocksSave: false };
  }
}

export function PropertyPicker({
  value,
  onSelect,
  disabled,
  className,
}: PropertyPickerProps): ReactNode {
  const {
    eventDataNodes,
    eventTargetNodes,
    customerNodes,
    expandNodeAsync,
    resolvePath,
    isLoading: isSchemaLoading,
    error: schemaError,
    mode,
    hasEventType,
  } = useJsonPathSchema();

  const { reportPathError, reportFieldName } = useExpressionPathValidation();
  const validationId = useId();

  const [open, setOpen] = useState(false);
  const [rootSection, setRootSection] = useState<RootSection | null>(
    isRootPathMode(mode) ? "customer" : null
  );
  const [trail, setTrail] = useState<BreadcrumbEntry[]>([]);
  const [search, setSearch] = useState("");
  const [levelLoading, setLevelLoading] = useState(false);
  const [levelLoadError, setLevelLoadError] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const [viewMode, setViewMode] = useState<"browse" | "manual">("browse");
  const [manualValue, setManualValue] = useState(value);
  const [focusedAttribute, setFocusedAttribute] = useState<string | null>(null);
  const [restoreFocusAttribute, setRestoreFocusAttribute] = useState<string | null>(null);
  // Set right before a `navigateToValue` level change so the level-change
  // effect below can skip its focus-move for that one transition (the user
  // may already be typing/navigating by the time an awaited schema fetch
  // resolves) while still announcing it — mirrors `restoreFocusAttribute`'s
  // one-shot, effect-consumed pattern (adversarial review finding).
  const [suppressAutoFocus, setSuppressAutoFocus] = useState(false);

  const [resolution, setResolution] = useState<PathResolutionResult | null>(null);
  const [manualResolution, setManualResolution] = useState<PathResolutionResult | null>(null);
  const [manualPending, setManualPending] = useState(false);
  // The value currently awaiting its own `resolvePath` result, or null once
  // settled. Tracked separately from `resolution` (which still holds the
  // PREVIOUS value's result until the new one lands) so the Save gate can
  // tell "stale result for an old value" apart from "confirmed result for the
  // current value" — without this, editing a valid path into a new,
  // not-yet-validated one left Save gated on the old value's (possibly
  // non-blocking) result for the whole async window (adversarial review
  // finding).
  const [resolvingValue, setResolvingValue] = useState<string | null>(null);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const optionRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const resolveSeqRef = useRef(0);
  // Generation counter for `navigateToValue` — incremented on every popover
  // open so a superseded navigation (closed/reopened, or the bound value
  // changed, while an awaited schema fetch was still in flight) can detect
  // it's stale and bail without applying its now-outdated result (adversarial
  // review finding).
  const navSeqRef = useRef(0);

  // Mark the new value as "resolving" synchronously during render (not via an
  // effect) so there is no frame where a just-typed value's Save-gate state
  // still reflects the previous value's resolution.
  const [prevValueForResolution, setPrevValueForResolution] = useState(value);
  if (value !== prevValueForResolution) {
    setPrevValueForResolution(value);
    setResolvingValue(value || null);
  }

  // Live-validate the committed `value` for the resolved-path footer (R8).
  useEffect(() => {
    let cancelled = false;
    if (!value) {
      setResolution(null);
      setResolvingValue(null);
      return;
    }
    resolvePath(value).then((result) => {
      if (cancelled) return;
      setResolution(result);
      setResolvingValue((current) => (current === value ? null : current));
    });
    return () => {
      cancelled = true;
    };
  }, [value, resolvePath]);

  // Aggregate this field's blocking state into the enclosing ExpressionModal's
  // Save gate (fix #11) — pending/load-failure/schema-unavailable never block,
  // but a value whose OWN resolution hasn't landed yet always blocks, even if
  // the previous value's resolution was non-blocking.
  useEffect(() => {
    const blocksSave = resolvingValue !== null ? true : resolutionMessage(resolution).blocksSave;
    reportPathError(validationId, blocksSave);
    return () => reportPathError(validationId, false);
  }, [resolution, resolvingValue, reportPathError, validationId]);

  // Keep the friendly modal preview faithful to the field pill's schema-resolved
  // label. Clearing this report on invalid/pending resolution preserves the
  // summary's best-effort breadcrumb fallback outside the common resolved case.
  useEffect(() => {
    const resolvedName =
      resolvingValue === null && resolution?.status === "valid"
        ? resolution.breadcrumbs[resolution.breadcrumbs.length - 1]?.name
        : undefined;
    reportFieldName(validationId, value, resolvedName);
    return () => reportFieldName(validationId, value, undefined);
  }, [resolution, reportFieldName, resolvingValue, validationId, value]);

  const resetAuxiliaryState = useCallback(() => {
    setSearch("");
    setViewMode("browse");
    setManualValue(value);
    setManualResolution(null);
    setLevelLoadError(false);
  }, [value]);

  const resetToRootLevel = useCallback(() => {
    setRootSection(isRootPathMode(mode) ? "customer" : null);
    setTrail([]);
  }, [mode]);

  // Drills down to the committed value's own level (its parent's children)
  // instead of always opening at the root section, so re-opening the picker
  // on an already-set field lets the user see and pick a sibling without
  // re-navigating from scratch. Falls back to the root level (via the
  // caller) on any schema mismatch or fetch failure.
  const navigateToValue = useCallback(
    async (path: string, seq: number): Promise<boolean> => {
      const parsed = parsePathForNavigation(path, mode);
      if (!parsed) return false;
      const parentSegments = parsed.segments.slice(0, -1);
      if (parentSegments.length === 0) {
        if (navSeqRef.current !== seq) return true;
        setRootSection(parsed.rootSection);
        setTrail([]);
        return true;
      }

      let nodes =
        parsed.rootSection === "customer"
          ? customerNodes
          : parsed.rootSection === "eventData"
            ? eventDataNodes
            : eventTargetNodes;
      const builtTrail: BreadcrumbEntry[] = [];
      // Only a genuine await (an uncached level requiring a schema fetch)
      // creates a real window for the user to start interacting before this
      // navigation lands — a fully-cached resolution is effectively
      // synchronous, so it should focus normally like any other level change.
      let awaited = false;
      for (const segment of parentSegments) {
        const node = nodes.find((n) => n.attribute === segment.attribute);
        if (!node || node.isPrimitive) return false;
        let children = node.children;
        if (children === undefined) {
          awaited = true;
          try {
            children = await expandNodeAsync(
              parsed.rootSection,
              [...builtTrail.map((t) => t.attribute), node.attribute],
              node.typeReference,
              builtTrail.length + 1
            );
          } catch {
            return false;
          }
          // A newer navigation (reopen, or the bound value changed) may have
          // started while this fetch was in flight — its result is stale, so
          // stop before applying anything further (don't fall back to root
          // either; a newer navigation already owns that decision).
          if (navSeqRef.current !== seq) return true;
        }
        builtTrail.push({ attribute: node.attribute, label: node.name, isArray: node.isArray });
        nodes = children;
      }
      if (navSeqRef.current !== seq) return true;
      if (awaited) setSuppressAutoFocus(true);
      setRootSection(parsed.rootSection);
      setTrail(builtTrail);
      return true;
    },
    [mode, customerNodes, eventDataNodes, eventTargetNodes, expandNodeAsync]
  );

  const handleOpenChange = useCallback(
    (next: boolean) => {
      setOpen(next);
      if (!next) return;
      resetAuxiliaryState();
      // Start from a clean root level, then asynchronously refine to the
      // committed value's own level once (if) navigation resolves — avoids
      // ever showing a stale level left over from a previous browse session.
      resetToRootLevel();
      const seq = ++navSeqRef.current;
      if (value) {
        void navigateToValue(value, seq).then((navigated) => {
          if (navSeqRef.current !== seq) return;
          if (!navigated) resetToRootLevel();
        });
      }
    },
    [resetAuxiliaryState, resetToRootLevel, navigateToValue, value]
  );

  const levelNodes = useMemo<SchemaNode[]>(() => {
    if (rootSection === null) return EVENT_ROOT_NODES;
    let nodes =
      rootSection === "customer"
        ? customerNodes
        : rootSection === "eventData"
          ? eventDataNodes
          : eventTargetNodes;
    for (const entry of trail) {
      const node = nodes.find((n) => n.attribute === entry.attribute);
      if (!node?.children) return [];
      nodes = node.children;
    }
    return nodes.filter((n) => n.attribute !== "__error__");
  }, [rootSection, trail, eventDataNodes, eventTargetNodes, customerNodes]);

  const filteredNodes = useMemo(() => {
    if (!search.trim()) return levelNodes;
    const needle = search.trim().toLowerCase();
    return levelNodes.filter(
      (n) => n.name.toLowerCase().includes(needle) || n.attribute.toLowerCase().includes(needle)
    );
  }, [levelNodes, search]);

  const levelLabel = useMemo(() => {
    const parts: string[] = [];
    if (rootSection === "eventData") parts.push("Event Data");
    else if (rootSection === "eventTarget") parts.push("Event Target");
    else if (rootSection === "customer" && mode === "customer") parts.push("Customer");
    else if (rootSection === "customer" && mode === "feed") parts.push("Row");
    parts.push(...trail.map((t) => t.label));
    return parts;
  }, [rootSection, trail, mode]);

  // Announce level changes (R9) and move focus into the new level.
  useEffect(() => {
    if (!open) return;
    setAnnouncement(
      levelLabel.length > 0 ? `Now viewing ${levelLabel.join(" › ")}` : "Now viewing fields"
    );
    if (suppressAutoFocus) {
      // The auto-drill-on-open navigation just resolved after a genuine
      // await — the user may already be interacting (typing, arrowing
      // through the root list). Announce the jump but don't yank focus.
      setSuppressAutoFocus(false);
      return;
    }
    if (restoreFocusAttribute) {
      const el = optionRefs.current.get(restoreFocusAttribute);
      el?.focus();
      setFocusedAttribute(restoreFocusAttribute);
      setRestoreFocusAttribute(null);
    } else {
      // Drilling in (or first open): focus the first option, else the search box.
      const first = filteredNodes[0];
      if (first) {
        requestAnimationFrame(() => {
          optionRefs.current.get(first.attribute)?.focus();
        });
        setFocusedAttribute(first.attribute);
      } else {
        requestAnimationFrame(() => searchRef.current?.focus());
        setFocusedAttribute(null);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-run on level change, not every filteredNodes/search edit
  }, [rootSection, trail, open]);

  const commit = useCallback(
    (path: string) => {
      onSelect(path);
      setOpen(false);
      requestAnimationFrame(() => triggerRef.current?.focus());
    },
    [onSelect]
  );

  const handleActivate = useCallback(
    async (node: SchemaNode) => {
      if (rootSection === null) {
        setRootSection(node.attribute as RootSection);
        setTrail([]);
        setSearch("");
        return;
      }
      if (node.isPrimitive) {
        commit(buildPath(rootSection, trail, node));
        return;
      }
      if (node.children === undefined) {
        setLevelLoading(true);
        setLevelLoadError(false);
        try {
          await expandNodeAsync(
            rootSection,
            [...trail.map((t) => t.attribute), node.attribute],
            node.typeReference,
            trail.length + 1
          );
        } catch {
          setLevelLoadError(true);
          setLevelLoading(false);
          return;
        }
        setLevelLoading(false);
      }
      setTrail((prev) => [
        ...prev,
        { attribute: node.attribute, label: node.name, isArray: node.isArray },
      ]);
      setSearch("");
    },
    [rootSection, trail, expandNodeAsync, commit]
  );

  const handleUp = useCallback(() => {
    if (trail.length > 0) {
      const leaving = trail[trail.length - 1]!;
      setTrail((prev) => prev.slice(0, -1));
      setSearch("");
      setRestoreFocusAttribute(leaving.attribute);
      return;
    }
    if (rootSection !== null && !isRootPathMode(mode)) {
      const leaving = rootSection;
      setRootSection(null);
      setSearch("");
      setRestoreFocusAttribute(leaving);
    }
  }, [trail, rootSection, mode]);

  const canGoUp = trail.length > 0 || (rootSection !== null && !isRootPathMode(mode));

  const handleSearchKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "ArrowDown") {
        if (filteredNodes[0]) {
          e.preventDefault();
          optionRefs.current.get(filteredNodes[0].attribute)?.focus();
          setFocusedAttribute(filteredNodes[0].attribute);
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
        requestAnimationFrame(() => triggerRef.current?.focus());
      }
      // Left/Right arrows are left alone — native cursor movement (fix #8).
      // Tab is left alone too (Codex review F2) — it previously hijacked
      // focus into the option list, trapping keyboard users who wanted to
      // Tab past the search box entirely. ArrowDown remains the documented
      // way to move from the search box into the list (R9).
    },
    [filteredNodes]
  );

  const handleOptionKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>, node: SchemaNode) => {
      const idx = filteredNodes.findIndex((n) => n.attribute === node.attribute);
      switch (e.key) {
        case "ArrowDown": {
          e.preventDefault();
          const next = filteredNodes[idx + 1];
          if (next) {
            optionRefs.current.get(next.attribute)?.focus();
            setFocusedAttribute(next.attribute);
          }
          break;
        }
        case "ArrowUp": {
          e.preventDefault();
          if (idx === 0) {
            searchRef.current?.focus();
            setFocusedAttribute(null);
          } else {
            const prev = filteredNodes[idx - 1];
            if (prev) {
              optionRefs.current.get(prev.attribute)?.focus();
              setFocusedAttribute(prev.attribute);
            }
          }
          break;
        }
        case "ArrowRight":
        case "Enter": {
          e.preventDefault();
          void handleActivate(node);
          break;
        }
        case " ": {
          if (node.isPrimitive || rootSection === null) {
            e.preventDefault();
            void handleActivate(node);
          }
          break;
        }
        case "ArrowLeft":
        case "Backspace": {
          e.preventDefault();
          handleUp();
          break;
        }
        case "Escape": {
          e.preventDefault();
          setOpen(false);
          requestAnimationFrame(() => triggerRef.current?.focus());
          break;
        }
      }
    },
    [filteredNodes, handleActivate, handleUp, rootSection]
  );

  // Manual "Edit path" escape hatch — live async validation (R8/KTD8/AE3).
  useEffect(() => {
    if (viewMode !== "manual") return;
    const seq = ++resolveSeqRef.current;
    setManualPending(true);
    resolvePath(manualValue).then((result) => {
      if (resolveSeqRef.current !== seq) return;
      setManualPending(false);
      setManualResolution(result);
    });
  }, [manualValue, viewMode, resolvePath]);

  const handleManualChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const next = e.target.value;
      setManualValue(next);
      onSelect(next);
    },
    [onSelect]
  );

  // Each crumb navigates TO the level you'd be at after drilling into that
  // field — i.e. it keeps everything up to and including itself and discards
  // deeper trail entries — and restores focus to the field that was drilled
  // into FROM there (the next-deeper trail entry, if any).
  const breadcrumbButtons = useMemo(() => {
    const crumbs: Array<{ key: string; label: string; onClick: () => void; isCurrent: boolean }> =
      [];
    if (rootSection === "eventData" || rootSection === "eventTarget") {
      crumbs.push({
        key: "__root__",
        label: rootSection === "eventData" ? "Event Data" : "Event Target",
        isCurrent: trail.length === 0,
        onClick: () => {
          setRestoreFocusAttribute(trail[0]?.attribute ?? null);
          setTrail([]);
          setSearch("");
        },
      });
    }
    trail.forEach((entry, i) => {
      crumbs.push({
        key: entry.attribute,
        label: entry.label,
        isCurrent: i === trail.length - 1,
        onClick: () => {
          setRestoreFocusAttribute(trail[i + 1]?.attribute ?? null);
          setTrail((prev) => prev.slice(0, i + 1));
          setSearch("");
        },
      });
    });
    return crumbs;
  }, [rootSection, trail]);

  const footerStatus =
    resolvingValue !== null
      ? { text: "Resolving path…", tone: "pending" as const, blocksSave: true }
      : resolutionMessage(resolution);
  const manualStatus = manualPending
    ? { text: "Resolving path…", tone: "pending" as const, blocksSave: false }
    : resolutionMessage(manualResolution);

  // Friendly-label trigger (R7/design reference): never surface the raw
  // JSONPath as the primary label — show the resolved breadcrumb trail (last
  // segment bold) once the path validates, and a neutral placeholder
  // otherwise (pending/unresolved/schema-unavailable all fall back here, not
  // the raw `$.eventData....` string).
  const resolvedBreadcrumb = resolution?.status === "valid" ? resolution.breadcrumbs : null;
  const triggerAriaLabel = resolvedBreadcrumb
    ? `Field: ${resolvedBreadcrumb.map((b) => b.name).join(" › ")}. Click to change.`
    : "Select a field";
  const isBusy = isSchemaLoading && levelNodes.length === 0 && rootSection !== null;

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          ref={triggerRef}
          type="button"
          disabled={disabled}
          className={cn(
            "border-input-border bg-input hover:bg-muted/50 focus-visible:ring-primary flex min-h-11 min-w-0 items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-left text-sm font-medium focus-visible:ring-1 focus-visible:outline-none sm:min-h-9",
            !resolvedBreadcrumb && "text-muted-foreground font-normal italic",
            className
          )}
          aria-label={triggerAriaLabel}
        >
          {resolvedBreadcrumb ? (
            <span className="flex min-w-0 flex-wrap items-center gap-1">
              {resolvedBreadcrumb.map((b, i) => (
                <span key={i} className="flex items-center gap-1">
                  {i > 0 && <ChevronRightIcon className="text-muted-foreground h-3 w-3 shrink-0" />}
                  <span
                    className={
                      i === resolvedBreadcrumb.length - 1
                        ? "text-foreground font-semibold"
                        : "text-foreground/70"
                    }
                  >
                    {b.name}
                  </span>
                </span>
              ))}
            </span>
          ) : (
            "Select a field"
          )}
          <ChevronDown className="text-muted-foreground ml-auto h-3.5 w-3.5 shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="flex w-80 flex-col gap-0 p-0" align="start" sideOffset={4}>
        <p aria-live="polite" className="sr-only">
          {announcement}
        </p>

        {!hasEventType && (
          <div className="border-warning/30 bg-warning/5 rounded-md border p-2" role="status">
            <p className="text-warning-foreground text-xs">
              No event type set. Autocomplete isn&apos;t available yet — you can still type a JSON
              path manually.
            </p>
          </div>
        )}

        {/* Breadcrumb trail */}
        <div className="border-border flex flex-wrap items-center gap-0.5 border-b px-2 py-1.5 text-[11px]">
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
            onClick={() => {
              if (isRootPathMode(mode)) {
                setRestoreFocusAttribute(trail[0]?.attribute ?? null);
              } else {
                setRestoreFocusAttribute(rootSection);
                setRootSection(null);
              }
              setTrail([]);
              setSearch("");
            }}
            disabled={!canGoUp}
          >
            Fields
          </button>
          {breadcrumbButtons.map((crumb) => (
            <span key={crumb.key} className="flex items-center gap-0.5">
              <ChevronRightIcon className="text-muted-foreground h-3 w-3" />
              <button
                type="button"
                className="text-foreground hover:text-primary font-medium disabled:pointer-events-none"
                onClick={crumb.onClick}
                disabled={crumb.isCurrent}
              >
                {crumb.label}
              </button>
            </span>
          ))}
        </div>

        {viewMode === "browse" ? (
          <>
            {/* Search box — filters ONLY the current level (R7/AE7) */}
            <div className="border-border flex items-center gap-1.5 border-b px-2 py-1.5">
              <Search className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
              <Input
                ref={searchRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                placeholder="Search fields at this level…"
                className="h-8 border-none px-0 shadow-none focus-visible:ring-0"
                aria-label="Search fields at this level"
              />
            </div>

            <div
              role="listbox"
              aria-label={levelLabel.length > 0 ? levelLabel.join(" › ") : "Fields"}
              className="max-h-60 overflow-y-auto p-1"
            >
              {isBusy || levelLoading ? (
                <div className="space-y-1.5 p-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-28" />
                </div>
              ) : levelLoadError ? (
                <p className="text-destructive px-2 py-3 text-center text-xs">
                  Couldn&apos;t load fields for this level. Try again.
                </p>
              ) : filteredNodes.length === 0 ? (
                <p className="text-muted-foreground px-2 py-3 text-center text-xs">
                  {search.trim()
                    ? "No fields match your search."
                    : "No fields available at this level."}
                </p>
              ) : (
                filteredNodes.map((node) => (
                  <div
                    key={node.attribute}
                    ref={(el) => {
                      if (el) optionRefs.current.set(node.attribute, el);
                      else optionRefs.current.delete(node.attribute);
                    }}
                    role="option"
                    aria-selected={focusedAttribute === node.attribute}
                    tabIndex={focusedAttribute === node.attribute ? 0 : -1}
                    onFocus={() => setFocusedAttribute(node.attribute)}
                    onClick={() => void handleActivate(node)}
                    onKeyDown={(e) => handleOptionKeyDown(e, node)}
                    className={cn(
                      "flex min-h-11 cursor-pointer items-center gap-1.5 rounded px-2 py-1.5 text-xs outline-none sm:min-h-8",
                      "hover:bg-muted focus-visible:ring-primary focus-visible:ring-1"
                    )}
                  >
                    {fieldIcon(node)}
                    <span className="text-foreground min-w-0 flex-1 truncate whitespace-normal">
                      {node.name}
                    </span>
                    {node.isArray && (
                      <span className="text-muted-foreground font-mono text-[10px]">[]</span>
                    )}
                    {!node.isPrimitive && rootSection !== null && (
                      <ChevronRightIcon className="text-muted-foreground h-3 w-3 shrink-0" />
                    )}
                  </div>
                ))
              )}
            </div>
          </>
        ) : (
          <div className="space-y-1.5 p-2">
            <Input
              value={manualValue}
              onChange={handleManualChange}
              placeholder="$.eventData.fieldName"
              className="font-mono text-xs"
              aria-label="Edit path manually"
            />
            <p
              role={manualStatus.tone === "error" ? "alert" : "status"}
              className={cn(
                "text-[11px]",
                manualStatus.tone === "error" && "text-destructive",
                manualStatus.tone === "success" && "text-success-dark",
                manualStatus.tone === "pending" && "text-muted-foreground"
              )}
            >
              {manualStatus.text}
            </p>
          </div>
        )}

        {/* Resolved-path footer + Edit-path escape hatch (R7/R8). Design
            reference (turn 3a): a quiet "RESOLVES TO" micro-label above the
            raw JSONPath in monospace. The tone color is a supplementary
            visual cue, not the only status signal (Codex review, U12
            accessibility finding): `footerStatus.text` — the full
            Valid/invalid/pending sentence — is announced via an always-
            present `role="status"` region below, since a `title` attribute
            is not reliably exposed to screen readers or touch users. */}
        <div className="border-border bg-muted/30 flex items-center justify-between gap-2 border-t px-2 py-1.5">
          <div className="min-w-0 flex-1">
            <p className="text-muted-foreground text-[10px] font-medium tracking-wide uppercase">
              Resolves to
            </p>
            <p
              className={cn(
                "truncate font-mono text-[11px]",
                footerStatus.tone === "error" && "text-destructive",
                footerStatus.tone === "success" && "text-success-dark",
                footerStatus.tone === "pending" && "text-muted-foreground",
                footerStatus.tone === "muted" && "text-muted-foreground"
              )}
              title={value || undefined}
            >
              {value || "No field selected"}
            </p>
            <p role="status" aria-atomic="true" className="sr-only" data-testid="footer-status">
              {footerStatus.text}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            // 44x44 touch target at every breakpoint, not just below `sm`
            // (Codex review, pre-implementation: the repo's touch-target
            // rule isn't breakpoint-scoped, unlike the `sm:min-h-*` pattern
            // used elsewhere in this file for less load-bearing controls).
            className="min-h-11 shrink-0 gap-1 px-2 text-[11px]"
            onClick={() => setViewMode((m) => (m === "browse" ? "manual" : "browse"))}
          >
            <Pencil className="h-3 w-3" />
            {viewMode === "browse" ? "Edit path" : "Browse"}
          </Button>
        </div>
        {!!schemaError && (
          <p className="text-muted-foreground border-border border-t px-2 py-1 text-[10px]">
            {schemaError}
          </p>
        )}
      </PopoverContent>
    </Popover>
  );
}
