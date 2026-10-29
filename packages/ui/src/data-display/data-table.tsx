"use client";

import { defaultRangeExtractor, useVirtualizer, type Range } from "@tanstack/react-virtual";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  X,
} from "lucide-react";
import * as React from "react";

import { cn } from "../lib/utils";
import { Button } from "../primitives/button";
import { Checkbox } from "../primitives/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../primitives/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../primitives/select";
import { Skeleton } from "../primitives/skeleton";

export interface Column<T> {
  /** Unique key for the column */
  key: string;
  /** Header label or custom header content */
  header: string | React.ReactNode;
  /** Render function for cell content */
  render: (item: T) => React.ReactNode;
  /** Column width class (optional) */
  width?: string;
  /** Sort key override — use when the display key differs from the server sort field. */
  sortKey?: string;
}

/** Column sort state; re-exported from /entity for ergonomic imports. */
export interface SortState {
  column: string;
  direction: "asc" | "desc";
}

/** Next state in the 3-state sort cycle (asc → desc → unsorted). */
function cycleSort(current: SortState | undefined, column: string): SortState | null {
  if (!current || current.column !== column) return { column, direction: "asc" };
  if (current.direction === "asc") return { column, direction: "desc" };
  return null;
}

export interface DataTableAction {
  /** Action label */
  label: string;
  /** Click handler. Returning a Promise is supported — DataTable does not await it. */
  onClick: (item: unknown) => void | Promise<void>;
  /** Whether action is destructive */
  destructive?: boolean;
  /** Per-row predicate — return true to hide the action on that row */
  hidden?: (item: unknown) => boolean;
}

/** Whether a row may be selected, and why not when it may not. */
export interface RowSelectability {
  /** False disables the row's checkbox and leaves it out of header select-all. */
  selectable: boolean;
  /** Shown to assistive technology (and as a tooltip) when the row cannot be selected. */
  reason?: string;
}

export interface PaginationConfig {
  /** Current page (1-indexed) */
  page: number;
  /** Items per page */
  pageSize: number;
  /** Total number of items */
  total: number;
  /**
   * `total` is a floor, not a count: rows past it may exist. The footer reads
   * "of N+ results" and offers one page beyond the rows known so far.
   */
  totalIsLowerBound?: boolean;
  /** Callback when page changes */
  onPageChange: (page: number) => void;
  /** Callback when the page size changes. Renders the rows-per-page selector when set. */
  onPageSizeChange?: (pageSize: number) => void;
  /** Rows-per-page choices. Defaults to {@link PAGE_SIZE_OPTIONS}. */
  pageSizeOptions?: readonly number[];
}

/** Rows-per-page choices offered by the table footer. The largest is the Platform API's page-size limit. */
export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;

export interface BulkAction<T> {
  /** Action label */
  label: string;
  /** Optional icon component */
  icon?: React.ComponentType<{ className?: string }>;
  /** Click handler. Returning a Promise is supported — DataTable does not await it. */
  onClick: (selectedItems: T[], allSelectedKeys: Set<string>) => void | Promise<void>;
}

/**
 * Opt-in windowed rendering. Omit this prop and the table renders every row in
 * `data` exactly as before — the paginated, page-scrolling path stays the
 * default and the documented accessible fallback.
 *
 * Windowing keeps native `<table>` semantics: the virtualizer supplies the
 * visible index range only, and the body emits spacer rows for the space above
 * and below it. No row is ever measured or absolutely positioned.
 */
interface VirtualizationBase {
  /**
   * Row height in px. Fixed rather than measured — spacer-row windowing needs a
   * known height, so cell content taller than this is clipped instead of
   * wrapping. The full value belongs in the row-detail Sheet.
   */
  rowHeight: number;
  /** Rows rendered above and below the viewport. Defaults to {@link DEFAULT_OVERSCAN}. */
  overscan?: number;
  /** Whether the server holds more rows than `data` currently does. */
  hasMore?: boolean;
  /** A page fetch is in flight — suppresses duplicate fetches. */
  loadingMore?: boolean;
  /**
   * Fetches the next page. Called when the window reaches the last loaded row,
   * and by the "Load more" button — without a keyboard-reachable control, a
   * keyboard-only operator cannot reach a row past the first fetched page.
   */
  onLoadMore?: () => void;
}

