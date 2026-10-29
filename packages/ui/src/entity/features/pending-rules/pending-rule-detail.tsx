/**
 * Pending Rule Detail Sheet Content
 *
 * Displays all PendingRule fields with Edit and Delete action buttons.
 * Supports extended fields from data model extensions.
 */

import { extractLocalizedString, formatDateTime } from "@loom-loyalty/core";
import type { UIEntitySchema } from "@loom-loyalty/schema";
import type { PendingRule } from "@loom-loyalty/sdk";
import { Edit, Trash2 } from "lucide-react";
import { useMemo, type ReactNode } from "react";
import { useProgramField } from "../../../forms/program-field/index.js";
import { Badge } from "../../../primitives/badge.js";
import { Button } from "../../../primitives/button.js";
import { EnvironmentEnablementList } from "../../environment-workflow/environment-status-column.js";
import { ExtendedFieldsSection } from "../../extended-fields-section.js";
import { formatPendingConfig } from "./pending-rule-columns.js";
import { PENDING_RULE_TYPE_LABELS } from "./types.js";

export interface PendingRuleDetailProps {
  /** Pending rule to display */
  pendingRule: PendingRule;
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
}

/**
 * Pending rule detail content for Sheet display
 */
export function PendingRuleDetail({
  pendingRule,
  onEdit,
  onDelete,
  canEdit = true,
  canDelete = true,
  schema,
  extendedFields = [],
}: PendingRuleDetailProps): ReactNode {
  const description = extractLocalizedString(pendingRule.description);

  // Fetch programs to resolve IDs to names
  const { options: programOptions } = useProgramField();

  // Resolve program IDs to display names
  const resolvedPrograms = useMemo(() => {
    if (!pendingRule.programIds || pendingRule.programIds.length === 0) return [];
    return pendingRule.programIds.map((id) => {
      const program = programOptions.find((p) => p.id === id);
      return { id, name: program?.name ?? id };
    });
  }, [pendingRule.programIds, programOptions]);

  return (
    <div className="space-y-6">
      {/* Basic Information */}
      <section className="space-y-4">
        <h3 className="text-foreground text-sm font-semibold tracking-wide uppercase">
          Basic Information
        </h3>
        <div className="space-y-3">
          <DetailRow label="Name" value={pendingRule.name} />
          <DetailRow label="Code" value={pendingRule.code} mono />
          {description && <DetailRow label="Description" value={description} />}
        </div>
      </section>

      {/* Pending Configuration */}
      <section className="space-y-4">
        <h3 className="text-foreground text-sm font-semibold tracking-wide uppercase">
          Pending Configuration
        </h3>
        <div className="space-y-3">
          <div>
            <p className="text-muted-foreground text-sm">Type</p>
            <Badge variant="secondary" className="mt-1 font-normal">
              {PENDING_RULE_TYPE_LABELS[pendingRule.type] ?? pendingRule.type}
            </Badge>
          </div>
          <DetailRow label="Configuration" value={formatPendingConfig(pendingRule)} />
        </div>
      </section>

      {/* Programs */}
      {resolvedPrograms.length > 0 && (
        <section className="space-y-4">
          <h3 className="text-foreground text-sm font-semibold tracking-wide uppercase">
            Programs
          </h3>
          <div className="flex flex-wrap gap-2">
            {resolvedPrograms.map((program) => (
              <Badge key={program.id} variant="outline">
                {program.name}
              </Badge>
            ))}
          </div>
        </section>
      )}

      {/* Environments */}
      {pendingRule.enabledInEnvironments && pendingRule.enabledInEnvironments.length > 0 && (
        <section className="space-y-4">
          <h3 className="text-foreground text-sm font-semibold tracking-wide uppercase">
            Enabled Environments
          </h3>
          <EnvironmentEnablementList enabledInEnvironments={pendingRule.enabledInEnvironments} />
        </section>
      )}

      {/* Timestamps */}
      <section className="space-y-4">
        <h3 className="text-foreground text-sm font-semibold tracking-wide uppercase">
          Timestamps
        </h3>
        <div className="space-y-3">
          <DetailRow label="Created" value={formatDateTime(pendingRule.createdDateTime) ?? "—"} />
          <DetailRow
            label="Last Modified"
            value={formatDateTime(pendingRule.modifiedDateTime) ?? "—"}
          />
        </div>
      </section>

      {/* ID (if available) */}
      {pendingRule.pendingRuleId && (
        <section className="space-y-4">
          <h3 className="text-foreground text-sm font-semibold tracking-wide uppercase">System</h3>
          <DetailRow label="Pending Rule ID" value={pendingRule.pendingRuleId} mono />
        </section>
      )}

      {/* Extended Fields Section (from data model extensions) */}
      {schema && extendedFields.length > 0 && (
        <ExtendedFieldsSection
          schema={schema}
          fields={extendedFields}
          data={pendingRule}
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
