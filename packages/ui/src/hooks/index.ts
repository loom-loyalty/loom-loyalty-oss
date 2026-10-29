/**
 * Hooks for Loom Loyalty UI components.
 */

export {
  getInfiniteNextPageParam,
  resetInfiniteQueryToFirstPage,
  warnIfMissingTotalPages,
} from "./infinite-query-helpers";
export {
  useAllPages,
  type AllPagesResponse,
  type UseAllPagesOptions,
  type UseAllPagesResult,
} from "./use-all-pages";
export { useClampListPage, type UseClampListPageOptions } from "./use-clamp-list-page";
export { useDebouncedValue } from "./use-debounced-value";
export { useFullBleedLayout } from "./use-full-bleed-layout";
export {
  useInfiniteScrollSentinel,
  type InfiniteScrollSentinelOptions,
} from "./use-infinite-scroll-sentinel";
export {
  useListControls,
  type FilterDef,
  type ListControls,
  type UseListControlsOptions,
} from "./use-list-controls";
export {
  useLoadAllPages,
  type UseLoadAllPagesOptions,
  type UseLoadAllPagesResult,
} from "./use-load-all-pages";
export { useIsMobile } from "./use-mobile";
export { useSavedViews, type UseSavedViewsArgs, type UseSavedViewsResult } from "./use-saved-views";