/**
 * Opt-in windowed rendering configuration for {@link DataTable}.
 *
 * Pass exactly one viewport bound: {@link maxHeight} is the documented API;
 * {@link height} remains for backwards compatibility.
 */
export type VirtualizationConfig = VirtualizationBase &
  (
    | {
        /**
         * Tallest the inner scroll viewport grows before it scrolls, in px.
         * Shorter content shrinks it, so short lists and empty states leave no
         * blank space.
         */
        maxHeight: number;
        height?: never;
      }
    | {
        /**
         * @deprecated Use {@link maxHeight}. This now also acts as a maximum:
         * shorter content shrinks the viewport instead of leaving blank space.
         */
        height: number;
        maxHeight?: never;
      }
  );

/** Rows rendered on each side of the viewport when none is configured. */
const DEFAULT_OVERSCAN = 6;

interface DataTableBaseProps<T> {
  /** Column definitions */
  columns: Column<T>[];
  /** Data to display */
  data: T[];
  /** Row key extractor */
  getRowKey?: (item: T, index: number) => string;
  /** Row actions dropdown */
  actions?: DataTableAction[];
  /** Pagination configuration */
  pagination?: PaginationConfig;
  /**
   * Total rows the server holds, which is what `aria-rowcount` reports. Needed
   * whenever the DOM holds only part of the set: in virtualized mode `data` is
   * just what has been fetched so far and `pagination.total` is unused.
   */
  totalCount?: number;
  /** Opt into windowed rendering. See {@link VirtualizationConfig}. */
  virtualization?: VirtualizationConfig;
  /** Loading state */
  loading?: boolean;
  /** Empty state message or custom content */
  emptyMessage?: string | React.ReactNode;
  /** Additional className */
  className?: string;
  /** Enable row selection with checkboxes */
  enableRowSelection?: boolean;
  /**
   * Callback when selection changes. Receives the selected items on the
   * current page plus the full selected key set, which spans pages — the key
   * set is authoritative, `selectedItems` can only ever cover `data`.
   */
  onSelectionChange?: (selectedItems: T[], allSelectedKeys: Set<string>) => void;
  /** Externally controlled selection (keys from getRowKey) */
  selectedKeys?: Set<string>;
  /**
   * Per-row selectability. An unselectable row's checkbox is disabled and
   * described by `reason`; header select-all and its checked/indeterminate
   * state count only selectable rows. Omit to make every row selectable.
   * Keep the callback referentially stable (define it outside render or
   * memoize it): it keys a memo, so a new function each render recomputes
   * every row's selectability.
   */
  getRowSelectability?: (item: T, index: number) => RowSelectability;
  /** Bulk actions shown in toolbar when rows are selected */
  bulkActions?: BulkAction<T>[];
  /** Active sort. A column is sortable when its `key`/`sortKey` is in {@link sortableColumns}. */
  sort?: SortState;
  /** Sort cycle handler. Receives `null` when the column cycles back to unsorted. */
  onSortChange?: (sort: SortState | null) => void;
  /** Sort keys (matched against column `sortKey` or `key`) that should render as sort buttons. */
  sortableColumns?: readonly string[];
}

// getRowLabel is required iff the row is clickable — every focusable row gets a name (4.1.2).
type RowActivationProps<T> =
  | { onRowClick?: undefined; getRowLabel?: never }
  | {
      /** Row click handler */
      onRowClick: (item: T) => void;
      /**
       * Accessible name for a clickable row, describing what activating it does
       * (WCAG 4.1.2). Required whenever `onRowClick` is set.
       */
      getRowLabel: (item: T) => string;
    };

export type DataTableProps<T> = DataTableBaseProps<T> & RowActivationProps<T>;

/**
 * Generic data table component with pagination and row actions.
 * Used for displaying lists across both Dashboard and Hub.
 */
