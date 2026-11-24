import { createContext, useContext, type ReactNode } from "react";

/**
 * What the current caller may read, as the app decides it from the caller's scopes. Metadata fields send only the
 * lookups the caller may make, so a role without metadata reads never fills the audit log with refusals.
 */
export interface MetadataReadAccess {
  /** May read metadata types (GET /metadata-types/by-code/{code}). */
  types: boolean;
  /** May read a type's options (GET /metadata/by-type/{type} and the data-type, location and item lists). */
  entries: boolean;
  /**
   * May list data-model types (GET /data-model-types), which a DATA_TYPE type's fields pick from. Its own scope, not a
   * metadata one. Omitted means true, so apps that set only the two above keep today's behaviour.
   */
  dataModelTypes?: boolean;
}

const FULL_ACCESS: MetadataReadAccess = { types: true, entries: true, dataModelTypes: true };

const MetadataReadAccessContext = createContext<MetadataReadAccess>(FULL_ACCESS);

/** Wrap an app in this to tell its metadata fields what the caller may read. Without it, they read everything. */
export function MetadataReadAccessProvider({
  value,
  children,
}: {
  value: MetadataReadAccess;
  children: ReactNode;
}): ReactNode {
  return (
    <MetadataReadAccessContext.Provider value={value}>
      {children}
    </MetadataReadAccessContext.Provider>
  );
}

export function useMetadataReadAccess(): Required<MetadataReadAccess> {
  const access = useContext(MetadataReadAccessContext);
  return { ...access, dataModelTypes: access.dataModelTypes ?? true };
}
