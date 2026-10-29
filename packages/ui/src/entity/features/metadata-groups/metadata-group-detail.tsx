/**
 * Metadata Group Detail Sheet Content
 *
 * Displays all MetadataGroup fields with Edit and Delete action buttons.
 * Supports extended fields from data model extensions.
 */

import { extractLocalizedString, formatDateTime } from "@loom-loyalty/core";
import type { UIEntitySchema } from "@loom-loyalty/schema";
import type { MetadataGroup } from "@loom-loyalty/sdk";
import { Edit, Layers, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "../../../primitives/badge.js";
import { Button } from "../../../primitives/button.js";
import { Skeleton } from "../../../primitives/skeleton.js";
import { ExtendedFieldsSection } from "../../extended-fields-section.js";
import type { MetadataGroupMember } from "./metadata-group-members-sheet.js";

export interface MetadataGroupDetailProps {
  /** Metadata group to display */
  metadataGroup: MetadataGroup;
  /** Edit click handler */
  onEdit?: () => void;
  /** Delete click handler */
  onDelete?: () => void;
  /** Whether editing is enabled */
  canEdit?: boolean;
  /** Whether deletion is enabled */
  canDelete?: boolean;
  /** Schema for rendering extended fields (optional) */
  schema?: UIEntitySchema;
  /** Extended field names to render (beyond standard fields) */
  extendedFields?: string[];
  /** Preview of members in this group (first few items) */
  memberPreview?: MetadataGroupMember[];
  /** Total count of members in this group */
  memberCount?: number;
  /** Whether members are loading */
  membersLoading?: boolean;
  /** Handler to open the manage members sheet */
  onManageMembers?: () => void;
}

/**
 * Metadata group detail content for Sheet display
 */
export function MetadataGroupDetail({
  metadataGroup,
  onEdit,
  onDelete,
  canEdit = true,
  canDelete = true,
  schema,
  extendedFields = [],
  memberPreview,
  memberCount,
  membersLoading,
  onManageMembers,
}: MetadataGroupDetailProps): ReactNode {
  const description = extractLocalizedString(metadataGroup.description);

  return (
    <div className="space-y-6">
      {/* Basic Information */}
      <section className="space-y-4">
        <h3 className="text-foreground text-sm font-semibold tracking-wide uppercase">
          Basic Information
        </h3>
        <div className="space-y-3">
          <DetailRow label="Name" value={metadataGroup.name} />
          <DetailRow label="Code" value={metadataGroup.code} mono />
          {description && <DetailRow label="Description" value={description} />}
          <div>
            <p className="text-muted-foreground text-sm">Type Code</p>
            {metadataGroup.typeCode ? (
              <Badge variant="secondary" className="mt-1 font-normal">
                {metadataGroup.typeCode}
              </Badge>
            ) : (
              <p className="text-foreground font-medium">{"\u2014"}</p>
            )}
          </div>
        </div>
      </section>

      {/* Members Summary */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-foreground text-sm font-semibold tracking-wide uppercase">Members</h3>
          {memberCount !== undefined && (
            <Badge variant="secondary" className="font-normal">
              {memberCount} item{memberCount !== 1 ? "s" : ""}
            </Badge>
          )}
        </div>
        {membersLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-5 w-44" />
          </div>
        ) : memberPreview && memberPreview.length > 0 ? (
          <div className="space-y-1.5">
            {memberPreview.slice(0, 4).map((member) => (
              <div key={member.id} className="flex items-center gap-2">
                <Layers className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
                <span className="text-foreground text-sm">{member.name}</span>
                <span className="text-muted-foreground font-mono text-xs">({member.code})</span>
              </div>
            ))}
            {(memberCount ?? 0) > 4 && (
              <p className="text-muted-foreground text-xs">+ {(memberCount ?? 0) - 4} more</p>
            )}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">No metadata in this group yet.</p>
        )}
        {onManageMembers && (
          <Button variant="outline" size="sm" onClick={onManageMembers} className="w-full">
            <Layers className="mr-2 h-4 w-4" />
            Manage Members
          </Button>
        )}
      </section>

      {/* Timestamps */}
      <section className="space-y-4">
        <h3 className="text-foreground text-sm font-semibold tracking-wide uppercase">
          Timestamps
        </h3>
        <div className="space-y-3">
          <DetailRow
            label="Created"
            value={formatDateTime(metadataGroup.createdDateTime) ?? "\u2014"}
          />
          <DetailRow
            label="Last Modified"
            value={formatDateTime(metadataGroup.modifiedDateTime) ?? "\u2014"}
          />
        </div>
      </section>

      {/* ID (if available) */}
      {metadataGroup.metadataGroupId && (
        <section className="space-y-4">
          <h3 className="text-foreground text-sm font-semibold tracking-wide uppercase">System</h3>
          <DetailRow label="Metadata Group ID" value={metadataGroup.metadataGroupId} mono />
        </section>
      )}

      {/* Extended Fields Section (from data model extensions) */}
      {schema && extendedFields.length > 0 && (
        <ExtendedFieldsSection
          schema={schema}
          fields={extendedFields}
          data={metadataGroup}
          mode="view"
          title="Additional Information"
          defaultCollapsed={false}
        />
      )}

      {/* Action Buttons */}
      {(canEdit || canDelete) && (
        <div className="border-border flex gap-2 border-t pt-4">
          {canDelete && onDelete && (
            <Button variant="outline" className="flex-1" onClick={onDelete}>
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </Button>
          )}
          {canEdit && onEdit && (
            <Button variant="primary-gradient" className="flex-1" onClick={onEdit}>
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

interface DetailRowProps {
  label: string;
  value: string;
  mono?: boolean;
}

function DetailRow({ label, value, mono }: DetailRowProps) {
  return (
    <div>
      <p className="text-muted-foreground text-sm">{label}</p>
      <p className={mono ? "text-foreground font-mono text-sm" : "text-foreground font-medium"}>
        {value}
      </p>
    </div>
  );
}
