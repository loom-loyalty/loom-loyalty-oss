"use client";

import { createContext, useContext } from "react";

/** What the chat calls the assistant: in its title, and in shorter running text. */
export interface AssistantName {
  /** The title, e.g. "Weave AI". */
  title: string;
  /** In running text such as "How can Weave help?". */
  short: string;
}

export const WEAVE_ASSISTANT_NAME: AssistantName = { title: "Weave AI", short: "Weave" };

/**
 * The assistant's name on a white-label brand's host is "<Brand> AI";
 * anywhere else it is Weave.
 */
export function assistantNameFor(brandName: string | undefined): AssistantName {
  if (!brandName) return WEAVE_ASSISTANT_NAME;
  const title = `${brandName} AI`;
  return { title, short: title };
}

export const AssistantNameContext = createContext<AssistantName>(WEAVE_ASSISTANT_NAME);

export const useAssistantName = (): AssistantName => useContext(AssistantNameContext);
