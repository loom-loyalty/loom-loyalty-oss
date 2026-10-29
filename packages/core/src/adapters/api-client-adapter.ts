/**
 * API Client Adapter
 * Default DataProvider implementation using @loom-loyalty/sdk
 *
 * This adapter provides a bridge between the abstract DataProvider interface
 * and the concrete API client implementation.
 */

import type { DataProvider } from "../types/data-provider";
import type { MutationOptions, Page, QueryOptions } from "../types/entity";

/**
 * API module interface that the adapter expects
 */
interface ApiModule<TEntity, TCreateInput = Partial<TEntity>, TUpdateInput = Partial<TEntity>> {
  getAll: (
    token: string,
    options?: QueryOptions
  ) => Promise<{ success: boolean; data?: Page<TEntity> | TEntity[]; error?: { message: string } }>;
  getById: (
    id: string,
    token: string,
    options?: QueryOptions
  ) => Promise<{ success: boolean; data?: TEntity; error?: { message: string } }>;
  create: (
    data: TCreateInput,
    token: string
  ) => Promise<{ success: boolean; data?: TEntity; error?: { message: string } }>;
  update: (
    id: string,
    data: TUpdateInput,
    token: string
  ) => Promise<{ success: boolean; data?: TEntity; error?: { message: string } }>;
  delete: (id: string, token: string) => Promise<{ success: boolean; error?: { message: string } }>;
}

/**
 * Configuration for the API client adapter
 */
export interface ApiClientAdapterConfig {
  /** Function to get the current access token */
  getAccessToken: () => Promise<string>;
  /** Map of entity types to their API modules */
  modules: Record<string, ApiModule<unknown>>;
}

/**
 * Create a DataProvider from @loom-loyalty/sdk modules
 *
 * @param config - Adapter configuration
 * @returns DataProvider implementation
 *
 * @example
 * ```typescript
 * import { createApiClientAdapter } from '@loom-loyalty/core';
 * import { customersApi, programsApi } from '@loom-loyalty/sdk';
 *
 * const dataProvider = createApiClientAdapter({
 *   getAccessToken: async () => authProvider.getAccessToken(),
 *   modules: {
 *     customer: customersApi,
 *     program: programsApi,
 *   },
 * });
 * ```
 */
export function createApiClientAdapter(config: ApiClientAdapterConfig): DataProvider {
  const { getAccessToken, modules } = config;

  function getModule(entityType: string): ApiModule<unknown> {
    const module = modules[entityType];
    if (!module) {
      throw new Error(`No API module registered for entity type: ${entityType}`);
    }
    return module;
  }

  return {
    async getOne<TEntity>(
      entityType: string,
      id: string,
      options?: QueryOptions
    ): Promise<TEntity> {
      const module = getModule(entityType) as ApiModule<TEntity>;
      const token = await getAccessToken();
      const response = await module.getById(id, token, options);

      if (!response.success || !response.data) {
        throw new Error(response.error?.message || `Failed to fetch ${entityType}`);
      }

      return response.data;
    },

    async getList<TEntity, TFilter = Record<string, unknown>>(
      entityType: string,
      options?: QueryOptions<TFilter>
    ): Promise<Page<TEntity>> {
      const module = getModule(entityType) as ApiModule<TEntity>;
      const token = await getAccessToken();
      const response = await module.getAll(token, options as QueryOptions);

      if (!response.success) {
        throw new Error(response.error?.message || `Failed to fetch ${entityType} list`);
      }

      // Handle both paginated and array responses
      const data = response.data;
      if (!data) {
        return {
          content: [],
          totalPages: 0,
          totalElements: 0,
          pageNumber: 0,
          pageSize: 0,
          first: true,
          last: true,
          hasContent: false,
          numberOfElements: 0,
        };
      }

      if (Array.isArray(data)) {
        return {
          content: data,
          totalPages: 1,
          totalElements: data.length,
          pageNumber: 0,
          pageSize: data.length,
          first: true,
          last: true,
          hasContent: data.length > 0,
          numberOfElements: data.length,
        };
      }

      return data as Page<TEntity>;
    },

    async getMany<TEntity>(
      entityType: string,
      ids: string[],
      options?: QueryOptions
    ): Promise<TEntity[]> {
      const module = getModule(entityType) as ApiModule<TEntity>;
      const token = await getAccessToken();

      // Fetch all in parallel
      const results = await Promise.all(
        ids.map(async (id) => {
          const response = await module.getById(id, token, options);
          if (!response.success || !response.data) {
            return null;
          }
          return response.data;
        })
      );

      return results.filter((r): r is NonNullable<typeof r> => r !== null) as TEntity[];
    },

    async create<TEntity, TInput>(
      entityType: string,
      data: TInput,
      _options?: MutationOptions
    ): Promise<TEntity> {
      const module = getModule(entityType) as ApiModule<TEntity, TInput>;
      const token = await getAccessToken();
      const response = await module.create(data, token);

      if (!response.success || !response.data) {
        throw new Error(response.error?.message || `Failed to create ${entityType}`);
      }

      return response.data;
    },

    async update<TEntity, TInput>(
      entityType: string,
      id: string,
      data: TInput,
      _options?: MutationOptions
    ): Promise<TEntity> {
      const module = getModule(entityType) as ApiModule<TEntity, unknown, TInput>;
      const token = await getAccessToken();
      const response = await module.update(id, data, token);

      if (!response.success || !response.data) {
        throw new Error(response.error?.message || `Failed to update ${entityType}`);
      }

      return response.data;
    },

    async delete(entityType: string, id: string, _options?: MutationOptions): Promise<void> {
      const module = getModule(entityType);
      const token = await getAccessToken();
      const response = await module.delete(id, token);

      if (!response.success) {
        throw new Error(response.error?.message || `Failed to delete ${entityType}`);
      }
    },

    async deleteMany(entityType: string, ids: string[], _options?: MutationOptions): Promise<void> {
      const module = getModule(entityType);
      const token = await getAccessToken();

      // Delete all in parallel
      await Promise.all(
        ids.map(async (id) => {
          const response = await module.delete(id, token);
          if (!response.success) {
            console.error(`Failed to delete ${entityType} ${id}:`, response.error?.message);
          }
        })
      );
    },
  };
}
