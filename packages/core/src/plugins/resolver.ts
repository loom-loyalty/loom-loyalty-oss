/**
 * Plugin Dependency Resolver
 * Resolves plugin order based on dependencies
 */

import type { PluginDefinition, ResolvedPlugin } from "../types/plugin";

/**
 * Topologically sort plugins based on dependencies
 * Uses Kahn's algorithm
 */
export function resolvePluginOrder(plugins: PluginDefinition[]): ResolvedPlugin[] {
  const pluginMap = new Map<string, PluginDefinition>();
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();

  // Build plugin map and initialize in-degrees
  for (const plugin of plugins) {
    pluginMap.set(plugin.name, plugin);
    inDegree.set(plugin.name, 0);
    adjacency.set(plugin.name, []);
  }

  // Build dependency graph
  for (const plugin of plugins) {
    if (plugin.dependencies) {
      for (const dep of plugin.dependencies) {
        if (!pluginMap.has(dep)) {
          console.warn(`Plugin "${plugin.name}" depends on unknown plugin "${dep}"`);
          continue;
        }

        // dep -> plugin (dep must be loaded before plugin)
        adjacency.get(dep)!.push(plugin.name);
        inDegree.set(plugin.name, (inDegree.get(plugin.name) || 0) + 1);
      }
    }
  }

  // Kahn's algorithm
  const queue: string[] = [];
  const result: ResolvedPlugin[] = [];
  let order = 0;

  // Start with plugins that have no dependencies
  for (const [name, degree] of inDegree) {
    if (degree === 0) {
      queue.push(name);
    }
  }

  while (queue.length > 0) {
    const current = queue.shift()!;
    const plugin = pluginMap.get(current)!;

    result.push({
      ...plugin,
      order: order++,
      enabled: true,
    });

    // Process dependents
    for (const dependent of adjacency.get(current) || []) {
      const newDegree = (inDegree.get(dependent) || 0) - 1;
      inDegree.set(dependent, newDegree);

      if (newDegree === 0) {
        queue.push(dependent);
      }
    }
  }

  // Check for circular dependencies
  if (result.length !== plugins.length) {
    const processed = new Set(result.map((p) => p.name));
    const unprocessed = plugins.filter((p) => !processed.has(p.name)).map((p) => p.name);

    throw new Error(`Circular dependency detected among plugins: ${unprocessed.join(", ")}`);
  }

  return result;
}
