/**
 * ProgramBadgeList
 *
 * A pre-wired wrapper around AssociationBadgeList that resolves
 * program names from program IDs using the useProgramField hook.
 *
 * When program data is loaded, shows program names as badges.
 * When loading or programs can't be resolved, falls back to count display.
 */

"use client";

import { useMemo, type ReactNode } from "react";

import { useProgramField } from "../forms/program-field";
import { cn } from "../lib/utils";
import { Badge } from "../primitives/badge";

export interface ProgramBadgeListProps {
  /** Array of program IDs to display */
  programIds: string[];
  /** Maximum number of individual program badges to show before collapsing. Defaults to 2. */
  maxVisible?: number;
  /** Badge variant. Defaults to "outline". */
  variant?: "default" | "secondary" | "outline" | "destructive";
  /** Additional className for the wrapper */
  className?: string;
}

/**
 * Display program associations as named badges with automatic name resolution.
 *
 * @example
 * ```tsx
 * <ProgramBadgeList programIds={currency.programIds ?? []} />
 * ```
 */
export function ProgramBadgeList({
  programIds,
  maxVisible = 2,
  variant = "outline",
  className,
}: ProgramBadgeListProps): ReactNode {
  const { programs, isLoading } = useProgramField();

  // Resolve program names from IDs
  const resolvedPrograms = useMemo(() => {
    return programIds.map((id) => {
      const program = programs.find((p) => p.programId === id);
      return {
        id,
        name: program?.name ?? null,
        code: program?.code ?? null,
      };
    });
  }, [programIds, programs]);

  if (programIds.length === 0) {
    return <span className="text-muted-foreground text-sm">—</span>;
  }

  // While loading or if too many to show individually, show count
  if (isLoading || programIds.length > maxVisible) {
    return (
      <Badge variant={variant} className={cn("font-normal", className)}>
        {programIds.length} {programIds.length === 1 ? "program" : "programs"}
      </Badge>
    );
  }

  // Show individual named badges
  return (
    <div className={cn("flex flex-wrap gap-1", className)}>
      {resolvedPrograms.map((p) => (
        <Badge key={p.id} variant={variant} className="text-xs font-normal">
          {p.name ?? p.id}
        </Badge>
      ))}
    </div>
  );
}
