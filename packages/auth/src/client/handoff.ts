/**
 * Client-side handoff utilities
 */

import { HANDOFF_PARAM_NAME } from "../shared/constants";

/**
 * Check if current URL has a handoff token
 */
export function hasHandoffToken(): boolean {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  return params.has(HANDOFF_PARAM_NAME);
}

/**
 * Get handoff token from URL
 */
export function getHandoffToken(): string | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  return params.get(HANDOFF_PARAM_NAME);
}

/**
 * Clear handoff token from URL without page reload
 */
export function clearHandoffToken(): void {
  if (typeof window === "undefined") return;

  const url = new URL(window.location.href);
  url.searchParams.delete(HANDOFF_PARAM_NAME);
  window.history.replaceState({}, "", url.toString());
}

/**
 * Response from handoff token exchange
 */
export interface HandoffExchangeResponse {
  /** User information from WorkOS */
  user: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
    profilePictureUrl?: string;
  };
  /** WorkOS Organization ID */
  idpOrganizationId: string;
  /** Loom Organization Environment ID */
  organizationEnvironmentId: string;
  /** Loom User ID (external_id in WorkOS) */
  externalId: string;
  /** WorkOS access token (JWT) — pre-authenticated for seamless handoff */
  accessToken?: string;
  /** Access token expiry in seconds from epoch */
  accessTokenExpiresAt?: number;
}

/**
 * Exchange handoff token for session
 */
export async function exchangeHandoffToken(
  dashboardUrl: string,
  handoffToken: string
): Promise<HandoffExchangeResponse> {
  const response = await fetch(`${dashboardUrl}/api/auth/exchange`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      handoffToken,
      targetOrigin: window.location.origin,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to exchange handoff token");
  }

  return response.json();
}

/**
 * Handle handoff on app initialization
 * Returns session data if handoff was successful, null otherwise
 */
export async function handleHandoffOnInit(
  dashboardUrl: string
): Promise<Awaited<ReturnType<typeof exchangeHandoffToken>> | null> {
  const token = getHandoffToken();
  if (!token) return null;

  try {
    const session = await exchangeHandoffToken(dashboardUrl, token);
    clearHandoffToken();
    return session;
  } catch (error) {
    console.error("Handoff exchange failed:", error);
    clearHandoffToken();
    return null;
  }
}
