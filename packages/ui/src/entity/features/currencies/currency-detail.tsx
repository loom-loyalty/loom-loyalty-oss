/**
 * Currency Detail Sheet Content
 *
 * Displays all ProgramCurrency fields with Edit and Delete action buttons.
 * Supports extended fields from data model extensions.
 */

import { extractLocalizedString, formatDateTime } from "@loom-loyalty/core";
import type { UIEntitySchema } from "@loom-loyalty/schema";
import type { ProgramCurrency } from "@loom-loyalty/sdk";
import { Edit, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { ProgramBadgeList } from "../../../data-display/program-badge-list.js";
import { Badge } from "../../../primitives/badge.js";
import { Button } from "../../../primitives/button.js";
import { EnvironmentEnablementList } from "../../environment-workflow/environment-status-column.js";
import { ExtendedFieldsSection } from "../../extended-fields-section.js";

export interface CurrencyDetailProps {
  /** Currency to display */
  currency: ProgramCurrency;
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
 * Currency detail content for Sheet display
 */
export function CurrencyDetail({
  currency,
  onEdit,
  onDelete,
  canEdit = true,
  canDelete = true,
  schema,
  extendedFields = [],
}: CurrencyDetailProps): ReactNode {
  const description = extractLocalizedString(currency.description);

  return (
    <div className="space-y-6">
      {/* Basic Information */}
      <section className="space-y-4">
        <h3 className="text-foreground text-sm font-semibold tracking-wide uppercase">
          Basic Information
        </h3>
        <div className="space-y-3">
          <DetailRow label="Name" value={currency.name} />
          <DetailRow label="Code" value={currency.code} mono />
          {description && <DetailRow label="Description" value={description} />}
          <div>
            <p className="text-muted-foreground text-sm">Currency Type</p>
            {currency.currencyType ? (
              <Badge variant="secondary" className="mt-1 font-normal">
                {currency.currencyType.name ?? currency.currencyType.code}
              </Badge>
            ) : (
              <p className="text-foreground font-medium">{"\u2014"}</p>
            )}
          </div>
        </div>
      </section>

      {/* Programs */}
      {currency.programIds && currency.programIds.length > 0 && (
        <section className="space-y-4">
          <h3 className="text-foreground text-sm font-semibold tracking-wide uppercase">
            Associated Programs
          </h3>
          <div role="group" aria-label="Associated programs">
            <ProgramBadgeList programIds={currency.programIds} maxVisible={5} />
          </div>
        </section>
      )}

      {/* Rules */}
      {(currency.pendingRule || currency.expiryRule) && (
        <section className="space-y-4">
          <h3 className="text-foreground text-sm font-semibold tracking-wide uppercase">Rules</h3>
          <div className="space-y-3">
            {currency.pendingRule && (
              <div>
                <p className="text-muted-foreground text-sm">Pending Rule</p>
                <p className="text-foreground font-medium">{currency.pendingRule.name}</p>
                <p className="text-muted-foreground font-mono text-xs">
                  {currency.pendingRule.code}
                </p>
              </div>
            )}
            {currency.expiryRule && (
              <div>
                <p className="text-muted-foreground text-sm">Expiry Rule</p>
                <p className="text-foreground font-medium">{currency.expiryRule.name}</p>
                <p className="text-muted-foreground font-mono text-xs">
                  {currency.expiryRule.code}
                </p>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Environments */}
      {currency.enabledInEnvironments && currency.enabledInEnvironments.length > 0 && (
        <section className="space-y-4">
          <h3 className="text-foreground text-sm font-semibold tracking-wide uppercase">
            Enabled Environments
          </h3>
          <EnvironmentEnablementList enabledInEnvironments={currency.enabledInEnvironments} />
        </section>
      )}

      {/* Timestamps */}
      <section className="space-y-4">
        <h3 className="text-foreground text-sm font-semibold tracking-wide uppercase">
          Timestamps
        </h3>
        <div className="space-y-3">
          <DetailRow label="Created" value={formatDateTime(currency.createdDateTime) ?? "\u2014"} />
          <DetailRow
            label="Last Modified"
            value={formatDateTime(currency.modifiedDateTime) ?? "\u2014"}
          />
        </div>
      </section>

      {/* ID (if available) */}
      {currency.programCurrencyId && (
        <section className="space-y-4">
          <h3 className="text-foreground text-sm font-semibold tracking-wide uppercase">System</h3>
          <DetailRow label="Currency ID" value={currency.programCurrencyId} mono />
        </section>
      )}

      {/* Extended Fields Section (from data model extensions) */}
      {schema && extendedFields.length > 0 && (
        <ExtendedFieldsSection
          schema={schema}
          fields={extendedFields}
          data={currency}
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
