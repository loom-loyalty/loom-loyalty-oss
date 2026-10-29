/**
 * defineConfig Helpers
 * Type-safe configuration helpers with validation
 */

import type { HubConfig } from "../types/config";
import type { HubLocalConfig } from "../types/runtime-config";

/**
 * Validate configuration at runtime
 */
function validateConfig(config: HubConfig): void {
  // Check for duplicate plugin names
  if (config.plugins) {
    const names = new Set<string>();
    for (const plugin of config.plugins) {
      if (names.has(plugin.name)) {
        throw new Error(`Duplicate plugin name: ${plugin.name}`);
      }
      names.add(plugin.name);
    }
  }

  // Validate API endpoint if provided
  if (config.api?.endpoint) {
    try {
      new URL(config.api.endpoint);
    } catch {
      throw new Error(`Invalid API endpoint URL: ${config.api.endpoint}`);
    }
  }
}

/**
 * Type-safe configuration helper
 *
 * @public
 * @param config - Hub configuration object
 * @returns The same configuration with full type inference
 *
 * @example
 * ```typescript
 * // hub.config.ts
 * import { defineConfig } from '@loom-loyalty/core';
 *
 * export default defineConfig({
 *   api: {
 *     endpoint: process.env.WEAVE_API_URL!,
 *   },
 *   auth: {
 *     provider: 'workos',
 *     clientId: process.env.WORKOS_CLIENT_ID,
 *   },
 *   entities: {
 *     customer: {
 *       label: { singular: 'Customer', plural: 'Customers' },
 *       ui: {
 *         list: {
 *           columns: ['name', 'email', 'tier'],
 *         },
 *       },
 *     },
 *   },
 * });
 * ```
 */
export function defineConfig<T extends HubConfig>(config: T): T {
  validateConfig(config);
  return config;
}

/**
 * Validate local configuration at runtime
 */
function validateLocalConfig(config: HubLocalConfig): void {
  // Validate custom components manifest URL if provided
  if (config.customComponents?.manifestUrl) {
    try {
      new URL(config.customComponents.manifestUrl);
    } catch {
      throw new Error(
        `Invalid custom components manifest URL: ${config.customComponents.manifestUrl}`
      );
    }
  }

  // Validate theme colors are valid hex if provided
  if (config.theme?.primaryColor && !/^#[0-9A-Fa-f]{6}$/.test(config.theme.primaryColor)) {
    throw new Error(
      `Invalid primary color format: ${config.theme.primaryColor}. Use hex format (#RRGGBB)`
    );
  }
  if (config.theme?.secondaryColor && !/^#[0-9A-Fa-f]{6}$/.test(config.theme.secondaryColor)) {
    throw new Error(
      `Invalid secondary color format: ${config.theme.secondaryColor}. Use hex format (#RRGGBB)`
    );
  }
}

/**
 * Type-safe local configuration helper for Hub runtime config
 *
 * Use this in your hub.config.ts file to define Hub-specific settings.
 * Organization identity, API config, branding, and features are fetched
 * from the backend and merged when you run `treadle config push`.
 *
 * @public
 * @param config - Local Hub configuration object
 * @returns The same configuration with full type inference
 *
 * @example
 * ```typescript
 * // hub.config.ts
 * import { defineLocalConfig } from '@loom-loyalty/core';
 *
 * export default defineLocalConfig({
 *   uiSettings: {
 *     showApiExplorer: true,
 *     defaultListView: 'table',
 *   },
 *   entityOverrides: {
 *     customer: {
 *       label: { singular: 'Member', plural: 'Members' },
 *     },
 *     internal_audit: {
 *       hidden: true,
 *     },
 *   },
 *   theme: {
 *     primaryColor: '#6366f1',
 *   },
 * });
 * ```
 */
export function defineLocalConfig<T extends HubLocalConfig>(config: T): T {
  validateLocalConfig(config);
  return config;
}
