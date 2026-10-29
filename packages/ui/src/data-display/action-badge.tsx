import { Badge } from "../primitives/badge";

/**
 * Action types for CRUD operations and permissions.
 */
export type ActionType = "READ" | "CREATE" | "UPDATE" | "DELETE" | "EXECUTE" | "MANAGE";

/**
 * Action badge variant mapping using semantic Badge variants.
 */
const actionVariants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  READ: "secondary",
  CREATE: "default",
  UPDATE: "default",
  DELETE: "destructive",
  EXECUTE: "default",
  MANAGE: "default",
};

interface ActionBadgeProps {
  /** The action type to display */
  action: string;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Badge component for displaying CRUD action types.
 * Uses semantic badge variants from the design system.
 *
 * Common use cases:
 * - Role/permission scope actions
 * - Audit log entries
 * - Activity feeds
 * - API permission displays
 */
export function ActionBadge({ action, className }: ActionBadgeProps) {
  const variant = actionVariants[action] || "outline";

  return (
    <Badge variant={variant} className={className}>
      {action}
    </Badge>
  );
}
