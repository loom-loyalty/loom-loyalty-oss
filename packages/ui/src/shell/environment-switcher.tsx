"use client";

import { Check, ChevronDown, Loader2, Server } from "lucide-react";

import { cn } from "../lib/utils";
import { Button } from "../primitives/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../primitives/dropdown-menu";

/**
 * Environment data for the EnvironmentSwitcher
 */
export interface EnvironmentSwitcherEnv {
  /** Unique environment identifier */
  id: string;
  /** Display name */
  name: string;
  /** Environment code */
  code: string;
}

/**
 * Props for the EnvironmentSwitcher component
 */
export interface EnvironmentSwitcherProps {
  /** Available environments */
  environments: EnvironmentSwitcherEnv[];
  /** Currently selected environment ID */
  currentEnvId: string | null;
  /** Callback when an environment is selected */
  onSelect: (env: EnvironmentSwitcherEnv) => void;
  /** Whether a switch is in progress */
  isSwitching?: boolean;
}

/**
 * Environment switcher component.
 *
 * Presentational only — no data fetching. Renders as:
 * - Nothing when 0-1 environments (no switching needed)
 * - Simple DropdownMenu when 2+ environments
 */
export function EnvironmentSwitcher({
  environments,
  currentEnvId,
  onSelect,
  isSwitching = false,
}: EnvironmentSwitcherProps) {
  // Hide when there's nothing to switch between
  if (environments.length <= 1) {
    return null;
  }

  const currentEnv = environments.find((env) => env.id === currentEnvId);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          disabled={isSwitching}
          aria-label="Switch environment"
          className="hover:bg-foreground/5 flex min-h-11 items-center gap-1.5"
        >
          {isSwitching ? (
            <Loader2 className="h-3.5 w-3.5 motion-safe:animate-spin" aria-hidden="true" />
          ) : (
            <Server className="text-chrome-muted-foreground h-3.5 w-3.5" aria-hidden="true" />
          )}
          <span className="text-chrome-muted-foreground max-w-[100px] truncate text-xs font-medium">
            {currentEnv?.name ?? "Environment"}
          </span>
          <ChevronDown className="text-chrome-muted-foreground h-3 w-3" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {environments.map((env) => (
          <DropdownMenuItem
            key={env.id}
            onClick={() => {
              if (env.id !== currentEnvId) {
                onSelect(env);
              }
            }}
            aria-current={env.id === currentEnvId ? "true" : undefined}
            className="flex items-center justify-between"
          >
            <span className="truncate">{env.name}</span>
            <Check
              className={cn(
                "ml-2 h-4 w-4 shrink-0",
                currentEnvId === env.id ? "opacity-100" : "opacity-0"
              )}
              aria-hidden="true"
            />
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
