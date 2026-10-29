/**
 * useDataProvider Hook
 * Access the DataProvider
 */

import * as React from "react";
import { DataProviderContext } from "../providers/data-context";
import type { DataProvider } from "../types/data-provider";

/**
 * Hook to access the DataProvider
 *
 * @public
 * @throws Error if used outside of HubProvider
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const dataProvider = useDataProvider();
 *
 *   const handleFetch = async () => {
 *     const customer = await dataProvider.getOne('customer', customerId);
 *   };
 * }
 * ```
 */
export function useDataProvider(): DataProvider {
  const context = React.useContext(DataProviderContext);

  if (!context) {
    throw new Error("useDataProvider must be used within a HubProvider");
  }

  return context;
}
