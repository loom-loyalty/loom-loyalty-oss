import { createContext, type ReactNode, useContext } from "react";

import type { AiLimitConfig, ChatAiLimitState } from "./types";

const AiLimitConfigContext = createContext<AiLimitConfig>({});

/**
 * Supplies the upgrade link (and optionally a router link renderer) to every
 * `AiLimitNotice` below it, so apps set it once at the root.
 */
export function AiLimitProvider({
  upgradeHref,
  renderLink,
  children,
}: AiLimitConfig & { children: ReactNode }): ReactNode {
  return (
    <AiLimitConfigContext.Provider value={{ upgradeHref, renderLink }}>
      {children}
    </AiLimitConfigContext.Provider>
  );
}

/** The nearest `AiLimitProvider` settings (empty outside one). */
export function useAiLimitConfig(): AiLimitConfig {
  return useContext(AiLimitConfigContext);
}

/** Set by `AiChatPanel`; read by `LoomComposer`. Null outside the panel. */
export const ChatAiLimitContext = createContext<ChatAiLimitState | null>(null);
