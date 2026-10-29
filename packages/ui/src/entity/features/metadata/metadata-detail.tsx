/**
 * Metadata Detail Sheet Content
 *
 * Displays all Metadata fields with Edit and Delete action buttons.
 */

import { formatDateTime } from "@loom-loyalty/core";
import type { Metadata } from "@loom-loyalty/sdk";
import { Edit, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "../../../primitives/button.js";
import {
  MetadataRelationships,
  type MetadataLinkEntry,
  type MetadataRelationshipActions,
} from "./metadata-relationships.js";

export interface MetadataDetailProps {
  /** Metadata to display */
  metadata: Metadata;
  /** Edit click handler */
  onEdit?: () => void;
  /** Delete click handler */
  onDelete?: () => void;
  /** Whether editing is enabled */
  canEdit?: boolean;
  /** Whether deletion is enabled */
  canDelete?: boolean;
  /** Link/unlink handlers for parents and children; omit for a read-only view. */
  relationshipActions?: MetadataRelationshipActions;
}

/**
 * Metadata detail content for Sheet display
 */
export function MetadataDetail({
  metadata,
  onEdit,
  onDelete,
  canEdit = true,
  canDelete = true,
  relationshipActions,
}: MetadataDetailProps): ReactNode {
  const description = (metadata.description as Record<string, string> | undefined)?.en ?? null;

  return (
    <div className="space-y-6">
      {/* Basic Information */}
      <section className="space-y-4">
        <h3 className="text-foreground text-sm font-semibold tracking-wide uppercase">
          Basic Information
        </h3>
        <div className="space-y-3">
          <DetailRow label="Name" value={metadata.name} />
          <DetailRow label="Code" value={metadata.code} mono />
          <DetailRow label="Type Code" value={metadata.typeCode} mono />
          {description && <DetailRow label="Description" value={description} />}
        </div>
      </section>

      <MetadataRelationships
        metadata={metadata as MetadataLinkEntry}
        actions={relationshipActions}
      />

      {/* Timestamps */}
      <section className="space-y-4">
        <h3 className="text-foreground text-sm font-semibold tracking-wide uppercase">
          Timestamps
        </h3>
        <div className="space-y-3">
          <DetailRow label="Created" value={formatDateTime(metadata.createdDateTime) ?? "\u2014"} />
          <DetailRow
            label="Last Modified"
            value={formatDateTime(metadata.modifiedDateTime) ?? "\u2014"}
          />
        </div>
      </section>

      {/* System */}
      <section className="space-y-4">
        <h3 className="text-foreground text-sm font-semibold tracking-wide uppercase">System</h3>
        <DetailRow label="Metadata ID" value={metadata.metadataId ?? "\u2014"} mono />
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
