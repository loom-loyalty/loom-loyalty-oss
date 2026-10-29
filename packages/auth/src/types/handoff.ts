/**
 * Token handoff types for Dashboard → Hub navigation
 */

/**
 * Handoff token payload (signed JWT)
 * Used for secure cross-app navigation from Dashboard to Hub
 */
export interface HandoffTokenPayload {
  /** WorkOS User ID */
  sub: string;
  /** Loom User ID (from user.externalId) */
  external_id: string;
  /** WorkOS Organization ID (for WorkOS API calls) */
  idp_org_id: string;
  /** Loom Organization Environment ID (for Loom API calls) */
  org_env_id: string;
  /** Target hub origin (e.g., "hub.customer.com") */
  target: string;
  /** Source session ID for audit trail */
  source_sid: string;
  /** Unique token ID for single-use enforcement */
  jti: string;
  /** Token issued at (Unix seconds) */
  iat: number;
  /** Token expiration (Unix seconds) - typically 5 minutes */
  exp: number;
}

/**
 * Request to generate a handoff token
 */
export interface GenerateHandoffRequest {
  /**
   * Target hub URL. Can be a full URL with path (e.g., "https://acme.weave.host/programs/setup")
   * or just an origin (e.g., "https://acme.weave.host"). The redirect URL is constructed by
   * appending `?handoff=<token>` to this value, so include the path to preserve it.
   */
  targetHub: string;
  /** Optional: specific organization environment to target */
  organizationEnvironmentId?: string;
}

/**
 * Response from handoff token generation
 */
export interface GenerateHandoffResponse {
  /** Signed handoff token (JWT) */
  token: string;
  /** Full redirect URL including token parameter */
  redirectUrl: string;
  /** Token expiration timestamp (ISO 8601) */
  expiresAt: string;
}

/**
 * Request to exchange a handoff token for session
 */
export interface ExchangeHandoffRequest {
  /** The handoff token received via URL parameter */
  handoffToken: string;
  /** Origin of the requesting hub (for validation) */
  targetOrigin: string;
}

/**
 * Response from handoff token exchange
 */
export interface ExchangeHandoffResponse {
  /** WorkOS access token for the Hub */
  accessToken: string;
  /** WorkOS refresh token for the Hub */
  refreshToken: string;
  /** User information */
  user: {
    id: string;
    externalId?: string;
    email: string;
    firstName?: string;
    lastName?: string;
  };
  /** Organization context */
  organization: {
    idpOrganizationId: string;
    organizationEnvironmentId: string;
  };
  /** Access token expiration timestamp (ISO 8601) */
  expiresAt: string;
}

/**
 * Error response from handoff operations
 */
export interface HandoffError {
  /** Error code */
  code:
    | "INVALID_TOKEN"
    | "EXPIRED_TOKEN"
    | "ALREADY_USED"
    | "INVALID_TARGET"
    | "SESSION_NOT_FOUND"
    | "EXCHANGE_FAILED";
  /** Human-readable error message */
  message: string;
}
