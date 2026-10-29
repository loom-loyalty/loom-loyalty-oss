/**
 * useEntity Hook
 * Fetch a single entity by ID
 */

import { useQuery, type UseQueryOptions, type UseQueryResult } from "@tanstack/react-query";
import type { QueryOptions } from "../types/entity";
import { useDataProvider } from "./use-data-provider";
import { useHub } from "./use-hub";

export interface UseEntityOptions<TEntity> extends Omit<
  UseQueryOptions<TEntity, Error>,
  "queryKey" | "queryFn"
> {
  /** Additional query options for the data provider */
  providerOptions?: QueryOptions;
}

/**
 * Hook to fetch a single entity by ID
 *
 * @public
 * @param entityType - The entity type (e.g., 'customer', 'program')
 * @param id - Entity ID
 * @param options - Additional options
 *
 * @example
 * ```tsx
 * function CustomerDetail({ customerId }: { customerId: string }) {
 *   const { data: customer, isLoading, error } = useEntity('customer', customerId);
 *
 *   if (isLoading) return <Loading />;
 *   if (error) return <Error message={error.message} />;
 *
 *   return <div>{customer.name}</div>;
 * }
 * ```
 */
export function useEntity<TEntity>(
  entityType: string,
  id: string | undefined,
  options?: UseEntityOptions<TEntity>
): UseQueryResult<TEntity, Error> {
  const dataProvider = useDataProvider();
  const { executeHook } = useHub();
  const { providerOptions, ...queryOptions } = options ?? {};

  return useQuery<TEntity, Error>({
    queryKey: [entityType, "detail", id, providerOptions],
    queryFn: async () => {
      if (!id) throw new Error("Entity ID is required");

      // Execute onEntityFetch hook
      await executeHook("onEntityFetch", { entityType, entityId: id });

      const result = await dataProvider.getOne<TEntity>(entityType, id, providerOptions);

      // Execute onEntityFetched hook
      await executeHook("onEntityFetched", { entityType, entityId: id, data: result });

      return result;
    },
    enabled: !!id,
    staleTime: 1000 * 60 * 5, // 5 minutes default
    ...queryOptions,
  });
}
