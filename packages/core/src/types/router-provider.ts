/**
 * RouterProvider Interface
 * Abstracts routing and navigation
 */

/**
 * Route definition for Hub
 */
export interface HubRoute {
  /** Route path pattern */
  path: string;
  /** Route name for navigation */
  name?: string;
  /** Route metadata */
  meta?: Record<string, unknown>;
}

/**
 * Navigation options
 */
export interface NavigateOptions {
  /** Replace current history entry instead of pushing */
  replace?: boolean;
  /** State to pass to the new route */
  state?: Record<string, unknown>;
}

/**
 * RouterProvider interface - abstracts routing
 *
 * @public
 * @remarks
 * The default implementation uses TanStack Router.
 * Allows integration with any router library.
 *
 * @example
 * ```typescript
 * const myRouterProvider: RouterProvider = {
 *   navigate: (path) => router.push(path),
 *   goBack: () => router.back(),
 *   // ... other methods
 * };
 * ```
 */
export interface RouterProvider {
  /**
   * Navigate to a path
   * @param path - Target path
   * @param options - Navigation options
   */
  navigate(path: string, options?: NavigateOptions): void;

  /**
   * Navigate to an entity detail page
   * @param entityType - The type of entity
   * @param id - Entity ID
   * @param options - Navigation options
   */
  navigateToEntity(entityType: string, id: string, options?: NavigateOptions): void;

  /**
   * Navigate to an entity list page
   * @param entityType - The type of entity
   * @param options - Navigation options
   */
  navigateToList(entityType: string, options?: NavigateOptions): void;

  /**
   * Navigate to entity create page
   * @param entityType - The type of entity
   * @param options - Navigation options
   */
  navigateToCreate(entityType: string, options?: NavigateOptions): void;

  /**
   * Navigate to entity edit page
   * @param entityType - The type of entity
   * @param id - Entity ID
   * @param options - Navigation options
   */
  navigateToEdit(entityType: string, id: string, options?: NavigateOptions): void;

  /**
   * Go back in history
   */
  goBack(): void;

  /**
   * Get current path
   */
  getCurrentPath(): string;

  /**
   * Get route parameters
   */
  getParams<T extends Record<string, string> = Record<string, string>>(): T;

  /**
   * Get query parameters
   */
  getQueryParams<T extends Record<string, string> = Record<string, string>>(): T;

  /**
   * Create a URL for a route without navigating
   * @param path - Path pattern
   * @param params - Route parameters
   */
  createUrl(path: string, params?: Record<string, string>): string;
}
