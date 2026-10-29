/**
 * Program Detail Sheet Content
 *
 * Displays all Program fields with Edit and Delete action buttons.
 * Supports extended fields from data model extensions.
 */

import { extractLocalizedString, formatDateTime } from "@loom-loyalty/core";
import type { UIEntitySchema } from "@loom-loyalty/schema";
import type { Program } from "@loom-loyalty/sdk";
import { Building2, Edit, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "../../../primitives/badge.js";
import { Button } from "../../../primitives/button.js";
import { EnvironmentEnablementList } from "../../environment-workflow/environment-status-column.js";
import { ExtendedFieldsSection } from "../../extended-fields-section.js";

export interface ProgramDetailProps {
  /** Program to display */
  program: Program;
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
 * Program detail content for Sheet display
 */
export function ProgramDetail({
  program,
  onEdit,
  onDelete,
  canEdit = true,
  canDelete = true,
  schema,
  extendedFields = [],
}: ProgramDetailProps): ReactNode {
  const description = extractLocalizedString(program.description);

  return (
    <div className="space-y-6">
      {/* Basic Information */}
      <section className="space-y-4">
        <h3 className="text-foreground text-sm font-semibold tracking-wide uppercase">
          Basic Information
        </h3>
        <div className="space-y-3">
          <DetailRow label="Name" value={program.name} />
          <DetailRow label="Code" value={program.code} mono />
          {description && <DetailRow label="Description" value={description} />}
          <div>
            <p className="text-muted-foreground text-sm">Type</p>
            {program.type ? (
              <Badge variant="secondary" className="mt-1 font-normal">
                {program.type.name ?? program.type.code}
              </Badge>
            ) : (
              <p className="text-foreground font-medium">{"\u2014"}</p>
            )}
          </div>
        </div>
      </section>

      {/* Partner Information */}
      {program.partner && (
        <section className="space-y-4">
          <h3 className="text-foreground text-sm font-semibold tracking-wide uppercase">Partner</h3>
          <div className="bg-muted flex items-center gap-3 rounded-lg p-3">
            <div className="bg-primary/10 flex h-10 w-10 items-center justify-center rounded-full">
              <Building2 className="text-primary h-5 w-5" />
            </div>
            <div>
              <p className="text-foreground font-medium">{program.partner.name}</p>
              <p className="text-muted-foreground font-mono text-xs">{program.partner.code}</p>
            </div>
          </div>
        </section>
      )}

      {/* Settings */}
      <section className="space-y-4">
        <h3 className="text-foreground text-sm font-semibold tracking-wide uppercase">Settings</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-sm">
              Auto-create accounts on customer creation
            </span>
            <span
              className={
                program.createAccountOnCustomerCreation
                  ? "text-success-dark font-medium"
                  : "text-muted-foreground"
              }
            >
              {program.createAccountOnCustomerCreation ? "Enabled" : "Disabled"}
            </span>
          </div>
        </div>
      </section>

      {/* Environments */}
      {program.enabledInEnvironments && program.enabledInEnvironments.length > 0 && (
        <section className="space-y-4">
          <h3 className="text-foreground text-sm font-semibold tracking-wide uppercase">
            Enabled Environments
          </h3>
          <EnvironmentEnablementList enabledInEnvironments={program.enabledInEnvironments} />
        </section>
      )}

      {/* Timestamps */}
      <section className="space-y-4">
        <h3 className="text-foreground text-sm font-semibold tracking-wide uppercase">
          Timestamps
        </h3>
        <div className="space-y-3">
          <DetailRow label="Created" value={formatDateTime(program.createdDateTime) ?? "\u2014"} />
          <DetailRow
            label="Last Modified"
            value={formatDateTime(program.modifiedDateTime) ?? "\u2014"}
          />
        </div>
      </section>

      {/* ID (if available) */}
      {program.programId && (
        <section className="space-y-4">
          <h3 className="text-foreground text-sm font-semibold tracking-wide uppercase">System</h3>
          <DetailRow label="Program ID" value={program.programId} mono />
        </section>
      )}

      {/* Extended Fields Section (from data model extensions) */}
      {schema && extendedFields.length > 0 && (
        <ExtendedFieldsSection
          schema={schema}
          fields={extendedFields}
          data={program}
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
