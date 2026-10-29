/**
 * @loom-loyalty/auth
 *
 * WorkOS authentication for Loom Loyalty platform
 * - Server-side: Session management, JWT validation, WorkOS API client
 * - Client-side: Auth provider, hooks, handoff handling
 */

// Re-export types
export * from "./types";

// Re-export shared utilities
export * from "./shared";

// Note: Server and client exports are available via subpath imports:
// - import { ... } from "@loom-loyalty/auth/server"
// - import { ... } from "@loom-loyalty/auth/client"