export function DataTable<T>({
  columns,
  data,
  getRowKey,
  actions,
  pagination,
  totalCount,
  virtualization,
  loading = false,
  emptyMessage = "No data available",
  onRowClick,
  getRowLabel,
  className,
  enableRowSelection = false,
  onSelectionChange,
  selectedKeys: externalSelectedKeys,
  getRowSelectability,
  bulkActions,
  sort,
  onSortChange,
  sortableColumns,
}: DataTableProps<T>) {
  const sortableSet = React.useMemo(
    () => (sortableColumns ? new Set(sortableColumns) : null),
    [sortableColumns]
  );
  const totalPages = pagination
    ? Math.ceil((pagination.total + (pagination.totalIsLowerBound ? 1 : 0)) / pagination.pageSize)
    : 1;
  const pageSizeOptions =
    pagination?.pageSizeOptions && pagination.pageSizeOptions.length > 0
      ? pagination.pageSizeOptions
      : PAGE_SIZE_OPTIONS;
  // The size selector stays visible while a smaller size would still split the list into pages.
  const showPageSizeSelector =
    !!pagination?.onPageSizeChange &&
    (pagination.totalIsLowerBound || pagination.total > Math.min(...pageSizeOptions));

  // Selection state — use external keys if provided, otherwise internal
  const [internalSelectedKeys, setInternalSelectedKeys] = React.useState<Set<string>>(new Set());
  const selectedKeys = externalSelectedKeys ?? internalSelectedKeys;
  const lastClickedIndexRef = React.useRef<number | null>(null);
  const shiftHandledRef = React.useRef(false);

  // Reset Shift+Click anchor when data changes (pagination, filtering)
  React.useEffect(() => {
    lastClickedIndexRef.current = null;
  }, [data]);

  const resolveKey = React.useCallback(
    (item: T, index: number) => (getRowKey ? getRowKey(item, index) : index.toString()),
    [getRowKey]
  );

  const updateSelection = React.useCallback(
    (newKeys: Set<string>) => {
      if (!externalSelectedKeys) {
        setInternalSelectedKeys(newKeys);
      }
      if (onSelectionChange) {
        const selectedItems = data.filter((item, i) => newKeys.has(resolveKey(item, i)));
        onSelectionChange(selectedItems, newKeys);
      }
    },
    [data, externalSelectedKeys, onSelectionChange, resolveKey]
  );

  // One entry per row; null when the consumer did not opt in, so every row is
  // selectable and nothing below changes.
  const rowSelectability = React.useMemo(
    () =>
      enableRowSelection && getRowSelectability
        ? data.map((item, i) => getRowSelectability(item, i))
        : null,
    [data, enableRowSelection, getRowSelectability]
  );
  const isRowSelectable = React.useCallback(
    (index: number) => rowSelectability?.[index]?.selectable ?? true,
    [rowSelectability]
  );

  const handleRowSelect = React.useCallback(
    (index: number, shiftKey: boolean) => {
      if (!data[index] || !isRowSelectable(index)) return;
      const key = resolveKey(data[index], index);
      const newKeys = new Set(selectedKeys);

      if (shiftKey && lastClickedIndexRef.current !== null) {
        // Shift+Click range selection
        const start = Math.min(lastClickedIndexRef.current, index);
        const end = Math.max(lastClickedIndexRef.current, index);
        for (let i = start; i <= end; i++) {
          const row = data[i];
          if (row && isRowSelectable(i)) newKeys.add(resolveKey(row, i));
        }
      } else {
        // Toggle single row
        if (newKeys.has(key)) {
          newKeys.delete(key);
        } else {
          newKeys.add(key);
        }
      }

      lastClickedIndexRef.current = index;
      updateSelection(newKeys);
    },
    [data, selectedKeys, resolveKey, updateSelection, isRowSelectable]
  );

  // Derived selection state. Both walks are O(n) over the whole array, which in
  // virtualized mode is the entire fetched catalog — neither may re-run on
  // every render just because a scroll moved the window.
  const pageKeys = React.useMemo(
    () => data.map((item, i) => resolveKey(item, i)),
    [data, resolveKey]
  );
  const pageSelectedCount = React.useMemo(
    () => pageKeys.reduce((count, key) => (selectedKeys.has(key) ? count + 1 : count), 0),
    [pageKeys, selectedKeys]
  );
  // Header select-all and its state only ever consider the selectable rows.
  const selectablePageKeys = React.useMemo(
    () => (rowSelectability ? pageKeys.filter((_, i) => isRowSelectable(i)) : pageKeys),
    [pageKeys, rowSelectability, isRowSelectable]
  );
  const selectablePageSelectedCount = React.useMemo(
    () =>
      rowSelectability
        ? selectablePageKeys.reduce((count, key) => (selectedKeys.has(key) ? count + 1 : count), 0)
        : pageSelectedCount,
    [rowSelectability, selectablePageKeys, selectedKeys, pageSelectedCount]
  );

  const handleSelectAll = React.useCallback(() => {
    if (selectablePageKeys.length === 0) return;
    const allSelected = selectablePageKeys.every((k) => selectedKeys.has(k));
    const newKeys = new Set(selectedKeys);

    if (allSelected) {
      // Deselect current page
      for (const k of selectablePageKeys) newKeys.delete(k);
    } else {
      // Select current page
      for (const k of selectablePageKeys) newKeys.add(k);
    }

    updateSelection(newKeys);
  }, [selectablePageKeys, selectedKeys, updateSelection]);

  const handleClearAll = React.useCallback(() => {
    updateSelection(new Set());
  }, [updateSelection]);

  const totalSelected = selectedKeys.size;
  const allPageSelected =
    selectablePageKeys.length > 0 && selectablePageSelectedCount === selectablePageKeys.length;
  const somePageSelected = selectablePageSelectedCount > 0 && !allPageSelected;
  // Only an opted-in table can end up with nothing selectable on a page.
  const headerSelectDisabled =
    rowSelectability !== null && data.length > 0 && selectablePageKeys.length === 0;
  const selectionReasonIdPrefix = React.useId();

  // Total column count for colSpan calculations
  const hasActions = !!actions && actions.length > 0;
  const totalColCount = columns.length + (enableRowSelection ? 1 : 0) + (hasActions ? 1 : 0);

  // ─── Windowed rendering (opt-in) ──────────────────────────────────────────
  const isVirtual = !!virtualization;
  const viewportMaxHeight = virtualization?.maxHeight ?? virtualization?.height;
  const windowed = isVirtual && !loading && data.length > 0;
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const statusId = React.useId();
  // The focused row's data index, kept so the row survives outside the window.
  const [focusedIndex, setFocusedIndex] = React.useState<number | null>(null);

  const rangeExtractor = React.useCallback(
    (range: Range) => {
      const indexes = defaultRangeExtractor(range);
      // A focused row that unmounts drops focus to <body> and takes the screen
      // reader's cursor with it, so it stays rendered wherever the window is.
      const first = indexes[0];
      const last = indexes[indexes.length - 1];
      if (focusedIndex === null || first === undefined || last === undefined) return indexes;
      if (focusedIndex < 0 || focusedIndex >= range.count) return indexes;
      if (focusedIndex >= first && focusedIndex <= last) return indexes;
      return focusedIndex < first ? [focusedIndex, ...indexes] : [...indexes, focusedIndex];
    },
    [focusedIndex]
  );

  const virtualizer = useVirtualizer({
    count: data.length,
    enabled: windowed,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => virtualization?.rowHeight ?? 1,
    overscan: virtualization?.overscan ?? DEFAULT_OVERSCAN,
    rangeExtractor,
  });

  const virtualItems = windowed ? virtualizer.getVirtualItems() : [];
  const lastWindowedIndex =
    virtualItems.length > 0 ? (virtualItems[virtualItems.length - 1]?.index ?? -1) : -1;

  const handleRowFocus = React.useCallback(
    (index: number) => {
      setFocusedIndex(index);
      // A row only rendered because it holds focus is off-screen; bring it back.
      // `align: "auto"` is a no-op while the row is already visible.
      virtualizer.scrollToIndex(index, { align: "auto" });
    },
    [virtualizer]
  );

  const firstRowKey = pageKeys[0];
  const previousHeadRef = React.useRef({ key: firstRowKey, length: data.length });

  React.useEffect(() => {
    const previous = previousHeadRef.current;
    previousHeadRef.current = { key: firstRowKey, length: data.length };
    if (!isVirtual) return;
    // A fetched page appends below the same head row; a new filter or sort
    // replaces it. Only the second may drop the operator back to the top — and
    // it must, because the offset and the cached sizes describe the old array.
    if (firstRowKey === previous.key && data.length >= previous.length) return;
    setFocusedIndex(null);
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
    virtualizer.scrollToOffset(0);
    virtualizer.measure();
  }, [firstRowKey, data.length, isVirtual, virtualizer]);

  // Held in a ref so an inline callback prop cannot re-trigger the fetch below.
  const loadMoreRef = React.useRef(virtualization?.onLoadMore);
  React.useEffect(() => {
    loadMoreRef.current = virtualization?.onLoadMore;
  });

  const hasMore = virtualization?.hasMore ?? false;
  const loadingMore = virtualization?.loadingMore ?? false;

  React.useEffect(() => {
    if (!hasMore || loadingMore) return;
    if (lastWindowedIndex >= 0 && lastWindowedIndex >= data.length - 1) loadMoreRef.current?.();
  }, [hasMore, loadingMore, lastWindowedIndex, data.length]);

  // aria-rowcount counts the header row too, so aria-rowindex — 1-based across
  // the whole table — never runs past it.
  const serverRowCount = totalCount ?? (isVirtual ? data.length : undefined);
  const ariaRowCount = serverRowCount === undefined ? undefined : serverRowCount + 1;
  // Windowed indexes are already absolute; a page's are relative to the page.
  const rowIndexOffset = windowed || !pagination ? 0 : (pagination.page - 1) * pagination.pageSize;
  const ariaRowIndexFor = (index: number) =>
    ariaRowCount === undefined ? undefined : rowIndexOffset + index + 2;

  /**
   * A table cell's `height` is only a minimum, so an inner box is what actually
   * holds a windowed row to its fixed height and clips taller content.
   */
  const cellBox = (node: React.ReactNode, alignClass?: string) =>
    virtualization ? (
      <div
        className={cn("flex items-center overflow-hidden", alignClass)}
        style={{ height: virtualization.rowHeight }}
      >
        {node}
      </div>
    ) : (
      node
    );

  const spacerRow = (key: string, height: number) => (
    <tr key={key} aria-hidden="true" style={{ height }}>
      <td colSpan={totalColCount} className="p-0" />
    </tr>
  );

  const renderRow = (item: T, index: number) => {
    const key = resolveKey(item, index);
    const visibleActions = actions?.filter((action) => !action.hidden?.(item)) ?? [];
    const isSelected = selectedKeys.has(key);
    const selectability = rowSelectability?.[index];
    const selectable = selectability?.selectable ?? true;
    const unselectableReason = selectable ? undefined : selectability?.reason;
    const reasonId = unselectableReason ? `${selectionReasonIdPrefix}-${index}` : undefined;
    return (
      <tr
        key={key}
        aria-rowindex={ariaRowIndexFor(index)}
        style={virtualization ? { height: virtualization.rowHeight } : undefined}
        className={cn(
          "border-border hover:bg-muted border-b transition-colors last:border-0",
          // Striping follows the data index, so it does not flicker as the
          // window moves past a row.
          index % 2 === 1 && "bg-muted/40",
          isSelected && "bg-primary/5",
          onRowClick &&
            "focus-visible:ring-ring cursor-pointer focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset"
        )}
        onClick={onRowClick ? () => onRowClick(item) : undefined}
        // Focus anywhere in the row (the row itself, its checkbox, its menu)
        // pins that row into the render window.
        onFocus={isVirtual ? () => handleRowFocus(index) : undefined}
        // Keyboard operability for clickable rows (WCAG 2.1.1). Role stays
        // "row": rows can hold nested controls (selection, actions menu), so
        // role="button" would be an invalid nested-interactive structure.
        // getRowLabel gives the focusable row an accessible name (4.1.2).
        tabIndex={onRowClick ? 0 : undefined}
        aria-label={onRowClick && getRowLabel ? getRowLabel(item) : undefined}
        onKeyDown={
          onRowClick
            ? (e) => {
                // Only the row itself activates — Enter/Space bubbling up from a
                // nested control (checkbox, actions menu) must not also fire the
                // row click.
                if (e.target !== e.currentTarget) return;
                // Activate on Enter/Space like a button; Space must not scroll.
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onRowClick(item);
                }
              }
            : undefined
        }
      >
        {enableRowSelection && (
          <td
            className={cn("w-12 px-4 py-3", isVirtual && "overflow-hidden py-0")}
            // A disabled checkbox swallows nothing, so a click on it would
            // otherwise reach the row and activate it.
            onClick={selectable ? undefined : (e) => e.stopPropagation()}
          >
            {cellBox(
              <>
                <Checkbox
                  checked={isSelected}
                  disabled={!selectable}
                  aria-describedby={reasonId}
                  title={unselectableReason}
                  onCheckedChange={() => {
                    // Skip if shift+click already handled this via onClick
                    if (shiftHandledRef.current) {
                      shiftHandledRef.current = false;
                      return;
                    }
                    handleRowSelect(index, false);
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (e.shiftKey) {
                      e.preventDefault();
                      shiftHandledRef.current = true;
                      handleRowSelect(index, true);
                    }
                  }}
                  aria-label={`Select row ${index + 1}`}
                  className="block"
                />
                {reasonId && (
                  <span id={reasonId} className="sr-only">
                    {unselectableReason}
                  </span>
                )}
              </>
            )}
          </td>
        )}
        {columns.map((column) => (
          <td
            key={column.key}
            className={cn("px-4 py-3", column.width, isVirtual && "overflow-hidden py-0")}
          >
            {cellBox(column.render(item))}
          </td>
        ))}
        {hasActions && (
          <td className={cn("px-4 py-3 text-right", isVirtual && "overflow-hidden py-0")}>
            {visibleActions.length > 0 &&
              cellBox(
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="text-muted-foreground h-8 w-8"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MoreHorizontal className="h-4 w-4" />
                      <span className="sr-only">Open menu</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {visibleActions.map((action) => (
                      <DropdownMenuItem
                        key={action.label}
                        onClick={(e) => {
                          e.stopPropagation();
                          action.onClick(item);
                        }}
                        className={cn(action.destructive && "text-destructive")}
                      >
                        {action.label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>,
                "justify-end"
              )}
          </td>
        )}
      </tr>
    );
  };

  /**
   * Windowed body: the rows the virtualizer selected, with a spacer row filling
   * every gap — above the window, below it, and around a row force-kept for
   * focus. Spacers are aria-hidden so they never enter the row count.
   */
  const renderWindowedRows = () => {
    const nodes: React.ReactNode[] = [];
    let filledTo = 0;
    for (const virtualRow of virtualItems) {
      const item = data[virtualRow.index];
      if (!item) continue;
      if (virtualRow.start > filledTo) {
        nodes.push(spacerRow(`spacer-before-${virtualRow.index}`, virtualRow.start - filledTo));
      }
      nodes.push(renderRow(item, virtualRow.index));
      filledTo = Math.max(filledTo, virtualRow.end);
    }
    const totalSize = virtualizer.getTotalSize();
    if (totalSize > filledTo) nodes.push(spacerRow("spacer-end", totalSize - filledTo));
    return nodes;
  };

  return (
    <div
      className={cn(
        "border-card-border bg-card overflow-hidden rounded-lg border shadow-sm",
        className
      )}
    >
      {/* Bulk action toolbar */}
      {enableRowSelection && totalSelected > 0 && bulkActions && bulkActions.length > 0 && (
        <div
          className="bg-primary/5 border-primary/20 flex items-center justify-between border-b px-4 py-2"
          role="toolbar"
          aria-label={`Bulk actions for ${totalSelected} selected items`}
        >
          <span className="text-sm font-medium" role="status">
            {pageSelectedCount === totalSelected
              ? `${totalSelected} selected`
              : isVirtual
                ? `${pageSelectedCount} loaded, ${totalSelected} total selected`
                : `${pageSelectedCount} on this page, ${totalSelected} total selected`}
          </span>
          <div className="flex items-center gap-2">
            {bulkActions.map((action, i) => (
              <Button
                key={i}
                variant="outline"
                size="sm"
                onClick={() => {
                  const selectedItems = data.filter((item, idx) =>
                    selectedKeys.has(resolveKey(item, idx))
                  );
                  action.onClick(selectedItems, selectedKeys);
                }}
              >
                {action.icon && <action.icon className="mr-1.5 h-3.5 w-3.5" />}
                {action.label}
              </Button>
            ))}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearAll}
              className="text-muted-foreground hover:text-foreground ml-2 h-8 px-2 text-xs"
            >
              <X className="mr-1 h-3 w-3" />
              Clear all
            </Button>
          </div>
        </div>
      )}

      {/* Windowing is lossy for find-in-page, read-all and print, so the surface says so. */}
      {isVirtual && (
        <p className="sr-only" id={statusId} role="status">
          Showing {data.length.toLocaleString()} of{" "}
          {(serverRowCount ?? data.length).toLocaleString()} entries. Rows render as you scroll.
        </p>
      )}

      <div
        ref={scrollRef}
        className={cn(
          "overflow-x-auto",
          isVirtual &&
            "focus-visible:ring-ring overflow-y-auto focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset"
        )}
        style={isVirtual ? { maxHeight: viewportMaxHeight } : undefined}
        // A scroll container must be operable without a pointer (WCAG 2.1.1).
        tabIndex={isVirtual ? 0 : undefined}
        role={isVirtual ? "region" : undefined}
        aria-labelledby={isVirtual ? statusId : undefined}
      >
        <table className={cn("w-full", isVirtual && "table-fixed")} aria-rowcount={ariaRowCount}>
          {/* Fixed layout sizes columns from this colgroup instead of from the
              rows currently in the DOM, which is what stops a windowed table
              re-sizing its columns on every scroll. */}
          {isVirtual && (
            <colgroup>
              {enableRowSelection && <col className="w-12" />}
              {columns.map((column) => (
                <col key={column.key} className={column.width} />
              ))}
              {hasActions && <col className="w-12" />}
            </colgroup>
          )}
          <thead
            className={
              isVirtual
                ? "bg-muted sticky top-0 z-10 shadow-[inset_0_-1px_0_var(--chrome-border)]"
                : undefined
            }
          >
            <tr
              className="border-chrome-border bg-muted border-b"
              aria-rowindex={ariaRowCount === undefined ? undefined : 1}
            >
              {enableRowSelection && (
                <th className="w-12 px-4 py-3">
                  <Checkbox
                    checked={allPageSelected ? true : somePageSelected ? "indeterminate" : false}
                    onCheckedChange={handleSelectAll}
                    disabled={headerSelectDisabled}
                    aria-label={
                      isVirtual
                        ? allPageSelected
                          ? "Deselect all loaded rows"
                          : "Select all loaded rows"
                        : allPageSelected
                          ? "Deselect all on this page"
                          : "Select all on this page"
                    }
                    className="block"
                  />
                </th>
              )}
              {columns.map((column) => {
                const sortKey = column.sortKey ?? column.key;
                const isSortable = !!(sortableSet?.has(sortKey) && onSortChange);
                const isActive = isSortable && sort?.column === sortKey;
                const ariaSort: React.ThHTMLAttributes<HTMLTableCellElement>["aria-sort"] =
                  isSortable
                    ? isActive
                      ? sort?.direction === "asc"
                        ? "ascending"
                        : "descending"
                      : "none"
                    : undefined;
                return (
                  <th
                    key={column.key}
                    aria-sort={ariaSort}
                    className={cn(
                      "text-chrome-muted-foreground px-4 py-0 text-left text-xs font-semibold tracking-[0.06em] uppercase",
                      column.width
                    )}
                  >
                    {isSortable ? (
                      <button
                        type="button"
                        onClick={() => onSortChange(cycleSort(sort, sortKey))}
                        // A <button> doesn't inherit text-transform from the th, so restate uppercase here or
                        // sortable headers render in source casing next to the uppercase plain ones.
                        className="hover:text-foreground focus-visible:ring-ring inline-flex min-h-[44px] items-center gap-1.5 rounded uppercase focus-visible:ring-2 focus-visible:outline-none"
                      >
                        <span>{column.header}</span>
                        {isActive ? (
                          sort?.direction === "asc" ? (
                            <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
                          ) : (
                            <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
                          )
                        ) : (
                          <ArrowUpDown className="h-3.5 w-3.5 opacity-40" aria-hidden="true" />
                        )}
                      </button>
                    ) : (
                      <span className="inline-flex min-h-[44px] items-center">{column.header}</span>
                    )}
                  </th>
                );
              })}
              {hasActions && (
                <th className="w-12 px-4 py-3 text-right">
                  <span className="sr-only">Actions</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              // Loading skeleton rows
              Array.from({ length: 5 }).map((_, rowIndex) => (
                <tr
                  key={`skeleton-${rowIndex}`}
                  className={cn(
                    "border-border border-b last:border-0",
                    rowIndex % 2 === 1 && "bg-muted/40"
                  )}
                >
                  {enableRowSelection && (
                    <td className="w-12 px-4 py-3">
                      <Skeleton className="h-4 w-4" />
                    </td>
                  )}
                  {columns.map((column) => (
                    <td key={column.key} className={cn("px-4 py-3", column.width)}>
                      <Skeleton className="h-5 w-24" />
                    </td>
                  ))}
                  {hasActions && (
                    <td className="px-4 py-3 text-right">
                      <Skeleton className="ml-auto h-8 w-8" />
                    </td>
                  )}
                </tr>
              ))
            ) : data.length === 0 ? (
              <tr>
                <td
                  colSpan={totalColCount}
                  className="text-muted-foreground px-4 py-8 text-center text-sm"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : windowed ? (
              renderWindowedRows()
            ) : (
              data.map((item, index) => renderRow(item, index))
            )}
          </tbody>
        </table>
      </div>

      {/* Rows also load on scroll; this is what makes the rest of the catalog
          reachable without a mouse. */}
      {isVirtual && hasMore && (
        <div className="border-border flex justify-center border-t px-4 py-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => virtualization.onLoadMore?.()}
            disabled={loadingMore}
            className="bg-muted hover:bg-muted/70 min-h-[44px]"
          >
            {loadingMore ? "Loading more…" : "Load more"}
          </Button>
        </div>
      )}

      {/* Pagination */}
      {pagination && (totalPages > 1 || showPageSizeSelector) && (
        <nav
          aria-label="Pagination"
          className="border-border flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3"
        >
          <div className="flex flex-wrap items-center gap-4">
            <p className="text-muted-foreground text-sm tabular-nums">
              Showing {Math.min((pagination.page - 1) * pagination.pageSize + 1, pagination.total)}{" "}
              to {Math.min(pagination.page * pagination.pageSize, pagination.total)} of{" "}
              {pagination.total.toLocaleString()}
              {pagination.totalIsLowerBound ? "+" : ""} results
            </p>
            {showPageSizeSelector && pagination.onPageSizeChange && (
              <PageSizeSelect
                value={pagination.pageSize}
                options={pageSizeOptions}
                onChange={pagination.onPageSizeChange}
              />
            )}
          </div>
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon-sm"
                onClick={() => pagination.onPageChange(pagination.page - 1)}
                disabled={pagination.page <= 1}
                aria-label="Previous page"
                className="h-8 w-8"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              </Button>
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum: number;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (pagination.page <= 3) {
                    pageNum = i + 1;
                  } else if (pagination.page >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = pagination.page - 2 + i;
                  }
                  const isActive = pageNum === pagination.page;
                  return (
                    <Button
                      key={pageNum}
                      variant={isActive ? "primary-gradient" : "ghost"}
                      size="icon-sm"
                      onClick={() => pagination.onPageChange(pageNum)}
                      aria-label={`Page ${pageNum}`}
                      aria-current={isActive ? "page" : undefined}
                      className="h-8 w-8"
                    >
                      {pageNum}
                    </Button>
                  );
                })}
              </div>
              <Button
                variant="outline"
                size="icon-sm"
                onClick={() => pagination.onPageChange(pagination.page + 1)}
                disabled={pagination.page >= totalPages}
                aria-label="Next page"
                className="h-8 w-8"
              >
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          )}
        </nav>
      )}
    </div>
  );
}

