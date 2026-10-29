/**
 * Base Resource Class
 *
 * This is the base class for all API resources in the LoomLoyalty client.
 * It provides the core fetch functionality with token-based authentication.
 */

import { apiErrorFromBody, isJsonContentType } from "../core/api-error";
import { unwrapResponse } from "../core/sdk-client";

/**
 * Configuration for the LoomLoyalty client
 */
export interface LoomLoyaltyConfig {
  /**
   * The base URL for the Loom Loyalty API
   * @example 'https://api.loomloyalty.com'
   */
  baseUrl: string;

  /**
   * Token provider function for authentication
   * Can be async or sync, should return the access token or null
   * @example () => getAccessToken()
   * @example () => 'static-token'
   */
  tokenProvider: () => Promise<string | null> | string | null;
}

/**
 * Base class for all API resources
 *
 * Provides the core fetch functionality with:
 * - Token-based authentication
 * - Response unwrapping (extracts data from API envelope)
 * - Error handling
 */
export abstract class BaseResource {
  protected config: LoomLoyaltyConfig;

  constructor(config: LoomLoyaltyConfig) {
    this.config = config;
  }

  /**
   * Internal fetch method used by all resources
   * Handles authentication, request formatting, and response unwrapping
   */
  protected async fetch<T>(
    path: string,
    options?: RequestInit & { params?: Record<string, string | number | boolean | undefined> }
  ): Promise<T> {
    // Build URL with query params
    let url = `${this.config.baseUrl}${path}`;
    if (options?.params) {
      const searchParams = new URLSearchParams();
      for (const [key, value] of Object.entries(options.params)) {
        if (value !== undefined) {
          searchParams.append(key, String(value));
        }
      }
      const queryString = searchParams.toString();
      if (queryString) {
        url += `?${queryString}`;
      }
    }

    // Get auth token
    const token = await this.config.tokenProvider();

    // Build headers
    const headers = new Headers(options?.headers);
    if (!headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }

    // Make request
    const response = await fetch(url, {
      ...options,
      headers,
    });

    // Parse response
    let responseData: unknown = null;
    const contentType = response.headers.get("content-type");
    const contentLength = response.headers.get("content-length");
    const hasContent = contentLength !== "0" && contentLength !== null;

    if (isJsonContentType(contentType) && hasContent) {
      try {
        responseData = await response.json();
      } catch {
        responseData = null;
      }
    }

    // Handle errors
    if (!response.ok) {
      throw apiErrorFromBody(responseData, {
        status: response.status,
        statusText: response.statusText,
        requestIdHeader: response.headers.get("x-request-id"),
      });
    }

    // Unwrap and return the response data
    return unwrapResponse<T>(responseData);
  }
}
