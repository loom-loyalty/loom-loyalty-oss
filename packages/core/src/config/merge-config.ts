/**
 * Config Merging Utilities
 * Deep merge configurations with plugin contributions
 */

import type { HubConfig, ResolvedHubConfig } from "../types/config";
import type { PluginConfigContribution, PluginDefinition } from "../types/plugin";

/**
 * Get config contribution from a plugin
 */
function getPluginConfigContribution(
  plugin: PluginDefinition,
  baseConfig: HubConfig
): PluginConfigContribution | undefined {
  if (!plugin.config) {
    return undefined;
  }

  if (typeof plugin.config === "function") {
    return plugin.config(baseConfig);
  }

  return plugin.config;
}

/**
 * Resolve and merge all plugin configurations
 *
 * @param config - Base Hub configuration
 * @returns Resolved configuration with all plugin contributions merged
 */
export async function resolveConfig(config: HubConfig): Promise<ResolvedHubConfig> {
  let resolvedConfig: HubConfig = { ...config };

  // Merge plugin config contributions
  if (config.plugins) {
    for (const plugin of config.plugins) {
      const contribution = getPluginConfigContribution(plugin, resolvedConfig);

      if (contribution) {
        // Merge entities
        if (contribution.entities) {
          resolvedConfig.entities = {
            ...resolvedConfig.entities,
            ...contribution.entities,
          } as typeof resolvedConfig.entities;
        }

        // Merge widgets
        if (contribution.widgets) {
          resolvedConfig.widgets = {
            ...resolvedConfig.widgets,
            ...(contribution.widgets as typeof resolvedConfig.widgets),
          };
        }

        // Merge components
        if (contribution.components) {
          resolvedConfig.components = {
            ...resolvedConfig.components,
            ...contribution.components,
          };
        }
      }
    }
  }

  return {
    ...resolvedConfig,
    __resolved: true,
  };
}
