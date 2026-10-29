/**
 * WorkOS REST API client
 * Uses fetch() for Cloudflare Workers compatibility (Option A)
 */

import { WORKOS_API_URL } from "../shared/constants";
import type { AuthUser } from "../types/session";

/**
 * WorkOS configuration
 */
export interface WorkOSConfig {
  apiKey: string;
  clientId: string;
  redirectUri: string;
  /** Overrides WORKOS_API_URL — points requests at a local emulator (e.g. @workos/emulate) instead of production. */
  baseUrl?: string;
}

/**
 * WorkOS User from API response
 */
interface WorkOSUser {
  id: string;
  email: string;
  email_verified: boolean;
  first_name: string | null;
  last_name: string | null;
  profile_picture_url: string | null;
  created_at: string;
  updated_at: string;
  object: "user";
}

/**
 * WorkOS authentication response
 */
interface WorkOSAuthResponse {
  access_token: string;
  refresh_token: string;
  user: WorkOSUser;
  organization_id?: string;
  /** Set when a WorkOS team member started this session by impersonating the user. */
  impersonator?: { email: string; reason?: string | null };
}

/**
 * Error response from WorkOS API
 */
interface WorkOSError {
  error: string;
  error_description?: string;
}

/**
 * Thrown when a WorkOS API call returns a non-ok response. Preserves the
 * HTTP status and WorkOS's own error code (e.g. `invalid_grant`) so callers
 * can distinguish a definitive rejection from WorkOS itself (bad
 * credentials, an invalid/expired/already-used refresh token) from a
 * transient failure — a distinction a plain `Error` can't carry.
 */
export class WorkOSApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string
  ) {
    super(message);
    this.name = "WorkOSApiError";
  }
}

/**
 * Default per-call budget for every WorkOS request below. None of these
 * calls previously had any timeout at all -- a stalled connection to WorkOS
 * (rather than a normal error response) would hang the caller forever, with
 * no recovery path even though callers like the onboarding flow already have
 * a "taking longer than expected, try again" fallback UI that a bounded
 * failure would correctly trigger.
 */
const WORKOS_FETCH_TIMEOUT_MS = 20_000;

async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = WORKOS_FETCH_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Create WorkOS API client
 */
