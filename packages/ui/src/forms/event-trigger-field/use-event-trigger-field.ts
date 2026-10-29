/**
 * Wraps `useEventTypeField` with the one extra thing the trigger field needs:
 * the distinct `eventSubTypeIdentifier` values for a given event type code, so
 * the sub-type sub-picker (KTD3) has something to list. `useEventTypeField`
 * itself dedupes by event type code, deliberately discarding that detail.
 */

import { useCallback } from "react";

import {
  useEventTypeField,
  type UseEventTypeFieldReturn,
} from "../event-type-field/use-event-type-field.js";

export interface UseEventTriggerFieldReturn extends UseEventTypeFieldReturn {
  /** Distinct sub-type identifiers configured for an event type code; "" represents the default (no sub-type) variant. */
  getSubTypesFor: (eventTypeCode: string) => string[];
}

export function useEventTriggerField(): UseEventTriggerFieldReturn {
  const eventTypeField = useEventTypeField();
  const { eventTypeConfigurations } = eventTypeField;

  const getSubTypesFor = useCallback(
    (eventTypeCode: string): string[] => {
      const seen = new Set<string>();
      for (const configuration of eventTypeConfigurations) {
        const code = configuration.eventTypeCode ?? configuration.eventType?.code;
        if (code !== eventTypeCode) continue;
        seen.add(configuration.eventSubTypeIdentifier ?? "");
      }
      return Array.from(seen);
    },
    [eventTypeConfigurations]
  );

  return { ...eventTypeField, getSubTypesFor };
}
