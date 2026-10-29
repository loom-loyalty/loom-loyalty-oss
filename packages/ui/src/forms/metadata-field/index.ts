/**
 * MetadataField - Pre-wired Metadata Selection Component
 *
 * Exports the MetadataField component, useMetadataField hook,
 * and centralized suggested options.
 */

export { MetadataField, type MetadataFieldProps } from "./metadata-field";

export {
  useMetadataField,
  type AnyCreatePayload,
  type UseMetadataFieldReturn,
} from "./use-metadata-field";

export {
  SUGGESTED_BADGE_TYPES,
  SUGGESTED_COMPLETION_TARGET_TYPES,
  SUGGESTED_COUNTER_TARGET_TYPES,
  SUGGESTED_CURRENCY_TYPES,
  SUGGESTED_CUSTOMER_ENROLLMENTS,
  SUGGESTED_CUSTOMER_FRAUD_STATUSES,
  SUGGESTED_CUSTOMER_STATUSES,
  SUGGESTED_EVENT_TYPES,
  SUGGESTED_GENDERS,
  SUGGESTED_MILESTONE_TARGET_TYPES,
  SUGGESTED_OPTIONS_MAP,
  SUGGESTED_PARTNER_TYPES,
  SUGGESTED_PROGRAM_TYPES,
  SUGGESTED_TIER_TYPES,
  SUGGESTED_XOFY_TARGET_TYPES,
} from "./suggested-options";
