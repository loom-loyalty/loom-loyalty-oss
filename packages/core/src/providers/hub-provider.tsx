/**
 * HubProvider
 * Root context composing all providers
 */

import * as React from "react";
import { resolveConfig } from "../config/merge-config";
import { PluginRegistry } from "../plugins/registry";
import type { AuthProvider } from "../types/auth-provider";
import type { HubConfig, ResolvedHubConfig } from "../types/config";
import type { DataProvider } from "../types/data-provider";
import type { LifecycleContext } from "../types/plugin";
import type { RouterProvider } from "../types/router-provider";
import { AuthProviderContext } from "./auth-context";
import { DataProviderContext } from "./data-context";
import { HubContext, type HubContextValue } from "./hub-context";
import { RouterProviderContext } from "./router-context";

export interface HubProviderProps {
  /** Hub configuration */
  config: HubConfig;
  /** Custom data provider (optional - defaults to api-client adapter) */
  dataProvider: DataProvider;
  /** Custom auth provider (optional) */
  authProvider: AuthProvider;
  /** Custom router provider (optional) */
  routerProvider: RouterProvider;
  /** Loading component while initializing */
  loadingComponent?: React.ReactNode;
  /** Children to render */
  children: React.ReactNode;
}

/**
 * HubProvider - Root context composing all providers
 *
 * @public
 * @remarks
 * This is the main entry point for the Hub framework.
 * It composes DataProvider, AuthProvider, RouterProvider contexts
 * and manages the plugin lifecycle.
 *
 * @example
 * ```tsx
 * import { HubProvider } from '@loom-loyalty/core';
 * import config from './hub.config';
 *
 * function App() {
 *   return (
 *     <HubProvider
 *       config={config}
 *       dataProvider={myDataProvider}
 *       authProvider={myAuthProvider}
 *       routerProvider={myRouterProvider}
 *     >
 *       <YourApp />
 *     </HubProvider>
 *   );
 * }
 * ```
 */
export function HubProvider({
  config,
  dataProvider,
  authProvider,
  routerProvider,
  loadingComponent,
  children,
}: HubProviderProps): React.ReactElement {
  // State for initialization
  const [isInitialized, setIsInitialized] = React.useState(false);
  const [resolvedConfig, setResolvedConfig] = React.useState<ResolvedHubConfig | null>(null);

  // Plugin registry ref (persists across renders)
  const pluginRegistryRef = React.useRef<PluginRegistry | null>(null);

  // Initialize on mount
  React.useEffect(() => {
    let mounted = true;

    async function initialize() {
      try {
        // 1. Resolve configuration (merge plugin contributions)
        const resolved = await resolveConfig(config);

        if (!mounted) return;
        setResolvedConfig(resolved);

        // 2. Initialize plugin registry
        const registry = new PluginRegistry(resolved.plugins || []);
        await registry.initialize(resolved);
        pluginRegistryRef.current = registry;

        // 3. Mark as initialized
        if (mounted) {
          setIsInitialized(true);
        }
      } catch (error) {
        console.error("Failed to initialize HubProvider:", error);
        throw error;
      }
    }

    initialize();

    // Cleanup on unmount
    return () => {
      mounted = false;
      pluginRegistryRef.current?.teardown();
    };
  }, [config]);

  // Execute hook helper
  const executeHook = React.useCallback(
    async (hookName: string, context: LifecycleContext): Promise<void> => {
      if (!pluginRegistryRef.current) return;
      await pluginRegistryRef.current.executeHook(hookName, context);
    },
    []
  );

  // Get slot component helper
  const getSlotComponent = React.useCallback(
    (slotId: string, context?: Record<string, unknown>) => {
      if (!pluginRegistryRef.current) return null;
      return pluginRegistryRef.current.getSlotComponent(slotId, context);
    },
    []
  );

  // Context value
  const hubContextValue: HubContextValue = React.useMemo(
    () => ({
      config: resolvedConfig!,
      dataProvider,
      authProvider,
      routerProvider,
      plugins: pluginRegistryRef.current?.getPlugins() ?? new Map(),
      executeHook,
      getSlotComponent,
      isInitialized,
    }),
    [
      resolvedConfig,
      dataProvider,
      authProvider,
      routerProvider,
      executeHook,
      getSlotComponent,
      isInitialized,
    ]
  );

  // Don't render children until initialized
  if (!isInitialized || !resolvedConfig) {
    return <>{loadingComponent ?? null}</>;
  }

  return (
    <HubContext.Provider value={hubContextValue}>
      <DataProviderContext.Provider value={dataProvider}>
        <AuthProviderContext.Provider value={authProvider}>
          <RouterProviderContext.Provider value={routerProvider}>
            {children}
          </RouterProviderContext.Provider>
        </AuthProviderContext.Provider>
      </DataProviderContext.Provider>
    </HubContext.Provider>
  );
}
