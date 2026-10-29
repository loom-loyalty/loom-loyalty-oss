import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { dataModelCodeKey } from "../entity/features/data-models/code-key.js";
import {
  useExpressionContext,
  type DataModelLike,
  type ExpressionSurfaceMode,
} from "./expression-context.js";
import { isPrimitiveTypeCode, splitArraySuffix } from "./inputs/json-path-parsing.js";
import type { ExpressionAction } from "./types.js";

const CUSTOMER_MODEL_CODE = "customer";

function pathSegments(
  path: string,
  mode: ExpressionSurfaceMode
): { modelCode: string; segments: string[] } | undefined {
  if (!path.startsWith("$.")) return undefined;
  const raw = path
    .slice(2)
    .split(".")
    .map((segment) => splitArraySuffix(segment).attribute)
    .filter(Boolean);
  if (raw.length === 0) return undefined;

  if (mode === "customer") return { modelCode: CUSTOMER_MODEL_CODE, segments: raw };

  const [root, ...segments] = raw;
  if (root === "eventTarget") return { modelCode: CUSTOMER_MODEL_CODE, segments };
  if (root === "eventData") return { modelCode: "", segments };
  return undefined;
}

function actionPaths(actions: ExpressionAction[]): string[] {
  const paths = new Set<string>();
  const visit = (value: unknown, key?: string): void => {
    if (typeof value === "string") {
      if ((key === "path" || key?.endsWith("Path")) && value.startsWith("$.")) paths.add(value);
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((item) => visit(item));
      return;
    }
    if (value && typeof value === "object") {
      Object.entries(value as Record<string, unknown>).forEach(([entryKey, entryValue]) =>
        visit(entryValue, entryKey)
      );
    }
  };
  actions.forEach((action) => visit(action));
  return [...paths];
}

/**
 * Resolves summary-chip paths against the expression schema once per action band.
 * It intentionally owns its small cache rather than sharing `useJsonPathSchema`'s
 * stateful browser cache, so summary rendering cannot affect picker validation.
 */
export function useActionSchemaFieldNames(actions: ExpressionAction[]): {
  fieldName: (path: string) => string | undefined;
} {
  const {
    dataModelCode,
    eventTypeCode,
    fetchDataModel,
    mode: contextMode,
  } = useExpressionContext();
  const mode = contextMode ?? "event";
  const eventDataModelCode = dataModelCode ?? eventTypeCode;
  // `rawPaths` gets a fresh array identity on every render whose `actions`
  // reference changes (e.g. the common `actions ?? []` fallback), even when
  // its content is unchanged. `paths` below re-keys off the content-stable
  // `pathsKey` string instead, so the resolution effect only re-runs when the
  // actual set of paths changes, not on every unrelated re-render
  // (adversarial review finding).
  const rawPaths = useMemo(() => actionPaths(actions), [actions]);
  const pathsKey = rawPaths.join("\u0000");
  const paths = useMemo(() => rawPaths, [pathsKey]);
  // Successes cache permanently (schema shape doesn't change at runtime);
  // failures are evicted so a transient fetch error doesn't permanently
  // disable field-name resolution for that model code (adversarial review
  // finding) — mirrors `use-json-path-schema.ts`'s `fetchModelChildren`.
  const modelCacheRef = useRef<Map<string, Promise<DataModelLike>>>(new Map());
  const inflightRef = useRef<Map<string, Promise<DataModelLike>>>(new Map());
  const [names, setNames] = useState<Map<string, string>>(() => new Map());

  const getModel = useCallback(
    (code: string): Promise<DataModelLike> => {
      if (!fetchDataModel) return Promise.reject(new Error("No schema fetcher configured"));
      // Cache/inflight keys are folded for dedupe; fetchDataModel gets the code
      // verbatim. DataModelType codes are migrating to lowercase-hyphenated
      // resource codes, and .toUpperCase() with no separator normalization
      // turns a multi-segment code like "custom-event" into "CUSTOM-EVENT",
      // which matches neither spelling and 404s.
      const cacheKey = dataModelCodeKey(code);
      const cached = modelCacheRef.current.get(cacheKey);
      if (cached) return cached;
      const inflight = inflightRef.current.get(cacheKey);
      if (inflight) return inflight;
      const request = fetchDataModel(code)
        .then((model) => {
          modelCacheRef.current.set(cacheKey, Promise.resolve(model));
          return model;
        })
        .finally(() => {
          inflightRef.current.delete(cacheKey);
        });
      inflightRef.current.set(cacheKey, request);
      return request;
    },
    [fetchDataModel]
  );

  useEffect(() => {
    let cancelled = false;
    if (!fetchDataModel || paths.length === 0 || (mode === "event" && !eventDataModelCode)) {
      setNames(new Map());
      return;
    }

    const resolvePath = async (path: string): Promise<[string, string] | undefined> => {
      const parsed = pathSegments(path, mode);
      if (!parsed) return undefined;
      const initialCode = parsed.modelCode || eventDataModelCode;
      if (!initialCode) return undefined;

      let model = await getModel(initialCode);
      for (let index = 0; index < parsed.segments.length; index += 1) {
        const attribute = parsed.segments[index]!;
        const element = model.elements.find(
          (candidate) => (candidate.outputAttribute ?? candidate.inputAttribute) === attribute
        );
        if (!element) return undefined;
        if (index === parsed.segments.length - 1) return [path, element.name];
        if (isPrimitiveTypeCode(element.typeReference)) return undefined;
        model = await getModel(element.typeReference);
      }
      return undefined;
    };

    void Promise.all(paths.map((path) => resolvePath(path).catch(() => undefined))).then(
      (resolved) => {
        if (cancelled) return;
        setNames(new Map(resolved.filter((entry): entry is [string, string] => !!entry)));
      }
    );

    return () => {
      cancelled = true;
    };
  }, [eventDataModelCode, fetchDataModel, getModel, mode, paths]);

  return useMemo(() => ({ fieldName: (path: string) => names.get(path) }), [names]);
}
