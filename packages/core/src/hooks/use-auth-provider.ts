/**
 * useAuthProvider Hook
 * Access the AuthProvider
 */

import * as React from "react";
import { AuthProviderContext } from "../providers/auth-context";
import type { AuthProvider } from "../types/auth-provider";

/**
 * Hook to access the AuthProvider
 *
 * @public
 * @throws Error if used outside of HubProvider
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const authProvider = useAuthProvider();
 *
 *   const user = authProvider.getUser();
 *   const isAuthenticated = authProvider.isAuthenticated();
 * }
 * ```
 */
export function useAuthProvider(): AuthProvider {
  const context = React.useContext(AuthProviderContext);

  if (!context) {
    throw new Error("useAuthProvider must be used within a HubProvider");
  }

  return context;
}
