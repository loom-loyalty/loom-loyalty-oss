/**
 * useHub Hook
 * Access the Hub context
 */

import * as React from "react";
import { HubContext, type HubContextValue } from "../providers/hub-context";

/**
 * Hook to access the Hub context
 *
 * @public
 * @throws Error if used outside of HubProvider
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { config, executeHook, isInitialized } = useHub();
 *
 *   if (!isInitialized) return <Loading />;
 *
 *   return <div>API: {config.api?.endpoint}</div>;
 * }
 * ```
 */
export function useHub(): HubContextValue {
  const context = React.useContext(HubContext);

  if (!context) {
    throw new Error("useHub must be used within a HubProvider");
  }

  return context;
}
