/**
 * Workflow Detail Sheet Content
 *
 * Displays all Workflow fields with Edit and Delete action buttons.
 */

import { formatDateTime } from "@loom-loyalty/core";
import { Edit, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "../../../primitives/badge.js";
import { Button } from "../../../primitives/button.js";
import { STEP_TYPE_LABELS, type Workflow } from "./types.js";

export interface WorkflowDetailProps {
  workflow: Workflow;
  onEdit?: () => void;
  onDelete?: () => void;
  canEdit?: boolean;
  canDelete?: boolean;
}

/**
 * Extract description from localized object
 */
function getDescription(description?: Record<string, unknown>): string {
  if (!description) return "";
  const enUS = description["en-US"];
  const en = description["en"];
  if (typeof enUS === "string") return enUS;
  if (typeof en === "string") return en;
  return "";
}

/**
 * Workflow detail content for Sheet display
 */
export function WorkflowDetail({
  workflow,
  onEdit,
  onDelete,
  canEdit = true,
  canDelete = true,
}: WorkflowDetailProps): ReactNode {
  const description = getDescription(workflow.description);

  return (
    <div className="space-y-6">
      {/* Basic Information */}
      <section className="space-y-4">
        <h3 className="text-foreground text-sm font-semibold tracking-wide uppercase">
          Basic Information
        </h3>
        <div className="space-y-3">
          <DetailRow label="Name" value={workflow.name} />
          <DetailRow label="Code" value={workflow.code} mono />
          {description && <DetailRow label="Description" value={description} />}
          <div>
            <p className="text-muted-foreground text-sm">Status</p>
            <div className="mt-1">
              <Badge variant={workflow.active ? "success" : "secondary"} role="status">
                {workflow.active ? "Active" : "Inactive"}
              </Badge>
            </div>
          </div>
        </div>
      </section>

      {/* Approval Steps */}
      <section className="space-y-4">
        <h3 className="text-foreground text-sm font-semibold tracking-wide uppercase">
          Approval Steps ({workflow.steps?.length ?? 0})
        </h3>
        {workflow.steps && workflow.steps.length > 0 ? (
          <div className="space-y-2">
            {workflow.steps
              .sort((a, b) => a.orderIndex - b.orderIndex)
              .map((step, index) => (
                <div key={step.workflowStepId} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-foreground text-sm font-medium">
                        {index + 1}. {step.name}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {STEP_TYPE_LABELS[step.type] ?? step.type}
                      </p>
                    </div>
                    <Badge variant="outline" role="status" className="text-xs">
                      {step.status}
                    </Badge>
                  </div>
                </div>
              ))}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">No approval steps defined.</p>
        )}
      </section>

      {/* Timestamps */}
      <section className="space-y-4">
        <h3 className="text-foreground text-sm font-semibold tracking-wide uppercase">
          Timestamps
        </h3>
        <div className="space-y-3">
          <DetailRow label="Created" value={formatDateTime(workflow.createdDateTime) ?? "\u2014"} />
          <DetailRow
            label="Last Modified"
            value={formatDateTime(workflow.modifiedDateTime) ?? "\u2014"}
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
