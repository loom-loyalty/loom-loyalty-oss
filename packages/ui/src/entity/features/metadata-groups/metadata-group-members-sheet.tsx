/**
 * Metadata Group Members Management Sheet
 *
 * Full-width sheet for managing which metadata items belong to a group.
 * Supports search, pagination, add (via combobox), and remove operations.
 */

import { extractLocalizedString } from "@loom-loyalty/core";
import { useMemo, type ReactNode } from "react";
import { DataTable, type Column, type PaginationConfig } from "../../../data-display/data-table.js";
import { FilterBar } from "../../../data-display/filter-bar.js";
import { FormErrorBanner } from "../../../forms/form-error-banner.js";
import type { FormSheetError } from "../../../forms/form-sheet.js";
import { Badge } from "../../../primitives/badge.js";
import { Button } from "../../../primitives/button.js";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "../../../primitives/sheet.js";
import { Skeleton } from "../../../primitives/skeleton.js";

/** Minimal metadata item shape (union of Item, Location, DataType, Country) */
export interface MetadataGroupMember {
  name: string;
  code: string;
  description?: Record<string, string>;
  typeCode?: string;
  /** The ID field varies by type — callers normalize to this */
  id: string;
}

export interface MetadataGroupMembersSheetProps {
  /** Whether the sheet is open */
  open: boolean;
  /** Callback when open state changes */
  onOpenChange: (open: boolean) => void;
  /** Group name for the title */
  groupName: string;
  /** Current members of the group */
  members: MetadataGroupMember[];
  /** Whether members are loading */
  loading?: boolean;
  /** Total member count in the group — the server total, not `members.length` */
  total?: number;
  /**
   * Page controls for the member list. The membership endpoint takes only
   * `page` and `size`, so `members` is one page and `search` filters that page.
   */
  pagination?: PaginationConfig;
  /** Current search value */
  search: string;
  /** Search change handler */
  onSearchChange: (value: string) => void;
  /** Remove a member from the group */
  onRemoveMember: (memberId: string) => void;
  /** Whether a remove operation is in progress */
  removing?: boolean;
  /** Open the add members dialog */
  onAddClick: () => void;
  /** Whether the user can modify membership */
  canEdit?: boolean;
  /** Membership write failure, shown inline above the list; a `describeError` result also shows its support reference */
  error?: FormSheetError | null;
}

/**
 * Full management sheet for metadata group members.
 * Opens from the detail sheet's "Manage Members" button.
 */
export function MetadataGroupMembersSheet({
  open,
  onOpenChange,
  groupName,
  members,
  loading,
  total,
  pagination,
  search,
  onSearchChange,
  onRemoveMember,
  removing,
  onAddClick,
  canEdit = true,
  error,
}: MetadataGroupMembersSheetProps): ReactNode {
  // A re-added member can come back twice in one response; keying the table by
  // id would then collide, so collapse to one row per id before rendering.
  const uniqueMembers = useMemo(() => {
    const byId = new Map<string, MetadataGroupMember>();
    members.forEach((member) => {
      if (!byId.has(member.id)) byId.set(member.id, member);
    });
    return Array.from(byId.values());
  }, [members]);

  // The membership endpoint has no `search` parameter, so matching happens here
  // over the page the sheet holds.
  const visibleMembers = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return uniqueMembers;
    return uniqueMembers.filter(
      (member) =>
        member.name.toLowerCase().includes(needle) || member.code.toLowerCase().includes(needle)
    );
  }, [uniqueMembers, search]);

  // The server total counts rows, not distinct members, so a duplicate inflates
  // it. Discount the duplicates this page shows before reporting the count or
  // deciding the search cannot reach everyone — otherwise the operator reads a
  // member who is not there, and is sent to a page that holds nothing.
  const groupTotal = useMemo(() => {
    const rawTotal = total ?? pagination?.total;
    if (rawTotal === undefined) return undefined;
    const duplicatesOnPage = members.length - uniqueMembers.length;
    return Math.max(rawTotal - duplicatesOnPage, uniqueMembers.length);
  }, [total, pagination?.total, members.length, uniqueMembers.length]);

  // Only caveat the search when there are members it cannot reach.
  const searchIsPageScoped =
    search.trim().length > 0 && groupTotal !== undefined && groupTotal > uniqueMembers.length;

  const columns: Column<MetadataGroupMember>[] = [
    {
      key: "name",
      header: "Metadata",
      render: (member) => (
        <div>
          <p className="text-foreground font-medium">{member.name}</p>
          <p className="text-muted-foreground font-mono text-xs">{member.code}</p>
        </div>
      ),
    },
    {
      key: "description",
      header: "Description",
      width: "max-w-xs",
      render: (member) => {
        const desc = extractLocalizedString(member.description);
        return (
          <p className="text-muted-foreground truncate text-sm" title={desc}>
            {desc || "\u2014"}
          </p>
        );
      },
    },
    {
      key: "typeCode",
      header: "Type",
      render: (member) =>
        member.typeCode ? (
          <Badge variant="secondary" className="font-normal">
            {member.typeCode}
          </Badge>
        ) : (
          <span className="text-muted-foreground text-sm">{"\u2014"}</span>
        ),
    },
    ...(canEdit
      ? [
          {
            key: "actions" as const,
            header: "",
            width: "w-20",
            render: (member: MetadataGroupMember) => (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e: React.MouseEvent) => {
                  e.stopPropagation();
                  onRemoveMember(member.id);
                }}
                disabled={removing}
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                aria-label={`Remove ${member.name} from group`}
              >
                Remove
              </Button>
            ),
          },
        ]
      : []),
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>Manage Members — {groupName}</SheetTitle>
        </SheetHeader>
        <SheetBody className="flex flex-col gap-4 overflow-y-auto">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1">
              <FilterBar
                searchValue={search}
                onSearchChange={onSearchChange}
                searchPlaceholder="Search members..."
              />
            </div>
            {canEdit && (
              <Button variant="primary-gradient" onClick={onAddClick}>
                Add Metadata
              </Button>
            )}
          </div>

          {error && (
            <FormErrorBanner
              error={error}
              className="border-destructive/30 bg-destructive/5 rounded-lg border p-3"
            />
          )}

          {searchIsPageScoped && (
            <p className="text-muted-foreground text-xs" role="status">
              Search covers only the members on this page. Change pages to search the rest of the{" "}
              {groupTotal} members.
            </p>
          )}

          {loading ? (
            <MembersSkeleton />
          ) : (
            <DataTable
              columns={columns}
              data={visibleMembers}
              getRowKey={(member) => member.id}
              pagination={pagination}
              emptyMessage={
                search.trim().length > 0
                  ? "No members on this page match your search."
                  : "No metadata in this group yet. Add metadata to get started."
              }
            />
          )}

          {groupTotal !== undefined && groupTotal > 0 && (
            <p className="text-muted-foreground text-center text-xs">
              {groupTotal} member{groupTotal !== 1 ? "s" : ""} in this group
            </p>
          )}
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}

function MembersSkeleton(): ReactNode {
  return (
    <div className="space-y-3" role="status" aria-label="Loading members">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex items-center gap-4 rounded-lg border p-3">
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-20" />
          </div>
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-6 w-16 rounded-full" />
          <Skeleton className="h-8 w-16" />
        </div>
      ))}
    </div>
  );
}
