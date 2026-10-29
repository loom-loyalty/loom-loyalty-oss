/**
 * Shared event-action surface support: what activities an operator surface
 * offers, which of them a care agent may be offered, and what an activity's
 * payload looks like.
 *
 * Two consumers are known (the hub care surface and a later dashboard
 * developer surface) and the open-source boundary rules out hosting shared
 * code in either app, so this lives in core from the start.
 */

export {
  CATALOGUE_SIZE,
  ENGINE_ANNOUNCED_ACTIVITY_CODES,
  LIFECYCLE_ACTIVITY_CODES,
  OFFERABLE_PLATFORM_ACTIVITY_CODES,
  SHEET_SERVED_ACTIVITY_CODES,
  isCareOfferableActivity,
  isEngineAnnouncedActivity,
} from "./care-eligibility";

export {
  surfacesWith,
  surfacesWithout,
  useRegistrySurfaces,
  type UseRegistrySurfacesResult,
} from "./registry-surfaces";

export {
  extractDataModelCode,
  useActivityDataModel,
  type UseActivityDataModelResult,
} from "./resolve-activity-data-model";

export {
  useEventTypeActions,
  type UseEventTypeActionsOptions,
  type UseEventTypeActionsResult,
} from "./use-event-type-actions";
