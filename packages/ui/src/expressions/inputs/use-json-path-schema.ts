/**
 * useJsonPathSchema Hook
 *
 * Manages the schema tree state for the JSON path browser.
 * Fetches the event data model and customer model, builds SchemaNode trees,
 * and handles lazy expansion of non-primitive type references.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { dataModelCodeKey } from "../../entity/features/data-models/code-key.js";
import {
  isRootPathMode,
  useExpressionContext,
  type DataModelLike,
  type ExpressionSurfaceMode,
} from "../expression-context.js";
import {
  isPrimitiveTypeCode,
  splitArraySuffix as splitArraySuffixShared,
} from "./json-path-parsing.js";
import { ROOT_LABELS } from "./json-path-root-labels.js";

export const MAX_DEPTH = 10;
/**
 * Hard stop on how many levels of data-model type inheritance
 * (DataModelType.parentTypeReference) `fetchModelChildren` will walk before
 * giving up on finding more ancestors -- guards a malformed/circular parent
 * chain from recursing forever, same reasoning as MAX_DEPTH above but for
 * type inheritance depth rather than JSONPath segment depth.
 */
export const MAX_PARENT_CHAIN_DEPTH = 10;
const CUSTOMER_MODEL_CODE = "customer";

/** `customer` is the single `$.` root used by the customer and feed surfaces. */
export type RootSection = "eventData" | "eventTarget" | "customer";

export interface SchemaNode {
  /** Field attribute key used in path construction */
  attribute: string;
  /** Human-readable display name */
  name: string;
  /** The type reference code (e.g., STRING, CUSTOMER) */
  typeReference: string;
  /** Whether this field is an array */
  isArray: boolean;
  /** Whether this is a leaf primitive type */
  isPrimitive: boolean;
  /** Children nodes. undefined = expandable but not loaded. SchemaNode[] = loaded. */
  children?: SchemaNode[];
}

/**
 * Convert data model elements to schema nodes.
 */
function elementsToNodes(elements: DataModelLike["elements"]): SchemaNode[] {
  return elements
    .filter((el) => !!(el.outputAttribute ?? el.inputAttribute))
    .map((el) => {
      const attribute = (el.outputAttribute ?? el.inputAttribute)!;
      const isPrimitive = isPrimitiveTypeCode(el.typeReference);
      return {
        attribute,
        name: el.name,
        typeReference: el.typeReference,
        isArray: el.array ?? false,
        isPrimitive,
        children: undefined, // non-primitives are expandable (undefined = not yet loaded)
      };
    });
}

/**
 * Immutable deep-set of children on a node identified by path segments.
 */
function setNodeChildren(
  nodes: SchemaNode[],
  pathSegments: string[],
  children: SchemaNode[]
): SchemaNode[] {
  if (pathSegments.length === 0) return nodes;
  const [head, ...rest] = pathSegments;
  return nodes.map((node) => {
    if (node.attribute !== head) return node;
    if (rest.length === 0) return { ...node, children };
    return {
      ...node,
      children: setNodeChildren(node.children ?? [], rest, children),
    };
  });
}

/** Sentinel node used to signal a failed expand fetch in the tree */
const EXPAND_ERROR_SENTINEL: SchemaNode = {
  attribute: "__error__",
  name: "Failed to load fields",
  typeReference: "",
  isArray: false,
  isPrimitive: true,
  children: undefined,
};

// -- Live path validation (R8, KTD8) --

export interface PathResolutionValid {
  status: "valid";
  /** Friendly breadcrumb trail, one entry per path segment. */
  breadcrumbs: Array<{ name: string; typeReference: string; isArray: boolean }>;
  typeReference: string;
  isArray: boolean;
}

export type PathResolutionResult =
  | PathResolutionValid
  | { status: "invalid-prefix" }
  /** A segment is genuinely absent from a resolved level — not a fetch failure. */
  | { status: "unresolved"; failedSegment: string }
  /** An `expandNodeAsync` fetch rejected while resolving an un-navigated segment. */
  | { status: "load-failure" }
  /** The root schema for this section is still being fetched — retry once it lands. */
  | { status: "pending" }
  /** No `fetchDataModel` was ever configured — nothing to validate against (fix #11). */
  | { status: "schema-unavailable" };

