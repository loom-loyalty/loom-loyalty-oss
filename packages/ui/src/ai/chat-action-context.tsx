import { createContext, useContext } from "react";

/** A card action the chat doesn't handle itself, passed to the host app. */
export interface AiChatCustomAction {
  type: string;
  params?: Record<string, unknown>;
}

/** Returns true when the host handled the action. Params are LLM output: validate them. */
export type AiChatCustomActionHandler = (action: AiChatCustomAction) => boolean;

export const AiChatActionContext = createContext<AiChatCustomActionHandler | undefined>(undefined);

export function useAiChatCustomAction(): AiChatCustomActionHandler | undefined {
  return useContext(AiChatActionContext);
}
