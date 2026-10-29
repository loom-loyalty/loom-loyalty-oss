/**
 * Field Type Registry
 */
export {
  ENTITY_PREFIX_MAP,
  entityCodeFromIdExample,
  entityCodeFromIdValue,
} from "./entity-prefixes.js";
export {
  DEFAULT_FIELD_TYPE_REGISTRY,
  createFieldTypeRegistry,
  fieldToUIConfig,
  getFieldTypeMapping,
} from "./field-types.js";
export { resolveTypeReference, type ResolvedTypeReference } from "./type-references.js";
