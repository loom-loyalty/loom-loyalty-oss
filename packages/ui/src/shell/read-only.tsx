/**
 * App-wide read-only mode: the app shell marks the session read-only (for example when the
 * organization's trial has ended unpaid) and shared write surfaces such as `FormSheet` and
 * `EntityEdit` disable their submit, showing the reason instead. Reads keep working.
 */
import { createContext, useContext, useMemo, type ReactNode } from "react";

export interface ReadOnlyState {
  /** Whether writes are refused for the whole session. */
  readOnly: boolean;
  /** Why, in one sentence, shown next to a disabled submit. Null when not read-only. */
  reason: string | null;
}

const NOT_READ_ONLY: ReadOnlyState = { readOnly: false, reason: null };

const ReadOnlyContext = createContext<ReadOnlyState>(NOT_READ_ONLY);

export interface ReadOnlyProviderProps {
  /** Why the session is read-only; null or omitted keeps the enclosing provider's state. */
  reason?: string | null;
  children: ReactNode;
}

/** Marks its subtree read-only. Nested providers combine: the innermost reason wins. */
export function ReadOnlyProvider({ reason = null, children }: ReadOnlyProviderProps): ReactNode {
  const parent = useContext(ReadOnlyContext);
  const value = useMemo<ReadOnlyState>(
    () => (reason ? { readOnly: true, reason } : parent),
    [reason, parent]
  );
  return <ReadOnlyContext.Provider value={value}>{children}</ReadOnlyContext.Provider>;
}

/** The session's read-only state; writable outside a {@link ReadOnlyProvider}. */
export function useReadOnly(): ReadOnlyState {
  return useContext(ReadOnlyContext);
}
