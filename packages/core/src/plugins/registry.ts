/**
 * Plugin Registry
 * Manages plugin lifecycle and provides access to plugin functionality
 */

import type * as React from "react";
import type { ResolvedHubConfig } from "../types/config";
import type {
  ComponentSlotRegistration,
  LifecycleContext,
  PluginDefinition,
  PluginLifecycleHooks,
  PluginSetupContext,
  ResolvedPlugin,
} from "../types/plugin";
import { createHookExecutor } from "./middleware";
import { resolvePluginOrder } from "./resolver";

/**
 * Plugin Registry
 *
 * Manages the plugin lifecycle including:
 * - Dependency resolution and ordering
 * - Initialization and teardown
 * - Lifecycle hook execution
 * - Component slot registration
 */
export class PluginRegistry {
  private plugins: Map<string, ResolvedPlugin> = new Map();
  private slots: Map<string, ComponentSlotRegistration[]> = new Map();
  private dynamicHooks: Map<
    keyof PluginLifecycleHooks,
    PluginLifecycleHooks[keyof PluginLifecycleHooks][]
  > = new Map();
  private hookExecutor:
    | ((hookName: keyof PluginLifecycleHooks, context: LifecycleContext) => Promise<void>)
    | null = null;
  private initialized = false;

  constructor(private pluginDefinitions: PluginDefinition[]) {}

  /**
   * Initialize all plugins
   */
  async initialize(config: ResolvedHubConfig): Promise<void> {
    if (this.initialized) {
      console.warn("PluginRegistry already initialized");
      return;
    }

    // 1. Resolve plugin order based on dependencies
    const resolvedPlugins = resolvePluginOrder(this.pluginDefinitions);

    // 2. Store resolved plugins
    for (const plugin of resolvedPlugins) {
      this.plugins.set(plugin.name, plugin);

      // Register static slots
      if (plugin.slots) {
        for (const slot of plugin.slots) {
          this.registerSlot(slot);
        }
      }
    }

    // 3. Create hook executor
    this.hookExecutor = createHookExecutor(resolvedPlugins);

    // 4. Call setup on each plugin
    for (const plugin of resolvedPlugins) {
      if (plugin.setup) {
        const setupContext: PluginSetupContext = {
          config,
          plugins: this.plugins,
          registerHook: (hookName, handler) => {
            this.registerDynamicHook(hookName, handler);
          },
          registerSlot: (registration) => {
            this.registerSlot(registration);
          },
        };

        await plugin.setup(setupContext);
      }
    }

    this.initialized = true;
  }

  /**
   * Teardown all plugins
   */
  async teardown(): Promise<void> {
    if (!this.initialized) return;

    // Call teardown in reverse order
    const plugins = Array.from(this.plugins.values()).reverse();

    for (const plugin of plugins) {
      if (plugin.teardown) {
        try {
          await plugin.teardown();
        } catch (error) {
          console.error(`Error tearing down plugin "${plugin.name}":`, error);
        }
      }
    }

    this.plugins.clear();
    this.slots.clear();
    this.dynamicHooks.clear();
    this.hookExecutor = null;
    this.initialized = false;
  }

  /**
   * Get all resolved plugins
   */
  getPlugins(): Map<string, ResolvedPlugin> {
    return new Map(this.plugins);
  }

  /**
   * Get a specific plugin by name
   */
  getPlugin(name: string): ResolvedPlugin | undefined {
    return this.plugins.get(name);
  }

  /**
   * Execute a lifecycle hook
   */
  async executeHook(hookName: string, context: LifecycleContext): Promise<void> {
    if (!this.hookExecutor) {
      return;
    }

    // Execute static hooks from plugin definitions
    await this.hookExecutor(hookName as keyof PluginLifecycleHooks, context);

    // Execute dynamic hooks
    const dynamicHandlers = this.dynamicHooks.get(hookName as keyof PluginLifecycleHooks);
    if (dynamicHandlers) {
      for (const handler of dynamicHandlers) {
        if (handler) {
          await handler(context, async () => {});
        }
      }
    }
  }

  /**
   * Register a dynamic lifecycle hook
   */
  private registerDynamicHook<K extends keyof PluginLifecycleHooks>(
    hookName: K,
    handler: NonNullable<PluginLifecycleHooks[K]>
  ): void {
    const handlers = this.dynamicHooks.get(hookName) || [];
    handlers.push(handler);
    this.dynamicHooks.set(hookName, handlers);
  }

  /**
   * Register a component slot
   */
  private registerSlot(registration: ComponentSlotRegistration): void {
    const slots = this.slots.get(registration.slot) || [];
    slots.push(registration);

    // Sort by priority (higher first)
    slots.sort((a, b) => (b.priority || 0) - (a.priority || 0));

    this.slots.set(registration.slot, slots);
  }

  /**
   * Get the component for a slot
   */
  getSlotComponent(
    slotId: string,
    context?: Record<string, unknown>
  ): React.ComponentType<unknown> | null {
    const registrations = this.slots.get(slotId);

    if (!registrations || registrations.length === 0) {
      return null;
    }

    // Find first matching registration
    for (const registration of registrations) {
      if (!registration.match || registration.match(context || {})) {
        return registration.component;
      }
    }

    return null;
  }

  /**
   * Get all components for a slot (for composition)
   */
  getSlotComponents(
    slotId: string,
    context?: Record<string, unknown>
  ): React.ComponentType<unknown>[] {
    const registrations = this.slots.get(slotId);

    if (!registrations) {
      return [];
    }

    return registrations.filter((r) => !r.match || r.match(context || {})).map((r) => r.component);
  }
}
