/**
 * AuthProvider Interface
 * Abstracts authentication and authorization
 */

/**
 * User information from the auth provider
 */
export interface AuthUser {
  /** Unique user identifier */
  id: string;
  /** User's email address */
  email: string;
  /** User's display name */
  displayName?: string;
  /** User's profile picture URL */
  avatarUrl?: string;
  /** User's first name */
  firstName?: string;
  /** User's last name */
  lastName?: string;
  /** Custom properties */
  properties?: Record<string, unknown>;
}

/**
 * Organization context for multi-tenancy
 */
export interface AuthOrganization {
  /** Organization ID */
  id: string;
  /** Organization name */
  name: string;
  /** Organization slug */
  slug?: string;
}

/**
 * Session information
 */
export interface AuthSession {
  /** Access token for API calls */
  accessToken: string;
  /** Token expiration timestamp (ISO 8601) */
  expiresAt: string;
  /** Whether the session is valid */
  isValid: boolean;
}

/**
 * Permission checking result
 */
export interface PermissionCheckResult {
  /** Whether the permission is granted */
  allowed: boolean;
  /** Reason for denial (if applicable) */
  reason?: string;
}

/**
 * AuthProvider interface - abstracts authentication
 *
 * @public
 * @remarks
 * The default implementation uses WorkOS AuthKit.
 * Custom implementations can integrate any auth provider.
 *
 * @example
 * ```typescript
 * const myAuthProvider: AuthProvider = {
 *   getUser: () => currentUser,
 *   isAuthenticated: () => !!currentUser,
 *   signIn: async () => { window.location.href = '/login'; },
 *   // ... other methods
 * };
 * ```
 */
export interface AuthProvider {
  /**
   * Get the current authenticated user
   * Returns null if not authenticated
   */
  getUser(): AuthUser | null;

  /**
   * Get the current organization context
   * Returns null if no organization selected
   */
  getOrganization(): AuthOrganization | null;

  /**
   * Get the current session
   * Returns null if not authenticated
   */
  getSession(): AuthSession | null;

  /**
   * Get access token for API calls
   * Handles token refresh if needed
   */
  getAccessToken(): Promise<string>;

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean;

  /**
   * Check if user has a specific permission
   * @param permission - Permission string (e.g., 'customer:read', 'reward:delete')
   * @param resource - Optional resource context (e.g., entity ID)
   */
  checkPermission(permission: string, resource?: string): Promise<PermissionCheckResult>;

  /**
   * Check multiple permissions at once
   * @param permissions - Array of permission strings
   */
  checkPermissions(permissions: string[]): Promise<Record<string, PermissionCheckResult>>;

  /**
   * Sign in - redirects to auth provider
   * @param returnTo - URL to return to after authentication
   */
  signIn(returnTo?: string): Promise<void>;

  /**
   * Sign out - clears session and redirects
   */
  signOut(): Promise<void>;

  /**
   * Switch to a different organization
   * @param organizationId - Organization ID to switch to
   */
  switchOrganization(organizationId: string): Promise<void>;

  /**
   * Get list of available organizations for the user
   */
  getOrganizations(): Promise<AuthOrganization[]>;

  /**
   * Subscribe to auth state changes
   * @param callback - Called when auth state changes
   * @returns Unsubscribe function
   */
  onAuthStateChange(callback: (user: AuthUser | null) => void): () => void;
}
