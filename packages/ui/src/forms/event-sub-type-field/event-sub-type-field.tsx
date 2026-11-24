/**
 * EventSubTypeField — picks an event's sub type from the records it names.
 *
 * For an event type with a `subTypeSource` (target.achieved names a target),
 * this lists that source's records by name and stores the record's code, which
 * is what the event carries. "Any {record}" (the default) stores nothing, so a
 * rule runs for every event of the type.
 *
 * A stored code that no record has (old free text, a deleted target, a
 * different case) stays as it is, shown with a "not found" note, until the
 * person picks something else.
 */

"use client";

import { useId, type ReactNode } from "react";

import { EntitySelectBox, type EntityOption } from "../entity-select-box";
import { EVENT_SUB_TYPE_SOURCE_LABELS, type EventSubTypeSource } from "./sub-type-sources";
import { useEventSubTypeOptions } from "./use-event-sub-type-options";

/** EntitySelectBox can't hold "" as an option id; this stands in for "Any". */
export const ANY_SUB_TYPE_OPTION_ID = "__any_sub_type__";

export interface EventSubTypeFieldProps {
  source: EventSubTypeSource;
  /** The stored sub type code; "" means any. */
  value: string;
  onValueChange: (code: string) => void;
  disabled?: boolean;
  id?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function EventSubTypeField({
  source,
  value,
  onValueChange,
  disabled,
  id,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy,
}: EventSubTypeFieldProps): ReactNode {
  const label = EVENT_SUB_TYPE_SOURCE_LABELS[source];
  const field = useEventSubTypeOptions(source, value);

  const anyOption: EntityOption = { id: ANY_SUB_TYPE_OPTION_ID, name: `Any ${label}` };
  const isMissing = Boolean(value) && field.isValueMissing === true;
  // A stored code with no record on hand still shows as itself: marked "not found" once a lookup
  // says no record has it, plain while that is unknown (a lookup in flight or failed, or a coupon
  // code, which can't be looked up), so a picked value never reads as "Any".
  const storedOption: EntityOption | undefined =
    value && !field.valueRecord
      ? { id: value, name: value, ...(isMissing ? { secondaryText: "not found" } : {}) }
      : undefined;

  // Hide "Any" while a search is typed: it isn't a record the search can match.
  const options = field.searchValue.trim() ? field.options : [anyOption, ...field.options];
  const lookupOptions = [anyOption, ...field.optionsAll, ...(storedOption ? [storedOption] : [])];
  const autoId = useId();
  const noteId = `${id ?? autoId}-not-found`;

  return (
    <div className="space-y-1">
      <EntitySelectBox
        entityLabel={capitalize(label)}
        entityType="EVENT_SUB_TYPE"
        id={id}
        options={options}
        lookupOptions={lookupOptions}
        value={value || ANY_SUB_TYPE_OPTION_ID}
        onValueChange={(picked) => onValueChange(picked === ANY_SUB_TYPE_OPTION_ID ? "" : picked)}
        isLoading={field.isLoading}
        error={field.error ? field.error.message : null}
        disabled={disabled}
        placeholder={`Any ${label}`}
        searchValue={field.searchValue}
        onSearchChange={field.setSearchValue}
        hasNextPage={field.hasNextPage}
        isFetchingNextPage={field.isFetchingNextPage}
        onLoadMore={field.fetchNextPage}
        aria-invalid={ariaInvalid}
        aria-describedby={
          [ariaDescribedBy, isMissing ? noteId : undefined].filter(Boolean).join(" ") || undefined
        }
      />
      {isMissing && (
        <p id={noteId} className="text-warning-dark text-xs" role="status">
          No {label} has the code “{value}”. It stays as it is until you pick another.
        </p>
      )}
    </div>
  );
}
