/**
 * Session types for WorkOS authentication
 */

/**
 * User information from WorkOS JWT
 */
export interface AuthUser {
  /** WorkOS user ID */
  id: string;
  /** Loom user ID (populated after onboarding via externalId claim) */
  externalId?: string;
  /** User's email address */
  email: string;
  /** User's first name */
  firstName?: string;
  /** User's last name */
  lastName?: string;
  /** User's profile picture URL */
  profilePictureUrl?: string;
  /** Whether email is verified */
  emailVerified?: boolean;
  /** User's timezone (e.g., "America/New_York") */
  timezone?: string;
  /** User's preferred language (e.g., "en", "es", "fr") */
  language?: string;
}

/**
 * Organization information
 */
export interface AuthOrganization {
  /** WorkOS Organization ID (idpOrganizationId) */
  id: string;
  /** Loom Organization Environment ID (optional, resolved from IDP endpoint) */
  organizationEnvironmentId?: string;
  /** Loom Organization ID (optional, resolved from IDP endpoint) */
  organizationId?: string;
  /** Organization name */
  name?: string;
}

/**
 * Session data stored in encrypted cookie (server-side)
 */
export interface SessionData {
  /** WorkOS access token (JWT) */
  accessToken: string;
  /** WorkOS refresh token for token refresh */
  refreshToken: string;
  /** User information */
  user: AuthUser;
  /** WorkOS Organization ID from JWT org_id claim */
  idpOrganizationId?: string;
  /** Session ID from JWT sid claim */
  sessionId?: string;
  /** Access token expiration timestamp (Unix seconds, from JWT exp claim) */
  accessTokenExpiresAt: number;
  /** Session creation timestamp (Unix ms) */
  createdAt: number;
  /** Session last updated timestamp (Unix ms) */
  updatedAt: number;
}

/**
 * JWT claims from WorkOS access token
 */
export interface WorkOSJWTClaims {
  /** User ID */
  sub: string;
  /** Session ID */
  sid: string;
  /** Issuer */
  iss: string;
  /** Organization ID (if org-scoped) */
  org_id?: string;
  /** Role within organization */
  role?: string;
  /** Permissions array */
  permissions?: string[];
  /** Token expiration (Unix seconds) */
  exp: number;
  /** Token issued at (Unix seconds) */
  iat: number;
  /** External ID - Loom user ID (custom claim from JWT template) */
  user_external_id?: string;
  /** User's timezone (custom claim from JWT template) */
  user_timezone?: string;
  /** User's preferred language (custom claim from JWT template) */
  user_language?: string;
}

/**
 * Auth state for client-side consumption
 */
export interface AuthState {
  /** Current user or null if not authenticated */
  user: AuthUser | null;
  /** Current organization context */
  organization: AuthOrganization | null;
  /** Whether auth state is loading */
  isLoading: boolean;
  /** Whether user is authenticated */
  isAuthenticated: boolean;
  /** Error message if any */
  error?: string;
}
