import { createContext, useContext, type ReactNode } from "react";
import { useTinybirdToken } from "./hooks/use-tinybird-token";
import type { AnalyticsTokenResponse, TinybirdTokenState } from "./types";

const TinybirdContext = createContext<TinybirdTokenState | null>(null);

interface TinybirdProviderProps {
  children: ReactNode;
  fetchToken: () => Promise<AnalyticsTokenResponse>;
}

export function TinybirdProvider({ children, fetchToken }: TinybirdProviderProps): ReactNode {
  const state = useTinybirdToken(fetchToken);
  return <TinybirdContext.Provider value={state}>{children}</TinybirdContext.Provider>;
}

export function useTinybird(): TinybirdTokenState {
  const context = useContext(TinybirdContext);
  if (!context) {
    throw new Error("useTinybird must be used within a TinybirdProvider");
  }
  return context;
}
