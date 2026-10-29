/**
 * Client-side auth provider using WorkOS AuthKit React
 * For Hub SPAs and client-side authentication
 */

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { AuthOrganization, AuthState, AuthUser } from "../types/session";

/**
 * Auth context value
 */
interface AuthContextValue extends AuthState {
  /** Sign in - redirects to WorkOS */
  signIn: (returnTo?: string) => Promise<void>;
  /** Sign out - clears session and redirects */
  signOut: () => Promise<void>;
  /** Get current access token */
  getAccessToken: () => Promise<string>;
  /** Switch organization */
  switchOrganization: (organizationId: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Props for LoomAuthProvider
 */
interface LoomAuthProviderProps {
  children: ReactNode;
  /** Dashboard URL for handoff exchange */
  dashboardUrl?: string;
  /** Initial auth state (from SSR or handoff) */
  initialState?: Partial<AuthState>;
}

/**
 * Auth provider for Hub SPAs
 * Wraps WorkOS AuthKit and handles handoff token exchange
 */
export function LoomAuthProvider({ children, dashboardUrl, initialState }: LoomAuthProviderProps) {
  const [state, setState] = useState<AuthState>({
    user: initialState?.user ?? null,
    organization: initialState?.organization ?? null,
    isLoading: initialState?.user ? false : true,
    isAuthenticated: !!initialState?.user,
    error: undefined,
  });

  // Check for handoff token on mount
  useEffect(() => {
    const checkHandoff = async () => {
      const params = new URLSearchParams(window.location.search);
      const handoffToken = params.get("handoff");

      if (handoffToken && dashboardUrl) {
        try {
          // Exchange handoff token
          const response = await fetch(`${dashboardUrl}/api/auth/exchange`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              handoffToken,
              targetOrigin: window.location.origin,
            }),
          });

          if (response.ok) {
            const data = await response.json();
            // Store tokens (implementation depends on your storage strategy)
            // For now, we'll just update state
            setState({
              user: {
                ...data.user,
                externalId: data.externalId,
              },
              organization: {
                id: data.idpOrganizationId,
                organizationEnvironmentId: data.organizationEnvironmentId,
              },
              isLoading: false,
              isAuthenticated: true,
            });

            // Clean up URL
            const url = new URL(window.location.href);
            url.searchParams.delete("handoff");
            window.history.replaceState({}, "", url.toString());
            return;
          }
        } catch (error) {
          console.error("Handoff exchange failed:", error);
        }
      }

      // No handoff or exchange failed - check existing auth
      setState((s) => ({ ...s, isLoading: false }));
    };

    checkHandoff();
  }, [dashboardUrl]);

  const signIn = useCallback(async (returnTo?: string) => {
    // Will be implemented with AuthKit
    const url = new URL("/api/auth/login", window.location.origin);
    if (returnTo) {
      url.searchParams.set("returnTo", returnTo);
    }
    window.location.href = url.toString();
  }, []);

  const signOut = useCallback(async () => {
    // Will be implemented with AuthKit
    window.location.href = "/api/auth/logout";
  }, []);

  const getAccessToken = useCallback(async (): Promise<string> => {
    // Will be implemented with AuthKit
    throw new Error("Not implemented - use AuthKit getAccessToken");
  }, []);

  const switchOrganization = useCallback(async (organizationId: string) => {
    // TODO: Will be implemented with AuthKit
    console.warn("switchOrganization not yet implemented:", organizationId);
  }, []);

  const value: AuthContextValue = {
    ...state,
    signIn,
    signOut,
    getAccessToken,
    switchOrganization,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Hook to access auth context
 */
export function useLoomAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useLoomAuth must be used within LoomAuthProvider");
  }
  return context;
}

/**
 * Hook to get current user (throws if not authenticated)
 */
export function useRequireAuth(): {
  user: AuthUser;
  organization: AuthOrganization | null;
} {
  const { user, organization, isLoading, signIn } = useLoomAuth();

  useEffect(() => {
    if (!isLoading && !user) {
      signIn(window.location.pathname);
    }
  }, [isLoading, user, signIn]);

  if (!user) {
    throw new Error("User not authenticated");
  }

  return { user, organization };
}
