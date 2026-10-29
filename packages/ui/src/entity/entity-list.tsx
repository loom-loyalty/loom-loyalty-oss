/**
 * EntityList Component
 *
 * A schema-driven list/table component that renders entity data
 * based on a UI schema configuration. Composes the DataTable component
 * internally for consistent styling and behavior.
 */

import { formatDateTime, formatRelativeTime, formatShortDate } from "@loom-loyalty/core";
import type { UIEntitySchema, UIFieldConfig } from "@loom-loyalty/schema";
import { ArrowDown, ArrowUp, Plus, Search } from "lucide-react";
import { useCallback, useMemo, useState, type ReactNode } from "react";

import {
  DataTable,
  type Column,
  type DataTableAction,
  type PaginationConfig,
  type SortState,
} from "../data-display/data-table.js";
import { safeHref, safeMailto } from "../lib/safe-href.js";
import { cn } from "../lib/utils.js";
import { Badge } from "../primitives/badge.js";
import { Button } from "../primitives/button.js";
import { Input } from "../primitives/input.js";
import { formatLocalizedFieldValue } from "./format-utils.js";

/**
 * Entity data record type
 */
export type EntityRecord = Record<string, unknown>;

/** Column sort state — re-exported from data-table so /entity consumers don't need to cross modules. */
export type { SortState };

/**
 * Pagination state
 * Note: total is optional since it's often derived from API responses
 */
export interface PaginationState {
  page: number;
  pageSize: number;
  total?: number;
}

/**
 * Row action handler
 */
export interface RowAction {
  id: string;
  label: string;
  icon?: ReactNode;
  /** Returning a Promise is supported — EntityList does not await it. */
  onClick: (record: EntityRecord) => void | Promise<void>;
  destructive?: boolean;
}

/**
 * EntityList props
 */
interface EntityListBaseProps {
  /** UI schema for the entity */
  schema: UIEntitySchema;
  /** Entity data records */
  data: EntityRecord[];
  /** Loading state */
  isLoading?: boolean;
  /** Sort state */
  sort?: SortState;
  /** Sort change handler — receives `null` when the column cycles back to unsorted. */
  onSortChange?: (sort: SortState | null) => void;
  /** Pagination state */
  pagination?: PaginationState;
  /** Pagination change handler */
  onPaginationChange?: (pagination: PaginationState) => void;
  /** Search query */
  searchQuery?: string;
  /** Search change handler */
  onSearchChange?: (query: string) => void;
  /** Row actions */
  rowActions?: RowAction[];
  /** Create button click handler */
  onCreateClick?: () => void;
  /** Custom cell renderer */
  renderCell?: (field: UIFieldConfig, value: unknown, record: EntityRecord) => ReactNode;
  /** Custom empty state */
  emptyState?: ReactNode;
  /** Slot rendered in the header action row, to the LEFT of the Create button (e.g. saved-views menu). */
  trailing?: ReactNode;
  /** Additional class name */
  className?: string;
}

// Mirrors DataTable: getRowLabel is required iff onRowClick is set, so every
// keyboard-focusable row gets an accessible name (WCAG 4.1.2).
type EntityRowActivation =
  | { onRowClick?: undefined; getRowLabel?: never }
  | {
      /** Row click handler */
      onRowClick: (record: EntityRecord) => void;
      /** Accessible name describing what activating the row does. */
      getRowLabel: (record: EntityRecord) => string;
    };

export type EntityListProps = EntityListBaseProps & EntityRowActivation;

/**
 * Format a cell value for display
 */
function formatCellValue(field: UIFieldConfig, value: unknown): ReactNode {
  if (value === null || value === undefined) {
    return <span className="text-muted-foreground">—</span>;
  }

  const localized = formatLocalizedFieldValue(field, value);
  if (localized !== null) return localized;

  switch (field.displayFormat) {
    case "boolean":
      return <Badge variant={value ? "default" : "secondary"}>{value ? "Yes" : "No"}</Badge>;

    case "badge":
    case "status":
      return (
        <Badge variant="outline" className="capitalize">
          {String(value).replace(/[-_]/g, " ")}
        </Badge>
      );

    case "date":
      return formatShortDate(String(value));

    case "datetime":
      return formatDateTime(String(value));

    case "relative-time":
      return formatRelativeTime(String(value));

    case "currency":
      return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: "USD",
      }).format(Number(value));

    case "percentage":
      return `${Number(value).toFixed(1)}%`;

    case "number":
      return new Intl.NumberFormat().format(Number(value));

    case "email": {
      const href = safeMailto(value);
      return href ? (
        <a
          href={href}
          className="text-primary hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {String(value)}
        </a>
      ) : (
        <span>{String(value)}</span>
      );
    }

    case "link": {
      const href = safeHref(value);
      return href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {String(value)}
        </a>
      ) : (
        <span>{String(value)}</span>
      );
    }

    case "tags":
      if (Array.isArray(value)) {
        return (
          <div className="flex flex-wrap gap-1">
            {value.slice(0, 3).map((tag, i) => (
              <Badge key={i} variant="secondary" className="text-xs">
                {String(tag)}
              </Badge>
            ))}
            {value.length > 3 && (
              <Badge variant="secondary" className="text-xs">
                +{value.length - 3}
              </Badge>
            )}
          </div>
        );
      }
      return String(value);

    case "reference":
      // For references, display the value directly (assuming it's the display text)
      return String(value);

    case "json":
      return (
        <code className="bg-muted rounded px-1.5 py-0.5 text-xs">
          {JSON.stringify(value).slice(0, 50)}...
        </code>
      );

    default:
      return String(value);
  }
}

