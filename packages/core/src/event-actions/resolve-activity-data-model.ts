/**
 * Resolves an activity's payload data model: activity code → event-type
 * configuration → linked data model → schema.
 *
 * The linkage is nuanced. An event-type *configuration* carries a resolved
 * `eventType` object whose shape is untyped (`{ [key: string]: unknown }`), and
 * the real schema lives on the linked data model, so the data-model code is
 * dereferenced defensively before fetching the schema. Resolution is an
 * enhancement, never a hard dependency: when the linkage cannot be resolved the
 * caller renders no detail fields rather than erroring.
 *
 * Ported from `apps/dashboard/src/routes/developers/-webhooks.event-schema.ts`,
 * which keeps its own copy for now. Its conversion to this module is deferred
 * follow-up work.
 */

import {
  useDataModelManagementGetDataModelSchemaByCode,
  useEventEngineManagementGetEventTypeConfigurationByType,
  type EventTypeConfiguration,
} from "@loom-loyalty/sdk";

/**
 * Pull the linked data-model code off the opaque resolved event-type object.
 *
 * Handles all three shapes the configuration has been observed to carry: a
 * nested reference object (`dataModel.code` / `dataModel.dataModelCode`), a
 * plain string `dataModel`, and a flat `dataModelCode` on the event type
 * itself.
 */
export function extractDataModelCode(
  config: EventTypeConfiguration | undefined
): string | undefined {
  const eventType = config?.eventType as Record<string, unknown> | undefined;
  if (!eventType) return undefined;

  const dataModel = eventType.dataModel;
  if (typeof dataModel === "string") return dataModel;
  if (dataModel && typeof dataModel === "object") {
    const ref = dataModel as Record<string, unknown>;
    if (typeof ref.code === "string") return ref.code;
    if (typeof ref.dataModelCode === "string") return ref.dataModelCode;
  }
  // Fall back to a flat code on the event type itself.
  return typeof eventType.dataModelCode === "string" ? eventType.dataModelCode : undefined;
}

export interface UseActivityDataModelResult {
  /** The activity's payload schema, or undefined when unresolved. */
  schema: unknown | undefined;
  /** The resolved data-model code, for callers that fetch elements themselves. */
  dataModelCode: string | undefined;
  isLoading: boolean;
}

/** Resolve an activity's payload schema (configuration → data model → schema). */
export function useActivityDataModel(activityCode: string | undefined): UseActivityDataModelResult {
  const { data: configResponse, isLoading: configLoading } =
    useEventEngineManagementGetEventTypeConfigurationByType(activityCode ?? "", undefined, {
      query: { enabled: !!activityCode },
    });
  const config = configResponse?.data as EventTypeConfiguration | undefined;
  const dataModelCode = extractDataModelCode(config);

  const { data: schemaResponse, isLoading: schemaLoading } =
    useDataModelManagementGetDataModelSchemaByCode(dataModelCode ?? "", {
      query: { enabled: !!dataModelCode },
    });

  return {
    schema: schemaResponse?.data,
    dataModelCode,
    isLoading: (!!activityCode && configLoading) || (!!dataModelCode && schemaLoading),
  };
}
