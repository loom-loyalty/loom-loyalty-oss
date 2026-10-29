"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";

export interface OpenUIRuntimeConfig {
  baseUrl: string;
  getToken?: () => Promise<string>;
  credentials?: RequestCredentials;
}

const OpenUIRuntimeContext = createContext<OpenUIRuntimeConfig | null>(null);

export interface OpenUIRuntimeProviderProps extends OpenUIRuntimeConfig {
  children: ReactNode;
}

export function OpenUIRuntimeProvider({
  baseUrl,
  getToken,
  credentials,
  children,
}: OpenUIRuntimeProviderProps) {
  // Memoize so consumers don't re-render on every provider render.
  const value = useMemo(
    () => ({ baseUrl, getToken, credentials }),
    [baseUrl, getToken, credentials]
  );
  return <OpenUIRuntimeContext.Provider value={value}>{children}</OpenUIRuntimeContext.Provider>;
}

export function useOpenUIRuntime(): OpenUIRuntimeConfig | null {
  return useContext(OpenUIRuntimeContext);
}