/**
 * Get column width class based on field configuration
 */
function getColumnWidth(width?: string): string | undefined {
  switch (width) {
    case "sm":
      return "w-24";
    case "md":
      return "w-40";
    case "lg":
      return "w-60";
    case "xl":
      return "w-80";
    default:
      return undefined;
  }
}

/**
 * EntityList component
 *
 * Composes DataTable internally for consistent styling with the Loom design system.
 * Provides schema-driven column generation, sorting, search, and row actions.
 */
export function EntityList({
  schema,
  data,
  isLoading = false,
  sort,
  onSortChange,
  pagination,
  onPaginationChange,
  searchQuery = "",
  onSearchChange,
  onRowClick,
  getRowLabel,
  rowActions,
  onCreateClick,
  renderCell,
  emptyState,
  trailing,
  className,
}: EntityListProps): ReactNode {
  const [localSearch, setLocalSearch] = useState(searchQuery);

  const schemaColumns = schema.list.columns;

  // Handle search submit
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearchChange?.(localSearch);
  };

  // Handle sort click on column header — 3-state cycle (asc → desc → unsorted), matches DataTable.
  const handleSortClick = useCallback(
    (columnName: string) => {
      if (!onSortChange) return;

      const field = schema.fields[columnName];
      if (!field?.sortable) return;

      if (sort?.column !== columnName) {
        onSortChange({ column: columnName, direction: "asc" });
      } else if (sort.direction === "asc") {
        onSortChange({ column: columnName, direction: "desc" });
      } else {
        onSortChange(null);
      }
    },
    [onSortChange, schema.fields, sort]
  );

  // Transform schema columns to DataTable columns using flatMap for cleaner filtering
  // Memoized to prevent unnecessary re-renders of the DataTable
  const columns: Column<EntityRecord>[] = useMemo(
    () =>
      schemaColumns.flatMap((columnName: string) => {
        const field = schema.fields[columnName];
        if (!field) return [];

        const isSortable = field.sortable && onSortChange;
        const isSorted = sort?.column === columnName;

        return [
          {
            key: columnName,
            header: (
              <div
                className={cn(
                  "flex items-center gap-2",
                  isSortable && "hover:text-foreground cursor-pointer"
                )}
                onClick={() => isSortable && handleSortClick(columnName)}
              >
                {field.label}
                {isSortable &&
                  isSorted &&
                  sort &&
                  (sort.direction === "asc" ? (
                    <ArrowUp className="h-4 w-4" />
                  ) : (
                    <ArrowDown className="h-4 w-4" />
                  ))}
              </div>
            ),
            render: (item: EntityRecord) => {
              const value = item[columnName];
              if (renderCell) {
                return renderCell(field, value, item);
              }
              return formatCellValue(field, value);
            },
            width: getColumnWidth(field.columnWidth),
          } as Column<EntityRecord>,
        ];
      }),
    [schemaColumns, schema.fields, sort, onSortChange, renderCell, handleSortClick]
  );

  // Transform row actions to DataTable actions
  const tableActions: DataTableAction[] | undefined = rowActions?.map((action) => ({
    label: action.label,
    onClick: (item: unknown) => action.onClick(item as EntityRecord),
    destructive: action.destructive,
  }));

  // Transform pagination to DataTable pagination config
  const tablePagination: PaginationConfig | undefined =
    pagination && onPaginationChange
      ? {
          page: pagination.page,
          pageSize: pagination.pageSize,
          total: pagination.total ?? 0,
          onPageChange: (page: number) => onPaginationChange({ ...pagination, page }),
        }
      : undefined;

  // Custom empty state component
  const defaultEmptyContent = (
    <div className="text-muted-foreground">
      <p>No {schema.pluralName.toLowerCase()} found</p>
      {schema.canCreate && onCreateClick && (
        <Button variant="link" onClick={onCreateClick} className="mt-2">
          Create your first {schema.singularName.toLowerCase()}
        </Button>
      )}
    </div>
  );

  // onRowClick + getRowLabel are a correlated pair (required together). Destructuring
  // splits them into independent locals, so rebuild the pair into one object that
  // satisfies DataTable's discriminated row-activation props.
  const rowActivation: EntityRowActivation = onRowClick ? { onRowClick, getRowLabel } : {};

  return (
    <div className={cn("space-y-4", className)}>
      {/* Header with search and create button */}
      <div className="flex items-center justify-between gap-4">
        {/* Search */}
        {schema.list.searchable && onSearchChange && (
          <form onSubmit={handleSearchSubmit} className="max-w-sm flex-1">
            <div className="relative">
              <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
              <Input
                type="search"
                placeholder={`Search ${schema.pluralName.toLowerCase()}...`}
                value={localSearch}
                onChange={(e) => setLocalSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </form>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2">
          {trailing}
          {schema.canCreate && onCreateClick && (
            <Button variant="primary-gradient" onClick={onCreateClick}>
              <Plus className="mr-2 h-4 w-4" />
              Add {schema.singularName}
            </Button>
          )}
        </div>
      </div>

      {/* DataTable */}
      <DataTable
        columns={columns}
        data={data}
        getRowKey={(item, index) => String(item.id ?? index)}
        actions={tableActions}
        pagination={tablePagination}
        loading={isLoading}
        emptyMessage={
          emptyState ? (
            <div className="py-4">{emptyState}</div>
          ) : (
            <div className="py-4">{defaultEmptyContent}</div>
          )
        }
        {...rowActivation}
      />
    </div>
  );
}