interface PageSizeSelectProps {
  value: number;
  options: readonly number[];
  onChange: (pageSize: number) => void;
}

function PageSizeSelect({ value, options, onChange }: PageSizeSelectProps) {
  const id = React.useId();
  // Keep a size that came from the URL selectable even when it isn't a preset.
  const choices = options.includes(value) ? options : [...options, value].sort((a, b) => a - b);
  return (
    <div className="flex items-center gap-2">
      <label htmlFor={id} className="text-muted-foreground text-sm">
        Rows per page
      </label>
      <Select value={String(value)} onValueChange={(next) => onChange(Number(next))}>
        <SelectTrigger id={id} className="h-8 w-[76px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {choices.map((option) => (
            <SelectItem key={option} value={String(option)}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/**
 * Helper component for rendering member cells with avatar.
 */
export interface MemberCellProps {
  name: string;
  email: string;
  avatar?: string;
}

export function MemberCell({ name, email, avatar }: MemberCellProps) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="flex items-center gap-3">
      <div className="bg-primary text-primary-foreground flex h-9 w-9 items-center justify-center overflow-hidden rounded-full text-sm font-medium">
        {avatar ? <img src={avatar} alt={name} className="h-full w-full object-cover" /> : initials}
      </div>
      <div>
        <p className="text-foreground text-sm font-medium">{name}</p>
        <p className="text-muted-foreground text-xs">{email}</p>
      </div>
    </div>
  );
}
