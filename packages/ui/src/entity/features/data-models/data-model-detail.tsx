/**
 * DataModelDetail
 *
 * Thin orchestrator that composes section components from ./detail/.
 * Sections: header badges → Type info → Elements → JSON Schema → Sandbox →
 *   Version History → Used By → Child Type Refs → Timestamps → System → Actions.
 */

import { formatDateTime, toISODateTime } from "@loom-loyalty/core";
import type { DataModel } from "@loom-loyalty/sdk";
import { Copy, Edit, Lock, PlayCircle, Plus, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "../../../primitives/badge.js";
import { Button } from "../../../primitives/button.js";
import { Skeleton } from "../../../primitives/skeleton.js";
import {
  canDeleteDataModel,
  canEditDataModel,
  ClassificationBadge,
  getTypeClassification,
} from "./classification.js";
import { ElementsSection } from "./detail/elements-section.js";
import { JsonSchemaSection } from "./detail/json-schema-section.js";
import { SchemaSandboxSection } from "./detail/schema-sandbox-section.js";
import { DetailRow, Section } from "./detail/section.js";
import { UsedBySection } from "./detail/used-by-section.js";
import { VersionHistorySection } from "./detail/version-history-section.js";
import { VersionStatusBadge } from "./detail/version-status-badge.js";
import type { CrossEntityImpactEntry, DataModelVersionStatus } from "./types.js";

export interface DataModelDetailProps {
  /** The DataModel to display */
  dataModel: DataModel;
  /** Versions of this model (same type code) for the History panel */
  versions?: DataModel[];
  /** Cross-entity references from other models */
  impact?: CrossEntityImpactEntry[];
  /** Handlers for entity actions */
  onEdit?: () => void;
  onDelete?: () => void;
  onDuplicate?: () => void;
  onCreateVersion?: () => void;
  onPublish?: () => void;
  onPublishVersion?: (version: DataModel) => void;
  /** Type-level actions (custom-only — the backend unconditionally rejects
   * PUT/DELETE /data-model-types/{id} for any system or primitive type,
   * confirmed live: "Cannot modify or delete system or primitive data model
   * type", regardless of that type's own `modifiable` flag) */
  onEditType?: () => void;
  onDeleteType?: () => void;
  /** Pending flags */
  isPublishing?: boolean;
  isCreatingVersion?: boolean;
  /**
   * ID of the version currently being published. Forwarded to VersionHistorySection
   * so only the in-flight row shows the spinner, not every draft row.
   */
  publishingVersionId?: string | null;
  /** Inline error for publish / create-version actions (rendered above primary actions). */
  versionActionError?: string | null;
  /**
   * The model's elements are still loading (list rows carry none; the full
   * record does). Shows a skeleton instead of "Elements (0)" and holds Publish.
   */
  elementsLoading?: boolean;
}

export function DataModelDetail({
  dataModel,
  versions = [],
  impact = [],
  onEdit,
  onDelete,
  onDuplicate,
  onCreateVersion,
  onPublish,
  onPublishVersion,
  onEditType,
  onDeleteType,
  isPublishing,
  isCreatingVersion,
  publishingVersionId,
  versionActionError,
  elementsLoading = false,
}: DataModelDetailProps): ReactNode {
  const classification = getTypeClassification(dataModel.type);
  const canEdit = canEditDataModel(dataModel);
  const canDelete = canDeleteDataModel(dataModel);
  const isDraft = dataModel.versionStatus === "DRAFT";
  const isCustom = classification === "custom";
  const hasElements = (dataModel.elements?.length ?? 0) > 0;

  return (
    <div className="space-y-6">
      {/* Header row: classification + version status */}
      <div className="flex flex-wrap items-center gap-2">
        <ClassificationBadge classification={classification} />
        {dataModel.versionStatus && (
          <VersionStatusBadge status={dataModel.versionStatus as DataModelVersionStatus} />
        )}
        {typeof dataModel.version === "number" && (
          <Badge variant="outline" className="font-mono text-xs">
            v{dataModel.version}
          </Badge>
        )}
        {!canEdit && (
          <Badge variant="outline" className="text-muted-foreground gap-1 text-xs">
            <Lock className="h-3 w-3" />
            Read-only
          </Badge>
        )}
      </div>

      {/* Type Information */}
      <Section title="Type Information">
        <DetailRow label="Type Name" value={dataModel.type?.name ?? "—"} />
        <DetailRow label="Type Code" value={dataModel.type?.code ?? "—"} mono />
        {dataModel.type?.description && (
          <DetailRow
            label="Description"
            value={(() => {
              const desc = dataModel.type.description;
              if (typeof desc === "string") return desc;
              return (desc as Record<string, string> | undefined)?.en ?? "—";
            })()}
          />
        )}
        {dataModel.type?.parentTypeReference && (
          <DetailRow label="Parent Type" value={dataModel.type.parentTypeReference} mono />
        )}
        {isCustom && (onEditType || onDeleteType) && (
          <div className="flex gap-2 pt-2">
            {onEditType && (
              <Button type="button" variant="outline" size="sm" onClick={onEditType}>
                <Edit className="mr-1.5 h-3.5 w-3.5" />
                Edit Type
              </Button>
            )}
            {isCustom && onDeleteType && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onDeleteType}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                Delete Type
              </Button>
            )}
          </div>
        )}
      </Section>

      {elementsLoading ? (
        <Section title="Elements">
          <div className="space-y-2" aria-busy="true" aria-label="Loading elements">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        </Section>
      ) : (
        <ElementsSection elements={dataModel.elements ?? []} />
      )}

      {dataModel.jsonSchema && (
        <JsonSchemaSection schema={dataModel.jsonSchema as Record<string, unknown>} />
      )}

      {dataModel.jsonSchema && (
        <SchemaSandboxSection schema={dataModel.jsonSchema as Record<string, unknown>} />
      )}

      {versions.length > 0 && (
        <VersionHistorySection
          versions={versions}
          currentId={dataModel.dataModelId}
          onPublishVersion={canEdit ? onPublishVersion : undefined}
          isPublishing={isPublishing}
          publishingVersionId={publishingVersionId}
        />
      )}

      {impact.length > 0 && <UsedBySection impact={impact} />}

      {dataModel.childTypeReferences && dataModel.childTypeReferences.length > 0 && (
        <Section title="Child Type References">
          <div className="flex flex-wrap gap-2">
            {dataModel.childTypeReferences.map((ref) => (
              <Badge key={ref} variant="outline" className="font-mono text-xs">
                {ref}
              </Badge>
            ))}
          </div>
        </Section>
      )}

      <Section title="Timestamps">
        <DetailRow
          label="Created"
          value={formatDateTime(dataModel.createdDateTime) ?? "—"}
          dateTime={
            dataModel.createdDateTime ? toISODateTime(new Date(dataModel.createdDateTime)) : null
          }
        />
        <DetailRow
          label="Last Modified"
          value={formatDateTime(dataModel.modifiedDateTime) ?? "—"}
          dateTime={
            dataModel.modifiedDateTime ? toISODateTime(new Date(dataModel.modifiedDateTime)) : null
          }
        />
      </Section>

      <Section title="System">
        <DetailRow label="Data Model ID" value={dataModel.dataModelId ?? "—"} mono />
      </Section>

      {versionActionError && (
        <div className="border-destructive/30 bg-destructive/5 rounded-lg border p-3" role="alert">
          <p className="text-destructive text-sm">{versionActionError}</p>
        </div>
      )}

      <div className="border-border flex flex-wrap gap-2 border-t pt-4">
        {canEdit && onDuplicate && (
          <Button type="button" variant="outline" size="sm" onClick={onDuplicate}>
            <Copy className="mr-1.5 h-3.5 w-3.5" />
            Duplicate
          </Button>
        )}
        {canEdit && onCreateVersion && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onCreateVersion}
            disabled={isCreatingVersion}
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            New Version
          </Button>
        )}
        {canEdit && isDraft && onPublish && (
          <>
            {!hasElements && !elementsLoading && (
              <p id="publish-hint" className="text-muted-foreground w-full text-xs">
                Add at least one element before publishing.
              </p>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onPublish}
              disabled={isPublishing || !hasElements || elementsLoading}
              aria-describedby={!hasElements && !elementsLoading ? "publish-hint" : undefined}
              className="text-success-dark"
            >
              <PlayCircle className="mr-1.5 h-3.5 w-3.5" />
              Publish
            </Button>
          </>
        )}
        <div className="flex-1" />
        {canDelete && onDelete && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onDelete}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
            Delete
          </Button>
        )}
        {canEdit && isDraft && onEdit && (
          <Button type="button" variant="primary-gradient" size="sm" onClick={onEdit}>
            <Edit className="mr-1.5 h-3.5 w-3.5" />
            Edit
          </Button>
        )}
      </div>
    </div>
  );
}