interface PathSegment {
  attribute: string;
  /** Whether the user wrote an array-index suffix (e.g. `[*]`, `[0]`) on this segment. */
  isArrayAccess: boolean;
}

/**
 * Splits off a trailing array-index suffix while recording whether one was
 * present — the suffix itself must not be silently dropped, or a shape
 * mismatch (array syntax on a scalar field, or vice versa) can never be
 * detected (adversarial review finding). Delegates to the shared parser
 * (json-path-parsing.ts) for the actual regex, just remapping its `isArray`
 * to this file's existing `isArrayAccess` property name so no other call
 * site in this file needs to change.
 */
function splitArraySuffix(segment: string): PathSegment {
  const { attribute, isArray } = splitArraySuffixShared(segment);
  return { attribute, isArrayAccess: isArray };
}

function parsePath(
  path: string,
  mode: ExpressionSurfaceMode
): { rootSection: RootSection; segments: PathSegment[] } | null {
  if (!path.startsWith("$.")) return null;
  const rest = path.slice(2);
  if (!rest) return null;
  const rawSegments = rest
    .split(".")
    .map(splitArraySuffix)
    .filter((s) => s.attribute.length > 0);
  if (rawSegments.length === 0) return null;

  if (isRootPathMode(mode)) {
    return { rootSection: "customer", segments: rawSegments };
  }

  const [first, ...remainder] = rawSegments;
  if (first!.attribute !== "eventData" && first!.attribute !== "eventTarget") return null;
  return { rootSection: first!.attribute as "eventData" | "eventTarget", segments: remainder };
}

