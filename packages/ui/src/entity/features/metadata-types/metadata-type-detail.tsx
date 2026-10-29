/**
 * Metadata Type Detail Sheet Content
 *
 * Displays all MetadataType fields with Edit and Delete action buttons.
 */

import { formatDateTime } from "@loom-loyalty/core";
import type { MetadataType } from "@loom-loyalty/sdk";
import { Edit, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "../../../primitives/button.js";
import { CategoryBadge } from "./category-badge.js";
import {
  MetadataTypeRelationships,
  type MetadataTypeRelationshipActions,
} from "./metadata-type-relationships.js";

export interface MetadataTypeDetailProps {
  /** MetadataType to display */
  metadataType: MetadataType;
  /** Edit click handler */
  onEdit?: () => void;
  /** Delete click handler */
  onDelete?: () => void;
  /** Whether editing is enabled */
  canEdit?: boolean;
  /** Whether deletion is enabled */
  canDelete?: boolean;
  /** Link/unlink handlers for parent and child types; omit for a read-only list. */
  relationshipActions?: MetadataTypeRelationshipActions;
}

/**
 * MetadataType detail content for Sheet display
 */
export function MetadataTypeDetail({
  metadataType,
  onEdit,
  onDelete,
  canEdit = true,
  canDelete = true,
  relationshipActions,
}: MetadataTypeDetailProps): ReactNode {
  const description = (metadataType.description as Record<string, string> | undefined)?.en ?? null;

  return (
    <div className="space-y-6">
      {/* Basic Information */}
      <section className="space-y-4">
        <h3 className="text-foreground text-sm font-semibold tracking-wide uppercase">
          Basic Information
        </h3>
        <div className="space-y-3">
          <DetailRow label="Name" value={metadataType.name} />
          <DetailRow label="Code" value={metadataType.code} mono />
          <div>
            <p className="text-muted-foreground text-sm">Category</p>
            <div className="mt-1">
              <CategoryBadge category={metadataType.category} size="md" />
            </div>
          </div>
          {description && <DetailRow label="Description" value={description} />}
        </div>
      </section>

      {/* Configuration */}
      <section className="space-y-4">
        <h3 className="text-foreground text-sm font-semibold tracking-wide uppercase">
          Configuration
        </h3>
        <div className="space-y-3">
          <DetailRow label="Searchable" value={metadataType.searchable ? "Yes" : "No"} />
        </div>
      </section>

      <MetadataTypeRelationships metadataType={metadataType} actions={relationshipActions} />

      {/* Timestamps */}
      <section className="space-y-4">
        <h3 className="text-foreground text-sm font-semibold tracking-wide uppercase">
          Timestamps
        </h3>
        <div className="space-y-3">
          <DetailRow
            label="Created"
            value={formatDateTime(metadataType.createdDateTime) ?? "\u2014"}
          />
          <DetailRow
            label="Last Modified"
            value={formatDateTime(metadataType.modifiedDateTime) ?? "\u2014"}
          />
        </div>
      </section>

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
