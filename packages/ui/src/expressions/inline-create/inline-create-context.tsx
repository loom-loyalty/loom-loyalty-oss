/**
 * Inline create context (pickers brief): what a picker inside a rule or flow
 * needs to offer "+ New …" and a Suggested default without the user leaving
 * the sheet. A surface that sets no provider keeps today's pickers.
 */

import { createContext, useContext, type ReactNode } from "react";

/** A preselected pick the user has not touched yet, as the Checks panel lists it. */
export interface InlineSuggestion {
  /** The picked record's id, so the sheet can drop the line once no action names it. */
  id: string;
  /** The picked record's name. */
  label: string;
  /** What kind of record it is, for example "Target". */
  entityLabel: string;
}

export interface InlineCreateContextValue {
  /** The rule's (or flow's) programs: new records join them, and a suggestion must sit in all of them. */
  ruleProgramIds: readonly string[];
  /** True for a new rule. An existing rule opened for edit never gets a suggestion (S15). */
  isNewRule: boolean;
  /** The organization's IANA zone, where a daily or weekly limit resets. */
  organizationTimeZone?: string;
  /** The activity (event type code) the rule is triggered by. */
  triggerEventTypeCode?: string;
  /** Called with a picker's untouched suggestion, or null once it is gone (S5). */
  onSuggestionChange?: (fieldKey: string, suggestion: InlineSuggestion | null) => void;
}

const InlineCreateContext = createContext<InlineCreateContextValue | null>(null);

export function InlineCreateProvider({
  value,
  children,
}: {
  value: InlineCreateContextValue;
  children: ReactNode;
}): ReactNode {
  return <InlineCreateContext.Provider value={value}>{children}</InlineCreateContext.Provider>;
}

/** The surrounding inline create context, or null outside a rule or flow. */
export function useInlineCreate(): InlineCreateContextValue | null {
  return useContext(InlineCreateContext);
}