export function useJsonPathSchema(): {
  eventDataNodes: SchemaNode[];
  eventTargetNodes: SchemaNode[];
  customerNodes: SchemaNode[];
  expandNode: (
    rootSection: RootSection,
    pathSegments: string[],
    typeReference: string,
    depth: number
  ) => void;
  /**
   * Promise-returning sibling of `expandNode` (KTD8 approach (a)). Shares the
   * SAME fetch-and-cache path (`fetchModelChildren` below, backed by the
   * `modelCacheRef` cache and one `fetchDataModel` call per type code) — this is
   * one fetch implementation behind two entry points, not a second fetcher.
   * Resolves with the fetched/cached children, or rejects if the underlying
   * `fetchDataModel` call fails.
   */
  expandNodeAsync: (
    rootSection: RootSection,
    pathSegments: string[],
    typeReference: string,
    depth: number
  ) => Promise<SchemaNode[]>;
  /**
   * Walks a typed JSONPath string against the current schema tree, lazily
   * loading (via `expandNodeAsync`) any segment whose children are still
   * un-navigated/`undefined`. Distinguishes a missing `$.` prefix, a genuinely
   * unresolved segment, and a segment fetch failure (R8/KTD8/AE3).
   */
  resolvePath: (path: string) => Promise<PathResolutionResult>;
  isLoading: boolean;
  error: string | null;
  mode: ExpressionSurfaceMode;
  /** True when a data model code is resolved (event-mode) or in customer or feed mode. */
  hasSchemaSource: boolean;
  /** True when an event type is configured, even if resolving its schema failed. */
  hasEventType: boolean;
} {
  const {
    dataModelCode,
    eventTypeCode,
    fetchDataModel,
    mode: contextMode,
    isResolvingSchema,
  } = useExpressionContext();
  const resolvedCode = dataModelCode ?? eventTypeCode;
  const mode = contextMode ?? "event";
  const hasSchemaSource = isRootPathMode(mode) || !!resolvedCode || !!isResolvingSchema;
  const hasEventType = isRootPathMode(mode) || !!eventTypeCode;
  const [eventDataNodes, setEventDataNodes] = useState<SchemaNode[]>([]);
  const [eventTargetNodes, setEventTargetNodes] = useState<SchemaNode[]>([]);
  const [customerNodes, setCustomerNodes] = useState<SchemaNode[]>([]);
  const [eventDataLoading, setEventDataLoading] = useState(false);
  const [customerLoading, setCustomerLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cache resolved models to avoid refetching on repeated expand/collapse.
  // Shared by BOTH `expandNode` and `expandNodeAsync` — one cache, two callers.
  const modelCacheRef = useRef<Map<string, SchemaNode[]>>(new Map());
  // De-dupes concurrent fetches (from either entry point) for the same type code.
  const inflightRef = useRef<Map<string, Promise<SchemaNode[]>>>(new Map());
  // Guard async callbacks against unmounted state
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Resolve the setter for a given root section
  const getSetterForSection = useCallback((section: RootSection) => {
    if (section === "customer") return setCustomerNodes;
    return section === "eventData" ? setEventDataNodes : setEventTargetNodes;
  }, []);

  // The ONE fetch-and-cache implementation shared by `expandNode`
  // (state-mutating, void), `expandNodeAsync` (promise-returning), AND both
  // root-level model effects below (KTD8 approach (a), now also the single
  // source of truth for inheritance merging). Resolves a type code to its
  // FULL EFFECTIVE element set: that type's own direct elements plus
  // everything inherited from its parent chain, recursively.
  //
  // `by-code` only ever returns a type's own direct elements, never inherited
  // ones -- confirmed live: caferewards-purchase's own elements are
  // amount/transactionDateTime/transactionId, but eligibleAmount genuinely
  // exists on its effective schema via its `transaction` parent
  // (DataModelType.parentTypeReference). Without walking that chain, any
  // field inherited from an ancestor is invisible to the picker no matter how
  // the browse/resolve logic searches -- a real, previously-undiscovered gap,
  // not a bad-path/test problem.
  //
  // Own elements win over an inherited one on a name collision
  // (closest-ancestor-first). `visited` guards a malformed/circular parent
  // chain from recursing forever; MAX_PARENT_CHAIN_DEPTH is an additional
  // hard stop, same reasoning as MAX_DEPTH for JSONPath segments. Every level
  // visited (not just the originally-requested type) gets cached and
  // in-flight-deduped under its own code, so a later lookup for a shared
  // ancestor (or the same type from a different call site) doesn't re-walk
  // or re-fetch it.
  const fetchModelChildren = useCallback(
    (typeReference: string): Promise<SchemaNode[]> => {
      const resolveEffective = (
        code: string,
        visited: Set<string>,
        depth: number
      ): Promise<SchemaNode[]> => {
        // Cache/inflight keys are folded for dedupe; the fetch itself gets the
        // real code verbatim (nested/custom DataModelType references are
        // migrated to lowercase-hyphenated codes, so uppercasing would 404).
        const key = dataModelCodeKey(code);
        const cached = modelCacheRef.current.get(key);
        if (cached) return Promise.resolve(cached);
        if (visited.has(key) || depth >= MAX_PARENT_CHAIN_DEPTH) return Promise.resolve([]);
        visited.add(key);

        const inflight = inflightRef.current.get(key);
        if (inflight) return inflight;

        if (!fetchDataModel) return Promise.reject(new Error("No fetchDataModel configured"));

        const promise = fetchDataModel(code)
          .then(async (model) => {
            const ownElements = elementsToNodes(model.elements);
            let merged = ownElements;
            if (model.parentTypeReference) {
              const parentElements = await resolveEffective(
                model.parentTypeReference,
                visited,
                depth + 1
              );
              const ownAttributes = new Set(ownElements.map((n) => n.attribute));
              merged = [
                ...ownElements,
                ...parentElements.filter((n) => !ownAttributes.has(n.attribute)),
              ];
            }
            modelCacheRef.current.set(key, merged);
            return merged;
          })
          .finally(() => {
            inflightRef.current.delete(key);
          });
        inflightRef.current.set(key, promise);
        return promise;
      };

      return resolveEffective(typeReference, new Set(), 0);
    },
    [fetchDataModel]
  );

  // Always-current refs so `resolvePath` (recreated rarely) reads the LATEST
  // tree rather than a stale closure over the state at hook-call time.
  const eventDataNodesRef = useRef(eventDataNodes);
  eventDataNodesRef.current = eventDataNodes;
  const eventTargetNodesRef = useRef(eventTargetNodes);
  eventTargetNodesRef.current = eventTargetNodes;
  const customerNodesRef = useRef(customerNodes);
  customerNodesRef.current = customerNodes;

  // Load event data model when resolvedCode changes (skipped in customer mode since customer model is loaded separately)
  useEffect(() => {
    if (!resolvedCode || !fetchDataModel || isRootPathMode(mode)) {
      setEventDataNodes([]);
      return;
    }

    let cancelled = false;
    setEventDataLoading(true);
    setError(null);

    // Forward resolvedCode verbatim: it's an API-sourced DataModelType code,
    // and .toUpperCase() with no separator normalization turns a migrated
    // multi-segment code like "custom-event" into "CUSTOM-EVENT", which
    // matches neither spelling and 404s. The cache key is folded separately
    // (case + separator insensitive) purely to dedupe, never to transform
    // what gets sent.
    // Goes through fetchModelChildren (not a raw fetchDataModel call) so the
    // root event-data level ALSO gets inherited fields merged in, not just
    // nested expansions -- eligibleAmount needs to show up here directly,
    // since it's a top-level eventData field once transaction's elements are
    // merged into caferewards-purchase's own.
    fetchModelChildren(resolvedCode)
      .then((nodes) => {
        if (cancelled) return;
        setEventDataNodes(nodes);
      })
      .catch(() => {
        if (!cancelled) {
          setEventDataNodes([]);
          setError(
            "Event data schema is unavailable. Path autocompletion is off; you can still type a JSON path manually."
          );
        }
      })
      .finally(() => {
        if (!cancelled) setEventDataLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [resolvedCode, fetchDataModel, fetchModelChildren, mode]);

  // Load the root model. In event mode the customer model populates eventTargetNodes; in customer
  // mode it populates customerNodes; in feed mode the feed's own row model (`dataModelCode`) does.
  const rootModelCode = mode === "feed" ? resolvedCode : CUSTOMER_MODEL_CODE;
  useEffect(() => {
    if (!fetchDataModel || !rootModelCode) {
      setEventTargetNodes([]);
      setCustomerNodes([]);
      return;
    }

    let cancelled = false;
    setCustomerLoading(true);

    fetchModelChildren(rootModelCode)
      .then((nodes) => {
        if (cancelled) return;
        if (isRootPathMode(mode)) {
          setCustomerNodes(nodes);
        } else {
          setEventTargetNodes(nodes);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setEventTargetNodes([]);
          setCustomerNodes([]);
          setError(
            mode === "feed"
              ? "Could not load this feed's fields. You can still type a path such as $.row.status."
              : mode === "customer"
                ? "Could not load customer fields. Check data model configuration."
                : "Failed to load customer schema. Check your connection and try again."
          );
        }
      })
      .finally(() => {
        if (!cancelled) setCustomerLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [fetchDataModel, fetchModelChildren, mode, rootModelCode]);

  // Expand a non-primitive node by fetching its referenced data model (fire-and-forget)
  const expandNode = useCallback(
    (rootSection: RootSection, pathSegments: string[], typeReference: string, depth: number) => {
      if (!fetchDataModel || depth >= MAX_DEPTH) return;

      fetchModelChildren(typeReference)
        .then((children) => {
          if (!mountedRef.current) return;
          const setter = getSetterForSection(rootSection);
          setter((prev) => setNodeChildren(prev, pathSegments, children));
        })
        .catch(() => {
          if (!mountedRef.current) return;
          const setter = getSetterForSection(rootSection);
          setter((prev) => setNodeChildren(prev, pathSegments, [EXPAND_ERROR_SENTINEL]));
        });
    },
    [fetchDataModel, fetchModelChildren, getSetterForSection]
  );

  const expandNodeAsync = useCallback(
    async (
      rootSection: RootSection,
      pathSegments: string[],
      typeReference: string,
      depth: number
    ): Promise<SchemaNode[]> => {
      if (!fetchDataModel || depth >= MAX_DEPTH) return [];

      const children = await fetchModelChildren(typeReference);
      if (mountedRef.current) {
        const setter = getSetterForSection(rootSection);
        setter((prev) => setNodeChildren(prev, pathSegments, children));
      }
      return children;
    },
    [fetchDataModel, fetchModelChildren, getSetterForSection]
  );

  const resolvePath = useCallback(
    async (path: string): Promise<PathResolutionResult> => {
      const parsed = parsePath(path, mode);
      if (!parsed) return { status: "invalid-prefix" };

      const { rootSection, segments } = parsed;

      // No schema source configured at all — nothing to validate against, and
      // this is a permanent condition, not a transient one. Distinct from a
      // genuinely-unresolved path so it never blocks Save (fix #11). This also
      // covers eventData specifically: its nodes only ever populate once a
      // data-model code has resolved, so a resolved-code-less eventData path
      // has no schema to check against at all, not merely an unloaded one
      // (adversarial review finding — the original fix only handled "never
      // configured"/"still loading", missing this resolvedCode-absent case).
      if (!fetchDataModel) return { status: "schema-unavailable" };
      if (rootSection === "eventData" && !resolvedCode && !isResolvingSchema) {
        return { status: "schema-unavailable" };
      }
      // The root-level fetch for this section hasn't landed yet — a segment
      // lookup right now would spuriously read an empty node list as "this
      // field doesn't exist." Retry once loading finishes (fix #11/fix #16).
      if (eventDataLoading || customerLoading) return { status: "pending" };
      // The root fetch was attempted and genuinely failed (not merely never
      // started) — treat the same as a lazy-segment fetch failure: reported,
      // non-blocking, and distinct from "this field doesn't exist" (adversarial
      // review finding — a real schema outage must not block a manually typed,
      // otherwise-valid path).
      if (error) return { status: "load-failure" };

      let nodes: SchemaNode[] =
        rootSection === "customer"
          ? customerNodesRef.current
          : rootSection === "eventData"
            ? eventDataNodesRef.current
            : eventTargetNodesRef.current;

      const breadcrumbs: Array<{ name: string; typeReference: string; isArray: boolean }> = [];
      if (rootSection !== "customer") {
        breadcrumbs.push({
          name: ROOT_LABELS[rootSection],
          typeReference: rootSection,
          isArray: false,
        });
      }
      const walked: string[] = [];

      for (let i = 0; i < segments.length; i++) {
        const { attribute, isArrayAccess } = segments[i]!;
        const node = nodes.find((n) => n.attribute === attribute);
        if (!node) return { status: "unresolved", failedSegment: attribute };
        // The picker always writes `[*]` for array-typed fields and never for
        // scalar ones (see `segmentString` in property-picker.tsx) — a manually
        // typed path whose bracket usage disagrees with the field's actual
        // shape is a genuine mismatch, not a valid path (adversarial review
        // finding: this case previously validated as "valid" regardless).
        if (isArrayAccess !== node.isArray) {
          return { status: "unresolved", failedSegment: attribute };
        }

        breadcrumbs.push({
          name: node.name,
          typeReference: node.typeReference,
          isArray: node.isArray,
        });
        const isLastSegment = i === segments.length - 1;

        if (isLastSegment) {
          return {
            status: "valid",
            breadcrumbs,
            typeReference: node.typeReference,
            isArray: node.isArray,
          };
        }

        if (node.isPrimitive) {
          // Path keeps going past a leaf field — there's nothing further to resolve into.
          return { status: "unresolved", failedSegment: segments[i + 1]!.attribute };
        }

        walked.push(attribute);
        let children = node.children;
        if (children === undefined) {
          try {
            children = await expandNodeAsync(rootSection, [...walked], node.typeReference, i + 1);
          } catch {
            return { status: "load-failure" };
          }
        }
        if (children.length === 1 && children[0]?.attribute === "__error__") {
          return { status: "load-failure" };
        }
        nodes = children;
      }

      return { status: "unresolved", failedSegment: "" };
    },
    [
      mode,
      expandNodeAsync,
      fetchDataModel,
      resolvedCode,
      isResolvingSchema,
      eventDataLoading,
      customerLoading,
      error,
    ]
  );

  const isLoading = eventDataLoading || customerLoading || !!isResolvingSchema;

  return {
    eventDataNodes,
    eventTargetNodes,
    customerNodes,
    expandNode,
    expandNodeAsync,
    resolvePath,
    isLoading,
    error,
    mode,
    hasSchemaSource,
    hasEventType,
  };
}
