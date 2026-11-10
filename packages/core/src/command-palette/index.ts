export {
  useCommandPaletteController,
  type CommandPaletteController,
  type UseCommandPaletteControllerOptions,
} from "./command-palette-controller";
export {
  DASHBOARD_PATH_PREFIXES,
  isDashboardPath,
  parseScope,
  type ParsedQuery,
} from "./command-palette-utils";
export {
  MAX_RECENT_ITEMS,
  buildRecentItemsKey,
  type CommandPaletteRecentItem,
} from "./recent-items";
export type {
  CommandPaletteErrorState,
  CommandPaletteQuickAction,
  CommandPaletteScope,
} from "./types";
