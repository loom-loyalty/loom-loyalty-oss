/**
 * JSON Path Browser
 *
 * Popover-based tree browser for selecting JSON paths from a data model schema.
 * Shows two root sections ($.eventData and $.eventTarget) with expandable
 * non-primitive fields for recursive traversal.
 *
 * Implements WAI-ARIA tree pattern with full keyboard navigation:
 * ArrowDown/Up — move between visible items
 * ArrowRight — expand collapsed node or move to first child
 * ArrowLeft — collapse expanded node or move to parent
 * Enter/Space — select the focused item
 * Home/End — move to first/last visible item
 */

import { ChevronDown, ChevronRight, Database } from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { cn } from "../../lib/utils.js";
import { Button } from "../../primitives/button.js";
import { Popover, PopoverContent, PopoverTrigger } from "../../primitives/popover.js";
import { Skeleton } from "../../primitives/skeleton.js";
import { isRootPathMode } from "../expression-context.js";
import { MAX_DEPTH, useJsonPathSchema, type SchemaNode } from "./use-json-path-schema.js";

// -- Types --

export interface JsonPathBrowserProps {
  onSelect: (path: string) => void;
  disabled?: boolean;
}

interface SchemaTreeNodeProps {
  node: SchemaNode;
  pathPrefix: string;
  pathSegments: string[];
  rootSection: "eventData" | "eventTarget" | "customer";
  onSelect: (path: string) => void;
  onExpand: (
    section: "eventData" | "eventTarget" | "customer",
    pathSegments: string[],
    typeReference: string,
    depth: number
  ) => void;
  depth: number;
  /** Ref map for keyboard navigation — each visible item registers its element */
  itemRefs: React.RefObject<Map<string, HTMLLIElement>>;
  /** Currently focused item key for roving tabindex */
  focusedKey: string | null;
  /** Set the focused item key */
  onFocusChange: (key: string) => void;
  /** Parent-controlled expanded keys (single source of truth) */
  expandedKeys: Set<string>;
  /** Toggle a node's expanded state */
  onToggleExpand: (key: string) => void;
}

// -- Helpers --

function buildPathSegment(attribute: string, isArray: boolean): string {
  return isArray ? `${attribute}[*]` : attribute;
}

function buildFullPath(prefix: string, attribute: string, isArray: boolean): string {
  return `${prefix}.${buildPathSegment(attribute, isArray)}`;
}

/** Collect all visible item keys in DOM order for keyboard navigation */
function collectVisibleKeys(
  nodes: SchemaNode[],
  prefix: string,
  expandedSet: Set<string>
): string[] {
  const keys: string[] = [];
  for (const node of nodes) {
    if (node.attribute === "__error__") continue;
    const key = `${prefix}/${node.attribute}`;
    keys.push(key);
    if (expandedSet.has(key) && node.children) {
      const childPrefix = buildFullPath(prefix, node.attribute, node.isArray);
      keys.push(...collectVisibleKeys(node.children, childPrefix, expandedSet));
    }
  }
  return keys;
}

// -- Tree Node --

