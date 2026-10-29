/**
 * Plugin System Types
 * Three-layer plugin architecture: Config, Lifecycle, Slots
 */

import type * as React from "react";
import type { AuthOrganization, AuthUser } from "./auth-provider";
import type { HubConfig, ResolvedHubConfig } from "./config";

/**
 * Plugin metadata
 */
export interface PluginMeta {
  /** Unique plugin name */
  name: string;
  /** Plugin version (semver) */
  version: string;
  /** Plugin description */
  description?: string;
  /** Plugin dependencies (other plugin names) */
  dependencies?: string[];
}

/**
 * Context passed to lifecycle hooks
 */
export interface LifecycleContext {
  /** Entity type being operated on */
  entityType: string;
  /** Entity ID (for single entity operations) */
  entityId?: string;
  /** Entity data (for create/update) */
  data?: unknown;
  /** Current user */
  user?: AuthUser;
  /** Current organization */
  organization?: AuthOrganization;
  /** Additional context data */
  extra?: Record<string, unknown>;
}

/**
 * Next function for middleware chain
 */
export type LifecycleNext<TResult = void> = (context: LifecycleContext) => Promise<TResult>;

/**
 * Lifecycle hook handler
 */
export type LifecycleHandler<TResult = void> = (
  context: LifecycleContext,
  next: LifecycleNext<TResult>
) => Promise<TResult>;

/**
 * Layer 2: Lifecycle hooks that plugins can register
 */
export interface PluginLifecycleHooks {
  /** Called before entity is saved (create or update) */
  onEntitySave?: LifecycleHandler;
  /** Called after entity is saved */
  onEntitySaved?: LifecycleHandler;
  /** Called before entity is deleted */
  onEntityDelete?: LifecycleHandler;
  /** Called after entity is deleted */
  onEntityDeleted?: LifecycleHandler;
  /** Called before entity is fetched */
  onEntityFetch?: LifecycleHandler;
  /** Called after entity is fetched */
  onEntityFetched?: LifecycleHandler;
  /** Called on any error */
  onError?: LifecycleHandler<void>;
}

/**
 * Layer 3: Component slot registration
 */
export interface ComponentSlotRegistration {
  /** Slot identifier (e.g., 'field.points', 'layout.sidebar') */
  slot: string;
  /** Component to render (or wrapper function) */
  component: React.ComponentType<unknown>;
  /** Priority for ordering (higher = first) */
  priority?: number;
  /** Condition for when to apply */
  match?: (context: Record<string, unknown>) => boolean;
}

/**
 * Plugin configuration contribution (Layer 1)
 */
export interface PluginConfigContribution {
  /** Entity configurations to merge */
  entities?: Record<string, unknown>;
  /** Widget definitions */
  widgets?: Record<string, unknown>;
  /** Component overrides */
  components?: Record<string, React.ComponentType<unknown>>;
  /** Additional routes */
  routes?: Array<{ path: string; component: React.ComponentType }>;
}

/**
 * Context provided to plugin setup function
 */
export interface PluginSetupContext {
  /** Resolved Hub configuration */
  config: ResolvedHubConfig;
  /** Access to other plugins (for inter-plugin communication) */
  plugins: Map<string, PluginDefinition>;
  /** Register additional lifecycle hooks dynamically */
  registerHook: <K extends keyof PluginLifecycleHooks>(
    hookName: K,
    handler: NonNullable<PluginLifecycleHooks[K]>
  ) => void;
  /** Register component slot dynamically */
  registerSlot: (registration: ComponentSlotRegistration) => void;
}

/**
 * Plugin definition structure
 *
 * @public
 * @remarks
 * Plugins operate on three layers:
 * 1. Configuration Composition - config objects that merge
 * 2. Lifecycle Hooks - middleware chain for entity operations
 * 3. Component Slots - named injection points for UI
 *
 * @example
 * ```typescript
 * const myPlugin: PluginDefinition = {
 *   name: 'analytics',
 *   version: '1.0.0',
 *   hooks: {
 *     onEntitySave: async (context, next) => {
 *       trackEvent('entity_saved', { type: context.entityType });
 *       return next(context);
 *     },
 *   },
 * };
 * ```
 */
export interface PluginDefinition extends PluginMeta {
  /**
   * Layer 1: Configuration contribution
   * Merged with base config during initialization
   */
  config?: PluginConfigContribution | ((baseConfig: HubConfig) => PluginConfigContribution);

  /**
   * Layer 2: Lifecycle hooks
   * Executed in middleware chain order
   */
  hooks?: PluginLifecycleHooks;

  /**
   * Layer 3: Component slot registrations
   */
  slots?: ComponentSlotRegistration[];

  /**
   * Plugin initialization
   * Called after dependency resolution
   * @param context - Resolved config and other plugins
   */
  setup?: (context: PluginSetupContext) => void | Promise<void>;

  /**
   * Plugin cleanup
   * Called on provider unmount
   */
  teardown?: () => void | Promise<void>;
}

/**
 * Resolved plugin with computed properties
 */
export interface ResolvedPlugin extends PluginDefinition {
  /** Order in execution chain (based on dependencies) */
  order: number;
  /** Whether plugin is enabled */
  enabled: boolean;
}

/**
 * Plugin factory function type
 */
export type PluginFactory<TOptions = void> = TOptions extends void
  ? () => PluginDefinition
  : (options: TOptions) => PluginDefinition;
