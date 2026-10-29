"use client";

import { ShieldX } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "../lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../primitives/card";

export interface PermissionDeniedProps {
  /** Custom title for the permission denied message */
  title?: string;
  /** Custom description explaining why access is denied */
  description?: string;
  /** Whether to show a "contact your administrator" message */
  contactAdmin?: boolean;
  /** Optional action rendered below the restricted-access guidance */
  action?: ReactNode;
  /** Additional className */
  className?: string;
}

/**
 * Full-page permission denied card.
 * Displays a centered card with an icon and message when the user lacks permission.
 * Includes proper ARIA attributes for accessibility (WCAG 2.1 AA).
 *
 * @example
 * ```tsx
 * <PermissionDenied />
 *
 * <PermissionDenied
 *   title="Restricted Area"
 *   description="You need admin privileges to access this page."
 *   contactAdmin
 * />
 * ```
 */
export function PermissionDenied({
  title = "Permission Denied",
  description = "You don't have permission to access this resource.",
  contactAdmin = false,
  action,
  className,
}: PermissionDeniedProps): ReactNode {
  return (
    <div className={cn("flex min-h-[50vh] items-center justify-center p-4", className)}>
      <Card className="w-full max-w-md text-center">
        <CardHeader className="flex-col items-center gap-3">
          <div
            className="bg-destructive/10 flex h-12 w-12 items-center justify-center rounded-full"
            aria-hidden="true"
          >
            <ShieldX className="text-destructive h-6 w-6" />
          </div>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          <CardDescription className="text-base">{description}</CardDescription>
          {contactAdmin && (
            <p className="text-muted-foreground text-sm">
              Please contact your administrator for access.
            </p>
          )}
          {action}
        </CardContent>
      </Card>
    </div>
  );
}
