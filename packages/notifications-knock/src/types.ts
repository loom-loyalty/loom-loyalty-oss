/**
 * The feed settings the Platform API returns for the signed-in user
 * (`GET /auth/me/notification-feed`). Declared here so the adapter does not
 * depend on the generated SDK; the generated type is assignable to it.
 */
export interface KnockFeedSettings {
  enabled?: boolean;
  /** The feed's vendor; this adapter connects only when it is `knock`. */
  provider?: string | null;
  publicApiKey?: string | null;
  feedChannelId?: string | null;
  recipientId?: string | null;
  tenantId?: string | null;
  userToken?: string | null;
  userTokenExpiresAt?: string | null;
}

export interface UseKnockNotificationFeedOptions {
  /**
   * Fetches a fresh user token before the current one expires. Return
   * `undefined` to let the token lapse (the feed then stops updating).
   */
  refreshUserToken?: () => Promise<string | undefined>;
  /** Items per page. Defaults to 50. */
  pageSize?: number;
}
