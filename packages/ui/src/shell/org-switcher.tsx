"use client";

import { Building2, Check, ChevronsUpDown, Loader2 } from "lucide-react";
import * as React from "react";

import { cn } from "../lib/utils";
import { Button } from "../primitives/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "../primitives/command";
import { Popover, PopoverContent, PopoverTrigger } from "../primitives/popover";

/**
 * Organization data for the OrgSwitcher
 */
export interface OrgSwitcherOrg {
  /** Unique organization identifier */
  id: string;
  /** Display name */
  name: string;
  /** Organization code (e.g., "acme") */
  code: string;
  /** Number of environments in this org */
  environmentCount?: number;
}

/**
 * Props for the OrgSwitcher component
 */
export interface OrgSwitcherProps {
  /** Available organizations */
  organizations: OrgSwitcherOrg[];
  /** Currently selected organization ID */
  currentOrgId: string | null;
  /** Callback when an organization is selected */
  onSelect: (org: OrgSwitcherOrg) => void;
  /** Whether organizations are still loading */
  isLoading?: boolean;
  /** Whether a switch is in progress */
  isSwitching?: boolean;
}

/**
 * Organization switcher component.
 *
 * Presentational only — no data fetching. Renders as:
 * - Static display when 0-1 organizations (Building2 icon + name)
 * - Searchable Popover dropdown when multiple organizations
 */
export function OrgSwitcher({
  organizations,
  currentOrgId,
  onSelect,
  isLoading = false,
  isSwitching = false,
}: OrgSwitcherProps) {
  const [open, setOpen] = React.useState(false);

  const currentOrg = organizations.find((org) => org.id === currentOrgId);

  // Loading state
  if (isLoading) {
    return (
      <div
        className="flex items-center gap-2 px-2 py-1"
        role="status"
        aria-label="Loading organizations"
      >
        <div className="bg-muted flex h-8 w-8 items-center justify-center rounded-full">
          <Loader2 className="text-primary h-4 w-4 motion-safe:animate-spin" aria-hidden="true" />
        </div>
        <span className="text-chrome-muted-foreground text-sm">Loading...</span>
      </div>
    );
  }

  // Single org or no orgs — static display
  if (organizations.length <= 1) {
    return (
      <div className="flex items-center gap-2 px-2 py-1">
        <div className="bg-muted flex h-8 w-8 items-center justify-center rounded-full">
          <Building2 className="text-primary h-4 w-4" aria-hidden="true" />
        </div>
        <span className="text-foreground text-sm font-medium">
          {currentOrg?.name ?? "No organization"}
        </span>
      </div>
    );
  }

  // Multiple orgs — dropdown
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label="Switch organization"
          disabled={isSwitching}
          className="text-foreground focus-visible:ring-ring hover:bg-foreground/5 hover:text-foreground flex min-h-11 items-center gap-2"
        >
          <div className="bg-muted flex h-8 w-8 shrink-0 items-center justify-center rounded-full">
            {isSwitching ? (
              <Loader2
                className="text-primary h-4 w-4 motion-safe:animate-spin"
                aria-hidden="true"
              />
            ) : (
              <Building2 className="text-primary h-4 w-4" aria-hidden="true" />
            )}
          </div>
          <span className="text-foreground max-w-[140px] truncate text-sm font-medium">
            {currentOrg?.name ?? "Select organization"}
          </span>
          <ChevronsUpDown
            className="text-chrome-muted-foreground h-4 w-4 shrink-0"
            aria-hidden="true"
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="end">
        <Command>
          <CommandInput placeholder="Search organizations..." />
          <CommandList>
            <CommandEmpty>No organizations found.</CommandEmpty>
            <CommandGroup>
              {organizations.map((org) => (
                <CommandItem
                  key={org.id}
                  value={org.name}
                  onSelect={() => {
                    if (org.id !== currentOrgId) {
                      onSelect(org);
                    }
                    setOpen(false);
                  }}
                  className="flex items-center gap-3 px-3 py-2.5"
                >
                  <div className="bg-primary/10 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg">
                    <Building2 className="text-primary h-4 w-4" aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-foreground truncate text-sm font-medium">{org.name}</p>
                    {org.environmentCount != null && (
                      <p className="text-chrome-muted-foreground text-xs">
                        {org.environmentCount}{" "}
                        {org.environmentCount === 1 ? "environment" : "environments"}
                      </p>
                    )}
                  </div>
                  <Check
                    className={cn(
                      "ml-auto h-4 w-4 shrink-0",
                      currentOrgId === org.id ? "opacity-100" : "opacity-0"
                    )}
                    aria-hidden="true"
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
