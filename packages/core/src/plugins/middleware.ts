/**
 * Lifecycle Hook Middleware
 * Middleware chain for plugin lifecycle hooks
 */

import type {
  LifecycleContext,
  LifecycleHandler,
  LifecycleNext,
  PluginLifecycleHooks,
  ResolvedPlugin,
} from "../types/plugin";

/**
 * Compose multiple handlers into a middleware chain
 */
export function composeMiddleware(handlers: LifecycleHandler[]): LifecycleHandler {
  return async (context: LifecycleContext, finalNext: LifecycleNext) => {
    let index = -1;

    async function dispatch(i: number): Promise<void> {
      if (i <= index) {
        throw new Error("next() called multiple times");
      }
      index = i;

      const handler = handlers[i];

      if (!handler) {
        // End of chain, call final next
        return finalNext(context);
      }

      // Create next function for this handler
      const next: LifecycleNext = async (_ctx) => {
        return dispatch(i + 1);
      };

      return handler(context, next);
    }

    return dispatch(0);
  };
}

/**
 * Create a lifecycle hook executor from plugins
 */
export function createHookExecutor(
  plugins: ResolvedPlugin[]
): (hookName: keyof PluginLifecycleHooks, context: LifecycleContext) => Promise<void> {
  // Pre-build middleware chains for each hook type
  const hookChains = new Map<keyof PluginLifecycleHooks, LifecycleHandler>();

  const hookNames: (keyof PluginLifecycleHooks)[] = [
    "onEntitySave",
    "onEntitySaved",
    "onEntityDelete",
    "onEntityDeleted",
    "onEntityFetch",
    "onEntityFetched",
    "onError",
  ];

  for (const hookName of hookNames) {
    const handlers: LifecycleHandler[] = [];

    // Collect handlers from plugins in order
    for (const plugin of plugins) {
      const handler = plugin.hooks?.[hookName];
      if (handler) {
        handlers.push(handler);
      }
    }

    if (handlers.length > 0) {
      hookChains.set(hookName, composeMiddleware(handlers));
    }
  }

  // Return executor function
  return async (hookName: keyof PluginLifecycleHooks, context: LifecycleContext) => {
    const chain = hookChains.get(hookName);

    if (!chain) {
      // No handlers registered for this hook
      return;
    }

    // Execute the chain with a no-op final handler
    await chain(context, async () => {});
  };
}
