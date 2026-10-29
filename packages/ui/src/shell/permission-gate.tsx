"use client";

import type { ReactNode } from "react";

export interface PermissionGateProps {
  /** Whether the user has the required permission */
  hasPermission: boolean;
  /** Optional fallback content to render when permission is denied */
  fallback?: ReactNode;
  /** Content to render when permission is granted */
  children: ReactNode;
}

/**
 * Presentational component that conditionally renders children based on permission.
 * Renders children when hasPermission is true, otherwise renders fallback (defaults to null).
 *
 * @example
 * ```tsx
 * <PermissionGate hasPermission={canEdit}>
 *   <EditButton />
 * </PermissionGate>
 *
 * <PermissionGate hasPermission={canView} fallback={<PermissionDenied />}>
 *   <ProtectedContent />
 * </PermissionGate>
 * ```
 */
export function PermissionGate({
  hasPermission,
  fallback = null,
  children,
}: PermissionGateProps): ReactNode {
  if (!hasPermission) {
    return fallback;
  }

  return children;
}
