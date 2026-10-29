import type { ReactNode } from "react";

/**
 * Returns the bearer token for OFREP calls, or null to send none.
 * Same shape as the SDK's token provider.
 */
export type FeatureFlagTokenProvider = () => Promise<string | null> | string | null;

export interface FeatureFlagProviderProps {
  /**
   * Base URL of the OFREP server. The provider appends `/ofrep/v1/evaluate/flags`,
   * so pass the Platform API base (for example `/api/v1` behind the dashboard BFF).
   */
  baseUrl: string;
  /**
   * Supplies the bearer token, read on every fetch. Omit it, or return null, when a
   * proxy injects auth server-side (the dashboard BFF); no Authorization header is
   * sent then. A new function identity does not re-evaluate flags, so an inline
   * arrow is fine; the latest one is used on the next fetch.
   */
  tokenProvider?: FeatureFlagTokenProvider;
  /**
   * Identifies the tenant the flags are for, such as the organization environment id.
   * A change re-evaluates every flag. The server derives the tenant from the token,
   * not from this key, so this only decides when to refresh: change it whenever the
   * identity or tenant behind the token changes, or flags stay evaluated for the old one.
   */
  targetingKey?: string;
  /** Milliseconds between background refreshes. Defaults to 30 seconds; 0 disables polling. */
  pollInterval?: number;
  /** OpenFeature domain the provider is bound to. Defaults to `loom`. */
  domain?: string;
  children?: ReactNode;
}
