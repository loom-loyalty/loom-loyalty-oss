/**
 * Entity Types
 * Core entity and pagination types for the Hub framework
 */

/**
 * Paginated response wrapper
 */
export interface Page<T> {
  /** Array of items in the current page */
  content: T[];
  /** Total number of pages */
  totalPages: number;
  /** Total number of items */
  totalElements: number;
  /** Current page number (0-indexed) */
  pageNumber: number;
  /** Number of items per page */
  pageSize: number;
  /** Whether this is the first page */
  first: boolean;
  /** Whether this is the last page */
  last: boolean;
  /** Whether the page has content */
  hasContent: boolean;
  /** Number of items in current page */
  numberOfElements: number;
}

/**
 * Query options for fetching entities
 */
export interface QueryOptions<TFilter = Record<string, unknown>> {
  /** Filter criteria for the query */
  filters?: TFilter;
  /** Pagination options */
  pagination?: {
    page?: number;
    pageSize?: number;
  };
  /** Sort options */
  sort?: {
    field: string;
    order: "asc" | "desc";
  };
  /** Additional inclusion parameters */
  include?: string[];
}

/**
 * Mutation options for creating/updating entities
 */
export interface MutationOptions {
  /** Optimistic update data */
  optimisticData?: unknown;
  /** Callback on success */
  onSuccess?: (data: unknown) => void;
  /** Callback on error */
  onError?: (error: Error) => void;
}
