/**
 * useList Hook
 * Fetch a paginated list of entities
 */

import { useQuery, type UseQueryOptions, type UseQueryResult } from "@tanstack/react-query";
import type { Page } from "../types/entity";
import { useDataProvider } from "./use-data-provider";

export interface UseListOptions<TEntity, TFilter = Record<string, unknown>> extends Omit<
  UseQueryOptions<Page<TEntity>, Error>,
  "queryKey" | "queryFn"
> {
  /** Filter criteria */
  filters?: TFilter;
  /** Pagination options */
  pagination?: { page?: number; pageSize?: number };
  /** Sort options */
  sort?: { field: string; order: "asc" | "desc" };
  /** Inclusion options */
  include?: string[];
}

/**
 * Hook to fetch a paginated list of entities
 *
 * @public
 * @param entityType - The entity type
 * @param options - List options including filters, pagination, sort
 *
 * @example
 * ```tsx
 * function CustomerList() {
 *   const { data, isLoading } = useList('customer', {
 *     filters: { status: 'ACTIVE' },
 *     pagination: { page: 1, pageSize: 10 },
 *     sort: { field: 'createdAt', order: 'desc' },
 *   });
 *
 *   if (isLoading) return <Loading />;
 *
 *   return (
 *     <ul>
 *       {data?.content.map(customer => (
 *         <li key={customer.id}>{customer.name}</li>
 *       ))}
 *     </ul>
 *   );
 * }
 * ```
 */
export function useList<TEntity, TFilter = Record<string, unknown>>(
  entityType: string,
  options?: UseListOptions<TEntity, TFilter>
): UseQueryResult<Page<TEntity>, Error> {
  const dataProvider = useDataProvider();
  const { filters, pagination, sort, include, ...queryOptions } = options ?? {};

  const providerOptions = {
    filters,
    pagination,
    sort,
    include,
  };

  return useQuery<Page<TEntity>, Error>({
    queryKey: [entityType, "list", providerOptions],
    queryFn: async () => {
      return dataProvider.getList<TEntity, TFilter>(entityType, providerOptions);
    },
    staleTime: 1000 * 60 * 5, // 5 minutes default
    ...queryOptions,
  });
}
