/**
 * useEntityMutation Hook
 * Create, update, or delete entities
 */

import {
  useMutation,
  useQueryClient,
  type UseMutationOptions,
  type UseMutationResult,
} from "@tanstack/react-query";
import { useDataProvider } from "./use-data-provider";
import { useHub } from "./use-hub";

export type MutationType = "create" | "update" | "delete";

export interface UseEntityMutationOptions<TEntity, TInput> {
  /** Mutation type */
  type: MutationType;
  /** Entity type */
  entityType: string;
  /** Entity ID (required for update/delete) */
  id?: string;
  /** Additional TanStack Query mutation options */
  mutationOptions?: Omit<UseMutationOptions<TEntity | void, Error, TInput>, "mutationFn">;
}

/**
 * Hook for entity mutations (create, update, delete)
 *
 * @public
 * @example
 * ```tsx
 * // Create
 * const { mutate: createCustomer } = useEntityMutation({
 *   type: 'create',
 *   entityType: 'customer',
 * });
 *
 * // Update
 * const { mutate: updateCustomer } = useEntityMutation({
 *   type: 'update',
 *   entityType: 'customer',
 *   id: customerId,
 * });
 *
 * // Delete
 * const { mutate: deleteCustomer } = useEntityMutation({
 *   type: 'delete',
 *   entityType: 'customer',
 *   id: customerId,
 * });
 * ```
 */
export function useEntityMutation<TEntity, TInput = Partial<TEntity>>(
  options: UseEntityMutationOptions<TEntity, TInput>
): UseMutationResult<TEntity | void, Error, TInput> {
  const { type, entityType, id, mutationOptions } = options;
  const dataProvider = useDataProvider();
  const queryClient = useQueryClient();
  const { executeHook } = useHub();

  return useMutation<TEntity | void, Error, TInput>({
    mutationFn: async (data: TInput) => {
      let result: TEntity | void;

      switch (type) {
        case "create":
          // Execute before hooks
          await executeHook("onEntitySave", {
            entityType,
            data,
          });

          result = await dataProvider.create<TEntity, TInput>(entityType, data);

          // Execute after hooks
          await executeHook("onEntitySaved", {
            entityType,
            data: result,
          });
          break;

        case "update":
          if (!id) throw new Error("ID required for update");

          // Execute before hooks
          await executeHook("onEntitySave", {
            entityType,
            entityId: id,
            data,
          });

          result = await dataProvider.update<TEntity, TInput>(entityType, id, data);

          // Execute after hooks
          await executeHook("onEntitySaved", {
            entityType,
            entityId: id,
            data: result,
          });
          break;

        case "delete":
          if (!id) throw new Error("ID required for delete");

          await executeHook("onEntityDelete", { entityType, entityId: id });
          await dataProvider.delete(entityType, id);
          await executeHook("onEntityDeleted", { entityType, entityId: id });
          return;
      }

      return result;
    },
    onSuccess: () => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: [entityType, "list"] });
      if (id) {
        queryClient.invalidateQueries({ queryKey: [entityType, "detail", id] });
      }
    },
    onError: async (error) => {
      await executeHook("onError", {
        entityType,
        entityId: id,
        extra: { error },
      });
    },
    ...mutationOptions,
  });
}

/**
 * Convenience hook for creating entities
 */
export function useCreateEntity<TEntity, TInput = Partial<TEntity>>(
  entityType: string,
  options?: Omit<UseEntityMutationOptions<TEntity, TInput>, "type" | "entityType">
): UseMutationResult<TEntity | void, Error, TInput> {
  return useEntityMutation<TEntity, TInput>({
    type: "create",
    entityType,
    ...options,
  });
}

/**
 * Convenience hook for updating entities
 */
export function useUpdateEntity<TEntity, TInput = Partial<TEntity>>(
  entityType: string,
  id: string,
  options?: Omit<UseEntityMutationOptions<TEntity, TInput>, "type" | "entityType" | "id">
): UseMutationResult<TEntity | void, Error, TInput> {
  return useEntityMutation<TEntity, TInput>({
    type: "update",
    entityType,
    id,
    ...options,
  });
}

/**
 * Convenience hook for deleting entities
 */
export function useDeleteEntity(
  entityType: string,
  id: string,
  options?: Omit<UseEntityMutationOptions<void, void>, "type" | "entityType" | "id">
): UseMutationResult<void, Error, void> {
  return useEntityMutation<void, void>({
    type: "delete",
    entityType,
    id,
    ...options,
  });
}
