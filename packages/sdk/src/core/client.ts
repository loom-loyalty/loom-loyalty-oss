import { ApiError, apiErrorFromBody, isJsonContentType } from "./api-error";
import type { ApiResponse } from "./types";

/**
 * Base API URL for Loom Loyalty API
 * Can be overridden via environment variable
 */
export const API_BASE_URL =
  typeof process !== "undefined" && process.env?.LOOM_API_URL
    ? process.env.LOOM_API_URL
    : "https://api.loomloyalty.com";

/** Largest `size`/`pageSize` a paginated list request may pass. */
export const PLATFORM_MAX_PAGE_SIZE = 100;

/**
 * Make an authenticated API request
 * @param endpoint - API endpoint (e.g., '/programs')
 * @param options - Fetch options (method, body, headers, etc.)
 * @param accessToken - Access token for authentication
 */
export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {},
  accessToken: string
): Promise<ApiResponse<T>> {
  try {
    const url = `${API_BASE_URL}${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        ...options.headers,
      },
    });

    // Parse response - handle empty responses
    let data: unknown = null;
    const contentType = response.headers.get("content-type");
    const hasContent = response.headers.get("content-length") !== "0";

    if (isJsonContentType(contentType) && hasContent) {
      try {
        data = await response.json();
      } catch {
        // Empty response or invalid JSON
        data = null;
      }
    }

    // Handle error responses
    if (!response.ok) {
      const error = apiErrorFromBody(data, {
        status: response.status,
        statusText: response.statusText,
        requestIdHeader: response.headers.get("x-request-id"),
      });

      return {
        success: false,
        error,
      };
    }

    // Success response
    const successData = data as { data?: T } | null;
    return {
      success: true,
      data: successData?.data as T,
    };
  } catch (error) {
    // Network or parsing errors
    const apiError = new ApiError({
      message: error instanceof Error ? error.message : "Network error",
      status: 0,
    });

    return {
      success: false,
      error: apiError,
    };
  }
}
