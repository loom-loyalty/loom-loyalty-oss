/**
 * useRouterProvider Hook
 * Access the RouterProvider
 */

import * as React from "react";
import { RouterProviderContext } from "../providers/router-context";
import type { RouterProvider } from "../types/router-provider";

/**
 * Hook to access the RouterProvider
 *
 * @public
 * @throws Error if used outside of HubProvider
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const router = useRouterProvider();
 *
 *   const handleClick = () => {
 *     router.navigateToEntity('customer', customerId);
 *   };
 * }
 * ```
 */
export function useRouterProvider(): RouterProvider {
  const context = React.useContext(RouterProviderContext);

  if (!context) {
    throw new Error("useRouterProvider must be used within a HubProvider");
  }

  return context;
}