function SchemaTreeNode({
  node,
  pathPrefix,
  pathSegments,
  rootSection,
  onSelect,
  onExpand,
  depth,
  itemRefs,
  focusedKey,
  onFocusChange,
  expandedKeys,
  onToggleExpand,
}: SchemaTreeNodeProps): ReactNode {
  const segment = buildPathSegment(node.attribute, node.isArray);
  const fullPath = buildFullPath(pathPrefix, node.attribute, node.isArray);
  const itemKey = `${pathPrefix}/${node.attribute}`;
  const currentSegments = useMemo(
    () => [...pathSegments, node.attribute],
    [pathSegments, node.attribute]
  );
  const isExpandable = !node.isPrimitive && depth < MAX_DEPTH;
  const isExpanded = expandedKeys.has(itemKey);
  const isLoadingChildren = isExpanded && node.children === undefined;
  const isFocused = focusedKey === itemKey;

  // Register/unregister this item's element ref for keyboard navigation
  const liRef = (el: HTMLLIElement | null) => {
    if (el) {
      itemRefs.current.set(itemKey, el);
    } else {
      itemRefs.current.delete(itemKey);
    }
  };

  const handleToggle = useCallback(() => {
    onToggleExpand(itemKey);
    if (!isExpanded && node.children === undefined && node.typeReference) {
      onExpand(rootSection, currentSegments, node.typeReference, depth);
    }
  }, [
    isExpanded,
    itemKey,
    node.children,
    node.typeReference,
    rootSection,
    currentSegments,
    onExpand,
    onToggleExpand,
    depth,
  ]);

  const handleSelect = useCallback(() => {
    onSelect(fullPath);
  }, [onSelect, fullPath]);

  return (
    <li
      ref={liRef}
      role="treeitem"
      aria-expanded={isExpandable ? isExpanded : undefined}
      aria-level={depth}
      aria-label={`${node.name} (${node.typeReference})`}
      tabIndex={isFocused ? 0 : -1}
      data-tree-key={itemKey}
      data-expandable={isExpandable ? "true" : undefined}
      data-expanded={isExpanded ? "true" : undefined}
      className="focus-visible:ring-primary outline-none focus-visible:rounded focus-visible:ring-1"
      onFocus={() => onFocusChange(itemKey)}
    >
      <div
        className={cn(
          "flex items-center gap-0.5 rounded px-0.5",
          isFocused && "ring-primary ring-1"
        )}
      >
        {/* Expand/collapse indicator */}
        {isExpandable ? (
          <button
            type="button"
            onClick={handleToggle}
            tabIndex={-1}
            className="text-muted-foreground hover:text-foreground flex h-6 w-5 shrink-0 items-center justify-center"
            aria-hidden="true"
          >
            {isLoadingChildren ? (
              <Skeleton className="h-3 w-3 rounded-full" />
            ) : isExpanded ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
          </button>
        ) : (
          <span className="w-5 shrink-0" />
        )}

        {/* Field row */}
        <button
          type="button"
          onClick={handleSelect}
          tabIndex={-1}
          className={cn(
            "flex min-w-0 flex-1 items-center gap-1.5 rounded px-1.5 py-0.5 text-left text-xs",
            "hover:bg-muted"
          )}
          aria-hidden="true"
          data-testid="tree-select"
        >
          <code className="text-primary shrink-0 font-mono text-[11px]">{segment}</code>
          <span className="text-foreground truncate">{node.name}</span>
          <span className="text-muted-foreground ml-auto shrink-0 text-[10px]">
            {node.typeReference}
          </span>
        </button>
      </div>

      {/* Children (expanded non-primitive) */}
      {isExpanded && (
        <ul className="border-border ml-2.5 border-l pl-1.5" role="group">
          {isLoadingChildren && (
            <li role="none" className="space-y-1 px-2 py-1">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-3.5 w-20" />
            </li>
          )}
          {node.children && node.children.length === 0 && (
            <li role="none" className="text-muted-foreground px-2 py-1 text-[11px]">
              No nested fields
            </li>
          )}
          {node.children &&
            node.children.length === 1 &&
            node.children[0]?.attribute === "__error__" && (
              <li role="none" className="text-destructive px-2 py-1 text-[11px]">
                Failed to load nested fields
              </li>
            )}
          {node.children
            ?.filter((child) => child.attribute !== "__error__")
            .map((child) => (
              <SchemaTreeNode
                key={child.attribute}
                node={child}
                pathPrefix={fullPath}
                pathSegments={currentSegments}
                rootSection={rootSection}
                onSelect={onSelect}
                onExpand={onExpand}
                depth={depth + 1}
                itemRefs={itemRefs}
                focusedKey={focusedKey}
                onFocusChange={onFocusChange}
                expandedKeys={expandedKeys}
                onToggleExpand={onToggleExpand}
              />
            ))}
        </ul>
      )}
    </li>
  );
}

// -- Root Section --

function RootSection({
  label,
  pathPrefix,
  nodes,
  rootSection,
  onSelect,
  onExpand,
  itemRefs,
  focusedKey,
  onFocusChange,
  expandedKeys,
  onToggleExpand,
}: {
  label: string;
  pathPrefix: string;
  nodes: SchemaNode[];
  rootSection: "eventData" | "eventTarget" | "customer";
  onSelect: (path: string) => void;
  onExpand: SchemaTreeNodeProps["onExpand"];
  itemRefs: React.RefObject<Map<string, HTMLLIElement>>;
  focusedKey: string | null;
  onFocusChange: (key: string) => void;
  expandedKeys: Set<string>;
  onToggleExpand: (key: string) => void;
}): ReactNode {
  if (nodes.length === 0) return null;

  return (
    <section>
      <h3 className="text-muted-foreground mb-1 px-1 text-[10px] font-semibold tracking-wider uppercase">
        {label}
      </h3>
      <ul role="tree" aria-label={`${label} fields`}>
        {nodes.map((node) => (
          <SchemaTreeNode
            key={node.attribute}
            node={node}
            pathPrefix={pathPrefix}
            pathSegments={[]}
            rootSection={rootSection}
            onSelect={onSelect}
            onExpand={onExpand}
            depth={1}
            itemRefs={itemRefs}
            focusedKey={focusedKey}
            onFocusChange={onFocusChange}
            expandedKeys={expandedKeys}
            onToggleExpand={onToggleExpand}
          />
        ))}
      </ul>
    </section>
  );
}

// -- Main Component --

export const JsonPathBrowser = memo(function JsonPathBrowser({
  onSelect,
  disabled,
}: JsonPathBrowserProps): ReactNode {
  const [open, setOpen] = useState(false);
  const {
    eventDataNodes,
    eventTargetNodes,
    customerNodes,
    expandNode: onExpandNode,
    isLoading,
    error,
    mode,
    hasSchemaSource,
  } = useJsonPathSchema();

  const [focusedKey, setFocusedKey] = useState<string | null>(null);
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());
  const itemRefs = useRef<Map<string, HTMLLIElement>>(new Map());

  const [selectedPath, setSelectedPath] = useState<string | null>(null);

  const handleSelect = useCallback(
    (path: string) => {
      setSelectedPath(path);
      onSelect(path);
      setOpen(false);
    },
    [onSelect]
  );

  const handleToggleExpand = useCallback((key: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const hasNodes = isRootPathMode(mode)
    ? customerNodes.length > 0
    : eventDataNodes.length > 0 || eventTargetNodes.length > 0;

  // Collect all visible keys for keyboard navigation
  const visibleKeys = useMemo(() => {
    const keys: string[] = [];
    if (isRootPathMode(mode)) {
      keys.push(...collectVisibleKeys(customerNodes, "$", expandedKeys));
    } else {
      keys.push(...collectVisibleKeys(eventDataNodes, "$.eventData", expandedKeys));
      keys.push(...collectVisibleKeys(eventTargetNodes, "$.eventTarget", expandedKeys));
    }
    return keys;
  }, [mode, customerNodes, eventDataNodes, eventTargetNodes, expandedKeys]);

  // Track expanded state globally for collectVisibleKeys
  const handleFocusChange = useCallback((key: string) => {
    setFocusedKey(key);
  }, []);

  // Keyboard navigation handler for the tree container
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const currentIndex = focusedKey ? visibleKeys.indexOf(focusedKey) : -1;

      switch (e.key) {
        case "ArrowDown": {
          e.preventDefault();
          const nextIndex = currentIndex < visibleKeys.length - 1 ? currentIndex + 1 : currentIndex;
          const nextKey = visibleKeys[nextIndex];
          if (nextKey) {
            setFocusedKey(nextKey);
            itemRefs.current.get(nextKey)?.focus();
          }
          break;
        }
        case "ArrowUp": {
          e.preventDefault();
          const prevIndex = currentIndex > 0 ? currentIndex - 1 : 0;
          const prevKey = visibleKeys[prevIndex];
          if (prevKey) {
            setFocusedKey(prevKey);
            itemRefs.current.get(prevKey)?.focus();
          }
          break;
        }
        case "ArrowRight": {
          e.preventDefault();
          if (!focusedKey) break;
          const el = itemRefs.current.get(focusedKey);
          if (!el) break;
          if (el.dataset.expandable === "true") {
            if (el.dataset.expanded !== "true") {
              // Expand via the toggle button (triggers handleToggle → onToggleExpand)
              const expandBtn = el.querySelector<HTMLButtonElement>(
                'button[aria-hidden="true"]:first-of-type'
              );
              expandBtn?.click();
            } else {
              // Already expanded: move to first child
              const nextIndex = currentIndex + 1;
              const nextKey = visibleKeys[nextIndex];
              if (nextKey) {
                setFocusedKey(nextKey);
                itemRefs.current.get(nextKey)?.focus();
              }
            }
          }
          break;
        }
        case "ArrowLeft": {
          e.preventDefault();
          if (!focusedKey) break;
          const el = itemRefs.current.get(focusedKey);
          if (!el) break;
          if (el.dataset.expandable === "true" && el.dataset.expanded === "true") {
            // Collapse via the toggle button (triggers handleToggle → onToggleExpand)
            const expandBtn = el.querySelector<HTMLButtonElement>(
              'button[aria-hidden="true"]:first-of-type'
            );
            expandBtn?.click();
          } else {
            // Move to parent item
            const parentKey = focusedKey.substring(0, focusedKey.lastIndexOf("/"));
            if (parentKey) {
              const parentIndex = visibleKeys.indexOf(parentKey);
              if (parentIndex >= 0) {
                setFocusedKey(parentKey);
                itemRefs.current.get(parentKey)?.focus();
              }
            }
          }
          break;
        }
        case "Home": {
          e.preventDefault();
          const firstKey = visibleKeys[0];
          if (firstKey) {
            setFocusedKey(firstKey);
            itemRefs.current.get(firstKey)?.focus();
          }
          break;
        }
        case "End": {
          e.preventDefault();
          const lastKey = visibleKeys[visibleKeys.length - 1];
          if (lastKey) {
            setFocusedKey(lastKey);
            itemRefs.current.get(lastKey)?.focus();
          }
          break;
        }
        case "Enter":
        case " ": {
          e.preventDefault();
          if (!focusedKey) break;
          const el = itemRefs.current.get(focusedKey);
          if (!el) break;
          // Click the select button (second button)
          const selectBtn = el.querySelector<HTMLButtonElement>(
            'button[aria-hidden="true"]:last-of-type'
          );
          selectBtn?.click();
          break;
        }
      }
    },
    [focusedKey, visibleKeys]
  );

  // Focus first item when popover opens
  useEffect(() => {
    if (open && hasNodes && visibleKeys.length > 0) {
      const firstKey = visibleKeys[0];
      if (firstKey) {
        setFocusedKey(firstKey);
        // Delay focus to allow popover to render
        requestAnimationFrame(() => {
          itemRefs.current.get(firstKey)?.focus();
        });
      }
    }
    if (!open) {
      setFocusedKey(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only focus on open/close, not tree changes
  }, [open, hasNodes]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || isLoading}
          className="h-9 w-9 shrink-0 p-0"
          aria-label="Browse schema fields"
          title="Browse available fields"
        >
          <Database className="h-3.5 w-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end" sideOffset={4}>
        <header className="border-border border-b px-3 py-2">
          <p className="text-foreground text-xs font-medium">Browse Fields</p>
          <p className="text-muted-foreground text-[11px]">Select a field to insert its path</p>
        </header>
        <div className="max-h-72 overflow-y-auto p-2" onKeyDown={handleKeyDown}>
          {isLoading ? (
            <div className="space-y-1.5 p-1">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="ml-3 h-4 w-24" />
              <Skeleton className="ml-3 h-4 w-28" />
            </div>
          ) : error ? (
            <p className="text-destructive p-2 text-center text-xs">{error}</p>
          ) : !hasNodes ? (
            <p className="text-muted-foreground p-2 text-center text-xs">
              {mode === "feed"
                ? "This feed has no fields yet. Map some fields, or type a path such as $.row.status."
                : mode === "customer"
                  ? "No customer fields available. Check data model configuration."
                  : hasSchemaSource
                    ? "No fields are defined for this data model. Type a JSON path manually."
                    : "No schema fields available. Select an event type first."}
            </p>
          ) : isRootPathMode(mode) ? (
            <div className="space-y-3">
              <RootSection
                label={mode === "feed" ? "Row" : "Customer Fields"}
                pathPrefix="$"
                nodes={customerNodes}
                rootSection="customer"
                onSelect={handleSelect}
                onExpand={onExpandNode}
                itemRefs={itemRefs}
                focusedKey={focusedKey}
                onFocusChange={handleFocusChange}
                expandedKeys={expandedKeys}
                onToggleExpand={handleToggleExpand}
              />
            </div>
          ) : (
            <div className="space-y-3">
              <RootSection
                label="$.eventData"
                pathPrefix="$.eventData"
                nodes={eventDataNodes}
                rootSection="eventData"
                onSelect={handleSelect}
                onExpand={onExpandNode}
                itemRefs={itemRefs}
                focusedKey={focusedKey}
                onFocusChange={handleFocusChange}
                expandedKeys={expandedKeys}
                onToggleExpand={handleToggleExpand}
              />
              <RootSection
                label="$.eventTarget"
                pathPrefix="$.eventTarget"
                nodes={eventTargetNodes}
                rootSection="eventTarget"
                onSelect={handleSelect}
                onExpand={onExpandNode}
                itemRefs={itemRefs}
                focusedKey={focusedKey}
                onFocusChange={handleFocusChange}
                expandedKeys={expandedKeys}
                onToggleExpand={handleToggleExpand}
              />
            </div>
          )}
        </div>
      </PopoverContent>
      {/* Live region announces selected path to screen readers */}
      <p aria-live="polite" className="sr-only">
        {selectedPath ? `Selected path: ${selectedPath}` : ""}
      </p>
    </Popover>
  );
});
