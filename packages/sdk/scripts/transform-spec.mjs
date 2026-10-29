import breakPolymorphicCycles from "./break-polymorphic-cycles.mjs";
import dropErrorResponseBodies from "./drop-error-response-bodies.mjs";

/** The Orval input transformer: every spec rewrite generation needs, in order. */
export default function transformSpec(spec) {
  return dropErrorResponseBodies(breakPolymorphicCycles(spec));
}
