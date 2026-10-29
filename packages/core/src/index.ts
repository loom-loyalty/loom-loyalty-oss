/**
 * @loom-loyalty/core
 * Headless foundation for Loom Loyalty Hub
 *
 * This package provides provider interfaces, hooks, plugin system,
 * and TypeScript types for building Hub applications.
 */

// ============================================================
// Types
// ============================================================

export type {
  ApiConfig,
  AuthConfig,
  AuthOrganization,
  AuthProvider,
  AuthSession,
  AuthUser,
  // Runtime config types (Hub multi-tenant configuration)
  BrandingConfig,
  ComponentDefinition,
  ComponentManifest,
  ComponentSlotRegistration,
  ComponentType,
  CustomComponentsConfig,
  // Provider interfaces
  DataProvider,
  // Enum value types (for type annotations)
  EntityCodeValue,
  EntityConfig,
  EntityDetailConfig,
  EntityDetailSection,
  EntityEditConfig,
  EntityFieldConfig,
  EntityHooks,
  EntityLabelOverride,
  EntityListConfig,
  EntityOverride,
  EntityOverrides,
  EntityUIConfig,
  // Custom component props (for organizations building custom components)
  EntityViewProps,
  FieldMatch,
  // Config types
  HubConfig,
  HubLocalConfig,
  HubRoute,
  HubRuntimeConfig,
  LifecycleContext,
  LifecycleHandler,
  LifecycleNext,
  MinimalHubConfig,
  // Entity types
  MutationOptions,
  NavigateOptions,
  NavigationSectionIdValue,
  Page,
  PermissionCheckResult,
  PluginConfigContribution,
  // Plugin types
  PluginDefinition,
  PluginFactory,
  PluginLifecycleHooks,
  PluginMeta,
  PluginSetupContext,
  QueryOptions,
  ResolvedHubConfig,
  ResolvedPlugin,
  RouterProvider,
  SystemComponentValue,
  SystemWidgetValue,
  ThemeConfig,
  ThemeOverride,
  UISettings,
  WidgetConfig,
  WidgetProps,
  WorkOSConfig,
} from "./types";

// ============================================================
// Enums (const objects for type-safe strings)
// ============================================================

export { EntityCode, NavigationSectionId, SystemComponent, SystemWidget } from "./types";

// ============================================================
// Providers
// ============================================================

export { HubContext, HubProvider, type HubContextValue, type HubProviderProps } from "./providers";

// ============================================================
// Hooks
// ============================================================

export {
  useAuthProvider,
  useCommandPaletteShortcut,
  useCreateEntity,
  useDataProvider,
  useDebouncedValue,
  useDeleteEntity,
  // Document title
  useDocumentTitle,
  // Entity hooks
  useEntity,
  useEntityMutation,
  // Core hooks
  useHub,
  useList,
  useRouterProvider,
  useUpdateEntity,
  type MutationType,
  type UseEntityMutationOptions,
  // Hook types
  type UseEntityOptions,
  type UseListOptions,
} from "./hooks";

export { isEditableElement } from "./hooks";

// ============================================================
// Config Helpers
// ============================================================

export {
  createPlugin,
  defineConfig,
  defineLocalConfig,
  definePlugin,
  resolveConfig,
} from "./config";

// ============================================================
// Plugin System
// ============================================================

export { PluginRegistry, resolvePluginOrder } from "./plugins";

// ============================================================
// Adapters
// ============================================================

export { createApiClientAdapter, type ApiClientAdapterConfig } from "./adapters";

// ============================================================
// Command Palette
// ============================================================

export {
  DASHBOARD_PATH_PREFIXES,
  isDashboardPath,
  parseScope,
  useCommandPaletteController,
  type CommandPaletteController,
  type CommandPaletteErrorState,
  type CommandPaletteScope,
  type ParsedQuery,
  type UseCommandPaletteControllerOptions,
} from "./command-palette";

// ============================================================
// Event Actions (operator surfaces: what activities are offered where)
// ============================================================

export {
  CATALOGUE_SIZE,
  ENGINE_ANNOUNCED_ACTIVITY_CODES,
  LIFECYCLE_ACTIVITY_CODES,
  OFFERABLE_PLATFORM_ACTIVITY_CODES,
  SHEET_SERVED_ACTIVITY_CODES,
  extractDataModelCode,
  isCareOfferableActivity,
  isEngineAnnouncedActivity,
  surfacesWith,
  surfacesWithout,
  useActivityDataModel,
  useEventTypeActions,
  useRegistrySurfaces,
  type UseActivityDataModelResult,
  type UseEventTypeActionsOptions,
  type UseEventTypeActionsResult,
  type UseRegistrySurfacesResult,
} from "./event-actions";

// ============================================================
// Utils
// ============================================================

// ============================================================
// AI Chat
// ============================================================

export * from "./ai";

export {
  GENERIC_ERROR_MESSAGE,
  describeError,
  extractLocalizedString,
  formatDate,
  formatDateRange,
  formatDateTime,
  formatRelativeTime,
  formatShortDate,
  formatUpcomingTime,
  isValidISODateTime,
  isWithinDateRange,
  parseISODateTime,
  parseLocalizedDescription,
  toISODateTime,
  type DescribeErrorOptions,
  type DescribedError,
  type ErrorCopyOverride,
  type ISODate,
  type ISODateTime,
} from "./utils";
