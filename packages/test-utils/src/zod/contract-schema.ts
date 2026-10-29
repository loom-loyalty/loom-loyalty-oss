/**
 * Shared helpers for L5 contract specs: derive a runtime Zod from
 * `/data-models/by-code/{ENTITY_CODE}` elements at parse time.
 *
 * Each entity's contract spec duplicated the same `RuntimeElement` type +
 * `fieldNameOf` + `zodFromElement` mapping; this module is the single source
 * of truth. Spec-specific deviations (e.g., METADATA spec's tighter
 * `z.string()` for METADATA fields, OFFER spec's extra `typeReference`
 * branches) are handled via the options arg — pure extraction, no semantic
 * change versus the prior inline copies.
 */

import { z } from "zod";

import { localizedString } from "./refinements.js";

/** A single element from `/data-models/by-code/{ENTITY_CODE}` `.elements[]`. */
export interface RuntimeElement {
  outputAttribute?: string;
  inputAttribute?: string;
  typeReference: string;
  required?: boolean;
  array?: boolean;
  jsonSchema?: { enum?: string[] };
}

/** Read an element's field name from outputAttribute, falling back to inputAttribute. */
export function fieldNameOf(el: RuntimeElement): string | null {
  return el.outputAttribute ?? el.inputAttribute ?? null;
}

/** Options that let individual contract specs override default type mapping. */
export interface ZodFromElementOptions {
  /**
   * If true, METADATA elements map to a bare `z.string()` instead of the
   * default `z.union([z.string(), z.record(z.string(), z.unknown())])`.
   * METADATA's own contract spec opts in because METADATA records hold
   * other metadata FKs as code strings, not embedded objects.
   */
  metadataAsString?: boolean;
  /**
   * Per-typeReference overrides for callers that need a different shape than
   * the default. The override receives the element so it can branch on
   * `el.array`, `el.required`, etc. itself — return the *inner* schema before
   * the array/required wrapping, which the helper applies on top.
   */
  typeOverrides?: Record<string, (el: RuntimeElement) => z.ZodTypeAny>;
}

/** Map a single runtime element to a permissive Zod schema for `.parse()`. */
export function zodFromElement(
  el: RuntimeElement,
  options: ZodFromElementOptions = {}
): z.ZodTypeAny {
  const override = options.typeOverrides?.[el.typeReference];
  let inner: z.ZodTypeAny;
  if (override) {
    inner = override(el);
  } else {
    switch (el.typeReference) {
      case "STRING":
      case "ENTITY_ID":
        inner = z.string();
        break;
      case "BOOLEAN":
        inner = z.boolean();
        break;
      case "NUMBER":
      case "DECIMAL":
      case "INTEGER":
        inner = z.number();
        break;
      case "DATE_TIME":
      case "DATE":
        inner = z.string();
        break;
      case "LOCALIZED_STRING":
        inner = localizedString;
        break;
      case "METADATA":
        inner = options.metadataAsString
          ? z.string()
          : z.union([z.string(), z.record(z.string(), z.unknown())]);
        break;
      case "DATE_TIME_PERIOD":
        inner = z
          .object({
            startDateTime: z.string().optional(),
            endDateTime: z.string().optional(),
          })
          .partial();
        break;
      default:
        inner = z.unknown();
    }
  }
  if (el.array) {
    inner = z.array(inner);
  }
  return el.required ? inner : inner.optional();
}
