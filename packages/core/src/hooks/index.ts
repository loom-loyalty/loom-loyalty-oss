/**
 * Hooks Barrel Export
 */

export { useAuthProvider } from "./use-auth-provider";
export { isEditableElement, useCommandPaletteShortcut } from "./use-command-palette-shortcut";
export { useDataProvider } from "./use-data-provider";
export { useDebouncedValue } from "./use-debounced-value";
export { useDocumentTitle } from "./use-document-title";
export { useHub } from "./use-hub";
export { useRouterProvider } from "./use-router-provider";

export { useEntity, type UseEntityOptions } from "./use-entity";
export { useList, type UseListOptions } from "./use-list";
export {
  useCreateEntity,
  useDeleteEntity,
  useEntityMutation,
  useUpdateEntity,
  type MutationType,
  type UseEntityMutationOptions,
} from "./use-mutation";
