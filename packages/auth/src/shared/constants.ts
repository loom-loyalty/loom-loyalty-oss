/**
 * Auth constants
 */

/** WorkOS API base URL */
export const WORKOS_API_URL = "https://api.workos.com";

/** WorkOS JWKS endpoint pattern */
export const WORKOS_JWKS_URL = (clientId: string) => `https://api.workos.com/sso/jwks/${clientId}`;

/** Default access token duration in seconds (from WorkOS, typically 5 minutes) */
export const DEFAULT_ACCESS_TOKEN_DURATION = 300;

/** Handoff token expiration in seconds (5 minutes) */
export const HANDOFF_TOKEN_EXPIRY_SECONDS = 300;

/** Session cookie name */
export const SESSION_COOKIE_NAME = "loom_session";

/** Handoff URL parameter name */
export const HANDOFF_PARAM_NAME = "handoff";

/** Auth routes */
export const AUTH_ROUTES = {
  LOGIN: "/api/auth/login",
  LOGOUT: "/api/auth/logout",
  CALLBACK: "/api/auth/callback",
  HANDOFF: "/api/auth/handoff",
  EXCHANGE: "/api/auth/exchange",
} as const;

/** Cookie options for secure session storage */
export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: "Strict" as const,
  path: "/",
  // Max age: 30 days (session can be refreshed within this period)
  maxAge: 30 * 24 * 60 * 60,
};
