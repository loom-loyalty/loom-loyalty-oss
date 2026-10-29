/**
 * definePlugin Helper
 * Type-safe plugin definition helpers
 */

import type { PluginDefinition, PluginFactory } from "../types/plugin";

/**
 * Validate plugin at runtime
 */
function validatePlugin(plugin: PluginDefinition): void {
  if (!plugin.name) {
    throw new Error("Plugin must have a name");
  }
  if (!plugin.version) {
    throw new Error("Plugin must have a version");
  }

  // Validate version is semver-like
  if (!/^\d+\.\d+\.\d+/.test(plugin.version)) {
    console.warn(`Plugin "${plugin.name}" version "${plugin.version}" is not semver`);
  }

  // Check for circular dependencies (basic check)
  if (plugin.dependencies?.includes(plugin.name)) {
    throw new Error(`Plugin "${plugin.name}" cannot depend on itself`);
  }
}

/**
 * Type-safe plugin definition helper
 *
 * @public
 * @param plugin - Plugin definition object
 * @returns The same plugin with full type inference
 *
 * @example
 * ```typescript
 * // plugins/analytics.ts
 * import { definePlugin } from '@loom-loyalty/core';
 *
 * export const analyticsPlugin = definePlugin({
 *   name: 'analytics',
 *   version: '1.0.0',
 *
 *   hooks: {
 *     onEntitySave: async (context, next) => {
 *       trackEvent('entity_saved', { type: context.entityType });
 *       return next(context);
 *     },
 *   },
 * });
 * ```
 */
export function definePlugin<T extends PluginDefinition>(plugin: T): T {
  validatePlugin(plugin);
  return plugin;
}

/**
 * Create a configurable plugin factory
 *
 * @public
 * @param factory - Function that returns a plugin definition
 * @returns Plugin factory function
 *
 * @example
 * ```typescript
 * interface AuditPluginOptions {
 *   retentionDays: number;
 * }
 *
 * export const auditPlugin = createPlugin<AuditPluginOptions>((options) => ({
 *   name: 'audit',
 *   version: '1.0.0',
 *
 *   setup: () => {
 *     console.log(`Audit retention: ${options.retentionDays} days`);
 *   },
 * }));
 *
 * // Usage:
 * auditPlugin({ retentionDays: 90 })
 * ```
 */
export function createPlugin<TOptions = void>(
  factory: TOptions extends void ? () => PluginDefinition : (options: TOptions) => PluginDefinition
): PluginFactory<TOptions> {
  return ((options?: TOptions) => {
    const plugin = (factory as (options?: TOptions) => PluginDefinition)(options);
    validatePlugin(plugin);
    return plugin;
  }) as PluginFactory<TOptions>;
}
