/**
 * Hub Context
 * Central context for the Hub framework
 */

import * as React from "react";
import type { AuthProvider } from "../types/auth-provider";
import type { ResolvedHubConfig } from "../types/config";
import type { DataProvider } from "../types/data-provider";
import type { LifecycleContext, ResolvedPlugin } from "../types/plugin";
import type { RouterProvider } from "../types/router-provider";

/**
 * Hub context value
 * Provides access to all core functionality
 */
export interface HubContextValue {
  /** Resolved configuration */
  config: ResolvedHubConfig;
  /** Data provider instance */
  dataProvider: DataProvider;
  /** Auth provider instance */
  authProvider: AuthProvider;
  /** Router provider instance */
  routerProvider: RouterProvider;
  /** Loaded plugins */
  plugins: Map<string, ResolvedPlugin>;
  /** Execute lifecycle hooks */
  executeHook: (hookName: string, context: LifecycleContext) => Promise<void>;
  /** Get component for a slot */
  getSlotComponent: (
    slotId: string,
    context?: Record<string, unknown>
  ) => React.ComponentType<unknown> | null;
  /** Check if hub is initialized */
  isInitialized: boolean;
}

/**
 * Hub context - must be used within HubProvider
 */
export const HubContext = React.createContext<HubContextValue | null>(null);

HubContext.displayName = "HubContext";
