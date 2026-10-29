/**
 * Core API Types
 *
 * Utility types used by the API client that are NOT generated from OpenAPI.
 * For entity types, use the generated schemas from ./generated/schemas
 */

import type { ApiError } from "./api-error";

// The API error is a real Error subclass (custom, not from OpenAPI); see ./api-error.
export type { ApiError, ApiFieldError } from "./api-error";

// Generic API Response wrapper (custom, not from OpenAPI)
export interface ApiResponse<T> {
  data?: T;
  error?: ApiError;
  success: boolean;
}
