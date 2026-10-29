/**
 * Expression Context
 *
 * Provides schema-aware context (eventTypeCode, data model fetcher) to
 * descendant expression components. Used by JsonPathInput to optionally
 * render the schema tree browser.
 *
 * The context is intentionally generic — it accepts a DataModelLike interface
 * rather than SDK types directly, preserving package isolation.
 */

import { createContext, useContext, useMemo, type ReactNode } from "react";

import type { Expression } from "./types.js";

/**
 * Generic data model shape accepted by the expression context.
 * Matches the subset of SDK DataModel/DataModelElement needed for schema browsing.
 */
export interface DataModelLike {
  elements: Array<{
    inputAttribute?: string;
    outputAttribute?: string;
    name: string;
    typeReference: string;
    array?: boolean;
  }>;
  /**
   * Code of this type's parent data model type, if it extends one (platform
   * inheritance — DataModelType.parentTypeReference). A `by-code` fetch only
   * ever returns a type's OWN direct elements, never inherited ones, so
   * callers that want the full effective schema must walk this themselves.
   */
  parentTypeReference?: string;
}

/**
 * The surface an expression is edited for. `event` paths start at `$.eventData`/`$.eventTarget`;
 * `customer` and `feed` paths start at `$.`, read from the `dataModelCode` model (`customer` for
 * audiences; a feed supplies its own row model).
 */
export type ExpressionSurfaceMode = "event" | "customer" | "feed";

/** Whether paths on this surface start at `$.` against one root model, rather than event sections. */
export function isRootPathMode(mode: ExpressionSurfaceMode | undefined): boolean {
  return mode === "customer" || mode === "feed";
}

export interface ExpressionContextValue {
  /**
   * The data model code used to resolve the schema for path browsing.
   * For event rules, pass the event type code. For customer segments, pass "customer".
   */
  dataModelCode?: string;
  /** @deprecated Use dataModelCode instead */
  eventTypeCode?: string;
  /** Async function to fetch a data model by its type code */
  fetchDataModel?: (code: string) => Promise<DataModelLike>;
  /**
   * Authoritative surface: operator gating + UI labels + path defaults. Set by the
   * consumer (event rules → 'event', audiences → 'customer'); NOT derived from
   * dataModelCode. 'event' shows Event Data/Target sections, 'customer' shows Customer Fields.
   */
  mode?: ExpressionSurfaceMode;
  /** True while the parent is still resolving the dataModelCode (e.g. via metadata dereference). */
  isResolvingSchema?: boolean;
  /**
   * Optional slot rendered beside each sentence-mode leaf condition — e.g. the
   * audience builder's live "matches N customers" count. The caller owns any
   * data fetching; this package only places the node.
   */
  renderConditionAside?: (condition: Expression) => ReactNode;
}

const ExpressionContext = createContext<ExpressionContextValue>({});

export interface ExpressionContextProviderProps extends ExpressionContextValue {
  children: ReactNode;
}

export function ExpressionContextProvider({
  dataModelCode,
  eventTypeCode,
  fetchDataModel,
  mode,
  isResolvingSchema,
  renderConditionAside,
  children,
}: ExpressionContextProviderProps): ReactNode {
  const resolvedCode = dataModelCode ?? eventTypeCode;
  // Explicit consumer `mode` wins; dataModelCode heuristic is only a fallback default.
  const resolvedMode = mode ?? (resolvedCode?.toUpperCase() === "CUSTOMER" ? "customer" : "event");
  const value = useMemo(
    () => ({
      dataModelCode,
      // Preserve a caller's original event type independently from its resolved
      // data model. This lets path pickers distinguish "no event selected" from
      // an event whose schema metadata could not be resolved.
      eventTypeCode: eventTypeCode ?? dataModelCode,
      fetchDataModel,
      mode: resolvedMode,
      isResolvingSchema,
      renderConditionAside,
    }),
    [
      dataModelCode,
      eventTypeCode,
      fetchDataModel,
      resolvedMode,
      isResolvingSchema,
      renderConditionAside,
    ]
  );
  return <ExpressionContext.Provider value={value}>{children}</ExpressionContext.Provider>;
}

/**
 * Access expression context. Returns empty object if no provider is present.
 * JsonPathInput uses this to optionally render the schema tree browser.
 */
export function useExpressionContext(): ExpressionContextValue {
  return useContext(ExpressionContext);
}