export function createWorkOSClient(config: WorkOSConfig) {
  const { apiKey, clientId, redirectUri } = config;
  const apiUrl = config.baseUrl ?? WORKOS_API_URL;

  /**
   * Make authenticated request to WorkOS API
   */
  async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${apiUrl}${endpoint}`;

    const response = await fetchWithTimeout(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = (await response.json()) as WorkOSError;
      throw new Error(error.error_description || error.error || "WorkOS API error");
    }

    return response.json() as Promise<T>;
  }

  /**
   * Get authorization URL for OAuth flow
   */
  function getAuthorizationUrl(
    params: {
      state?: string;
      organizationId?: string;
      screenHint?: "sign-in" | "sign-up";
      /**
       * Pre-selects the account to authenticate. Standard OIDC, honored by WorkOS and by
       * @workos/emulate. Local e2e depends on it: the emulator signs in as its oldest
       * user when no hint is given, so once a second test user exists every run
       * authenticates as the wrong one and org creation fails with a 503 about the user
       * not being provisioned.
       */
      loginHint?: string;
    } = {}
  ): string {
    const url = new URL(`${apiUrl}/user_management/authorize`);
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("provider", "authkit");

    if (params.state) {
      url.searchParams.set("state", params.state);
    }
    if (params.organizationId) {
      url.searchParams.set("organization_id", params.organizationId);
    }
    if (params.screenHint) {
      url.searchParams.set("screen_hint", params.screenHint);
    }
    if (params.loginHint) {
      url.searchParams.set("login_hint", params.loginHint);
    }

    return url.toString();
  }

  /**
   * Exchange authorization code for tokens
   */
  async function authenticateWithCode(code: string): Promise<{
    accessToken: string;
    refreshToken: string;
    user: AuthUser;
    organizationId?: string;
    impersonator?: { email: string; reason: string | null };
  }> {
    const response = await fetchWithTimeout(`${apiUrl}/user_management/authenticate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: apiKey,
        grant_type: "authorization_code",
        code,
      }),
    });

    if (!response.ok) {
      const error = (await response.json()) as WorkOSError;
      throw new Error(error.error_description || error.error || "Failed to authenticate");
    }

    const data = (await response.json()) as WorkOSAuthResponse;

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      user: mapWorkOSUser(data.user),
      organizationId: data.organization_id,
      ...(data.impersonator?.email
        ? {
            impersonator: {
              email: data.impersonator.email,
              reason: data.impersonator.reason ?? null,
            },
          }
        : {}),
    };
  }

  /**
   * Exchange email/password credentials for tokens (the password grant).
   * Used to establish a session without a browser-driven login flow — e.g.
   * against a local WorkOS emulator in e2e test bootstrap.
   */
  async function authenticateWithPassword(
    email: string,
    password: string
  ): Promise<{
    accessToken: string;
    refreshToken: string;
    user: AuthUser;
    organizationId?: string;
  }> {
    const response = await fetchWithTimeout(`${apiUrl}/user_management/authenticate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: apiKey,
        grant_type: "password",
        email,
        password,
      }),
    });

    if (!response.ok) {
      const error = (await response.json()) as WorkOSError;
      throw new Error(error.error_description || error.error || "Failed to authenticate");
    }

    const data = (await response.json()) as WorkOSAuthResponse;

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      user: mapWorkOSUser(data.user),
      organizationId: data.organization_id,
    };
  }

  /**
   * Refresh access token using refresh token
   */
  async function authenticateWithRefreshToken(
    refreshToken: string,
    organizationId?: string
  ): Promise<{
    accessToken: string;
    refreshToken: string;
    user: AuthUser;
    organizationId?: string;
  }> {
    const body: Record<string, string> = {
      client_id: clientId,
      client_secret: apiKey,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    };

    if (organizationId) {
      body.organization_id = organizationId;
    }

    const response = await fetchWithTimeout(`${apiUrl}/user_management/authenticate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = (await response.json()) as WorkOSError;
      throw new WorkOSApiError(
        error.error_description || error.error || "Failed to refresh token",
        response.status,
        error.error
      );
    }

    const data = (await response.json()) as WorkOSAuthResponse;

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      user: mapWorkOSUser(data.user),
      organizationId: data.organization_id,
    };
  }

  /**
   * Get logout URL
   * Redirects user to WorkOS to end their session
   */
  function getLogoutUrl(sessionId: string, returnTo?: string): string {
    const url = new URL(`${apiUrl}/user_management/sessions/logout`);
    url.searchParams.set("session_id", sessionId);
    if (returnTo) {
      url.searchParams.set("return_to", returnTo);
    }
    return url.toString();
  }

  /**
   * Get user by ID
   */
  async function getUser(userId: string): Promise<AuthUser> {
    const data = await apiRequest<WorkOSUser>(`/user_management/users/${userId}`);
    return mapWorkOSUser(data);
  }

  /**
   * Get an organization by its external_id (the id an external system, e.g.
   * an organization environment record, assigned it on creation). Returns
   * null on a 404 rather than throwing -- unresolved is an expected outcome
   * here, not an error, so this deliberately doesn't use `apiRequest`, which
   * throws on any non-ok status.
   */
  async function getOrganizationByExternalId(externalId: string): Promise<{ id: string } | null> {
    const response = await fetchWithTimeout(
      `${apiUrl}/organizations/external_id/${encodeURIComponent(externalId)}`,
      { headers: { Authorization: `Bearer ${apiKey}` } }
    );
    if (response.status === 404) return null;
    if (!response.ok) {
      throw new Error(`WorkOS organization lookup failed (${response.status})`);
    }
    return (await response.json()) as { id: string };
  }

  return {
    getAuthorizationUrl,
    authenticateWithCode,
    authenticateWithPassword,
    authenticateWithRefreshToken,
    getLogoutUrl,
    getUser,
    getOrganizationByExternalId,
  };
}

/**
 * Map WorkOS user to AuthUser
 */
function mapWorkOSUser(workosUser: WorkOSUser): AuthUser {
  return {
    id: workosUser.id,
    email: workosUser.email,
    emailVerified: workosUser.email_verified,
    firstName: workosUser.first_name ?? undefined,
    lastName: workosUser.last_name ?? undefined,
    profilePictureUrl: workosUser.profile_picture_url ?? undefined,
  };
}

export type WorkOSClient = ReturnType<typeof createWorkOSClient>;
