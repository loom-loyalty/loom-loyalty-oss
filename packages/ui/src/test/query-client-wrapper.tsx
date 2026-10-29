import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as React from "react";

const TEST_QUERY_CLIENT_DEFAULTS = {
  queries: {
    retry: false,
    gcTime: 0,
    staleTime: 0,
    networkMode: "always" as const,
  },
  mutations: {
    retry: false,
    networkMode: "always" as const,
  },
};

/**
 * Build a fresh QueryClient + Provider for each test. Disables retries so MSW
 * error handlers surface immediately, and disables network-mode so jsdom-only
 * test environments don't gate fetches on a non-existent navigator.onLine.
 */
export function createQueryWrapper(): {
  client: QueryClient;
  Wrapper: React.FC<{ children: React.ReactNode }>;
} {
  const client = new QueryClient({ defaultOptions: TEST_QUERY_CLIENT_DEFAULTS });

  const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );

  return { client, Wrapper };
}

/**
 * Standalone provider component (vs. createQueryWrapper's factory) for
 * consumers that need a plain `{children}` wrapper — e.g. Storybook
 * decorators, preview harnesses — rather than a per-test client handle.
 * Same defaults as createQueryWrapper; each mount gets its own client.
 */
export const QueryTestProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [client] = React.useState(
    () => new QueryClient({ defaultOptions: TEST_QUERY_CLIENT_DEFAULTS })
  );
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
};
