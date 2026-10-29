/**
 * DataProvider Interface
 * Abstracts CRUD operations for entity management
 */

import type { MutationOptions, Page, QueryOptions } from "./entity";

/**
 * DataProvider interface - abstracts CRUD operations
 *
 * @public
 * @remarks
 * Implementations can wrap any data source: REST APIs, GraphQL,
 * local storage, or mock data. The default implementation uses
 * @loom-loyalty/sdk.
 *
 * @example
 * ```typescript
 * const myDataProvider: DataProvider = {
 *   getOne: async (entityType, id) => {
 *     const response = await fetch(`/api/${entityType}/${id}`);
 *     return response.json();
 *   },
 *   // ... other methods
 * };
 * ```
 */
export interface DataProvider {
  /**
   * Fetch a single entity by ID
   * @param entityType - The type of entity (e.g., 'customer', 'program')
   * @param id - The entity ID
   * @param options - Optional query options
   */
  getOne<TEntity>(entityType: string, id: string, options?: QueryOptions): Promise<TEntity>;

  /**
   * Fetch a list of entities with optional filtering, pagination, and sorting
   * @param entityType - The type of entity
   * @param options - Query options including filters, pagination, sort
   */
  getList<TEntity, TFilter = Record<string, unknown>>(
    entityType: string,
    options?: QueryOptions<TFilter>
  ): Promise<Page<TEntity>>;

  /**
   * Fetch many entities by their IDs
   * @param entityType - The type of entity
   * @param ids - Array of entity IDs
   * @param options - Optional query options
   */
  getMany<TEntity>(entityType: string, ids: string[], options?: QueryOptions): Promise<TEntity[]>;

  /**
   * Create a new entity
   * @param entityType - The type of entity
   * @param data - The entity data to create
   * @param options - Optional mutation options
   */
  create<TEntity, TInput = Partial<TEntity>>(
    entityType: string,
    data: TInput,
    options?: MutationOptions
  ): Promise<TEntity>;

  /**
   * Update an existing entity
   * @param entityType - The type of entity
   * @param id - The entity ID
   * @param data - The partial entity data to update
   * @param options - Optional mutation options
   */
  update<TEntity, TInput = Partial<TEntity>>(
    entityType: string,
    id: string,
    data: TInput,
    options?: MutationOptions
  ): Promise<TEntity>;

  /**
   * Delete an entity
   * @param entityType - The type of entity
   * @param id - The entity ID
   * @param options - Optional mutation options
   */
  delete(entityType: string, id: string, options?: MutationOptions): Promise<void>;

  /**
   * Delete multiple entities
   * @param entityType - The type of entity
   * @param ids - Array of entity IDs to delete
   * @param options - Optional mutation options
   */
  deleteMany(entityType: string, ids: string[], options?: MutationOptions): Promise<void>;
}
