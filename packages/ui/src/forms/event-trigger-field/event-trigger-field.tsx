/**
 * EventTriggerField — dual-mode trigger selection for the event-rule sheet (R7, R8, R9, R16)
 *
 * - Contextual mode ("+ New rule" from an event type's detail page, R7): the
 *   trigger is shown as read-only header/breadcrumb text. No picker for event
 *   type or sub-type ever renders here, regardless of variant count (KTD3) —
 *   the trigger is already fully implied by which variant row opened the sheet.
 * - Global mode (the standalone "New rule" entry point, R8): a full event-type
 *   picker (reusing `EventTypeField`'s query, KTD3) plus a sub-type sub-picker
 *   shown only when the selected event type has more than one variant, plus a
 *   terminal "Add new event type" action (R9) that hands off to the caller —
 *   the inline-create flow itself lives in the app layer (KTD4/KTD9/U8).
 */

"use client";

import type { ReactNode } from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../primitives/select.js";
import { EntitySelectBox } from "../entity-select-box";
import { useEventTriggerField } from "./use-event-trigger-field.js";

export interface EventTriggerValue {
  eventTypeCode: string;
  /** "" (or omitted) means the default, sub-type-less variant. */
  eventSubTypeIdentifier?: string;
}

interface EventTriggerFieldContextualProps {
  mode: "contextual";
  eventTypeCode: string;
  eventTypeName: string;
  eventSubTypeIdentifier?: string;
}

interface EventTriggerFieldGlobalProps {
  mode: "global";
  value: EventTriggerValue | null;
  onValueChange: (value: EventTriggerValue) => void;
  /** "Add new event type" (R9) — the caller owns the inline-create flow itself. */
  onCreateNew?: () => void;
  disabled?: boolean;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
}

export type EventTriggerFieldProps =
  | EventTriggerFieldContextualProps
  | EventTriggerFieldGlobalProps;

/** Radix `Select.Item` rejects an empty-string value — stand in for the default (no sub-type) variant. */
const DEFAULT_SUB_TYPE_SENTINEL = "__default__";

export function EventTriggerField(props: EventTriggerFieldProps): ReactNode {
  if (props.mode === "contextual") {
    return (
      <div className="text-muted-foreground text-sm">
        <span className="text-foreground font-medium">{props.eventTypeName}</span>
        {props.eventSubTypeIdentifier && (
          <span className="ml-1">· {props.eventSubTypeIdentifier}</span>
        )}
      </div>
    );
  }

  return <GlobalEventTriggerPicker {...props} />;
}

function GlobalEventTriggerPicker({
  value,
  onValueChange,
  onCreateNew,
  disabled,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy,
}: EventTriggerFieldGlobalProps): ReactNode {
  const {
    options,
    optionsAll,
    isLoading,
    error,
    searchValue,
    setSearchValue,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    getSubTypesFor,
  } = useEventTriggerField();

  const eventTypeCode = value?.eventTypeCode ?? "";
  const subTypes = eventTypeCode ? getSubTypesFor(eventTypeCode) : [];
  const showSubTypePicker = subTypes.some((subType) => subType !== "");

  return (
    <div className="space-y-3">
      <EntitySelectBox
        entityLabel="Event Type"
        options={options}
        lookupOptions={optionsAll}
        value={eventTypeCode}
        onValueChange={(newEventTypeCode) => {
          onValueChange({ eventTypeCode: newEventTypeCode, eventSubTypeIdentifier: undefined });
        }}
        onCreateNew={onCreateNew}
        isLoading={isLoading}
        error={error ? error.message : null}
        disabled={disabled}
        placeholder="Select an event type..."
        searchValue={searchValue}
        onSearchChange={setSearchValue}
        hasNextPage={hasNextPage}
        isFetchingNextPage={isFetchingNextPage}
        onLoadMore={fetchNextPage}
        aria-invalid={ariaInvalid}
        aria-describedby={ariaDescribedBy}
      />
      {showSubTypePicker && (
        <Select
          value={value?.eventSubTypeIdentifier || DEFAULT_SUB_TYPE_SENTINEL}
          onValueChange={(newSubType) =>
            onValueChange({
              eventTypeCode,
              eventSubTypeIdentifier:
                newSubType === DEFAULT_SUB_TYPE_SENTINEL ? undefined : newSubType,
            })
          }
          disabled={disabled}
        >
          <SelectTrigger aria-label="Sub-type">
            <SelectValue placeholder="Select a sub-type..." />
          </SelectTrigger>
          <SelectContent>
            {subTypes.map((subType) => (
              <SelectItem
                key={subType || DEFAULT_SUB_TYPE_SENTINEL}
                value={subType || DEFAULT_SUB_TYPE_SENTINEL}
              >
                {subType || "Default"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
