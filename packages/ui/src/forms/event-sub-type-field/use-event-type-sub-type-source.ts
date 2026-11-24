/**
 * Reads what an event type's sub type names (`subTypeSource`) straight from
 * the platform, by the event type's code. It reads over HTTP rather than from
 * any cached resolver, so a system event type always shows the source the
 * platform gives it.
 *
 * The read is a data-type lookup, so it runs only when the caller may read
 * metadata entries (`useMetadataReadAccess().entries`).
 *
 * Returns `undefined` when the type has no source, when the caller can't read it, while it loads, when the
 * read fails, or when the source is one this release doesn't know. The caller
 * then keeps the free-text sub type.
 */

import { useMetadataManagementGetDataTypeByTypeAndCode } from "@loom-loyalty/sdk";

import { useMetadataReadAccess } from "../metadata-field/metadata-read-access";
import { toEventSubTypeSource, type EventSubTypeSource } from "./sub-type-sources";

/** The metadata type code of event types. */
export const EVENT_TYPE_DATA_TYPE = "EVENT_TYPE";

export interface UseEventTypeSubTypeSourceReturn {
  source: EventSubTypeSource | undefined;
  isLoading: boolean;
}

export function useEventTypeSubTypeSource(
  eventTypeCode: string | undefined
): UseEventTypeSubTypeSourceReturn {
  const access = useMetadataReadAccess();
  const enabled = Boolean(eventTypeCode) && access.entries;
  const query = useMetadataManagementGetDataTypeByTypeAndCode(
    EVENT_TYPE_DATA_TYPE,
    eventTypeCode ?? "",
    { query: { enabled, staleTime: 5 * 60 * 1000, retry: false } }
  );
  const dataType = query.data?.data;
  return {
    source: enabled ? toEventSubTypeSource(dataType?.subTypeSource) : undefined,
    isLoading: enabled && query.isLoading,
  };
}
