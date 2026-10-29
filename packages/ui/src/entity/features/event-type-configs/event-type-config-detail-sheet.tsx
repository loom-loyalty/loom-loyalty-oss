/**
 * Event Type Configuration Detail Sheet (R8, R9, R10)
 *
 * A single configuration/variant's own detail, stacked on top of the parent
 * Event Type anchor's detail sheet (KTD2) rather than rendered inline in
 * place of it. Mirrors `all-targets-sheet.tsx` / `target-detail-sheet.tsx`'s
 * sibling-`<Sheet>` stacking pattern: this component is always mounted as a
 * sibling to the anchor sheet, with its own `open`/`onOpenChange`, and is
 * reachable at its own stable, shareable link (R10) via a second search
 * param the caller wires up (see `use-detail-search-param.ts`'s `paramKey`).
 *
 * Shows this configuration's own fields (moved here from
 * `EventTypeConfigDetail`, which no longer renders them inline — see that
 * file's header comment) plus its "Referenced by" section scoped to this
 * configuration's own `eventSubTypeIdentifier` (R9) — not every rule
 * referenced by the whole event type.
 */

import { extractLocalizedString, formatDateTime } from "@loom-loyalty/core";
import type { UIEntitySchema } from "@loom-loyalty/schema";
import type { EventRule } from "@loom-loyalty/sdk";
import { Edit, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "../../../primitives/badge.js";
import { Button } from "../../../primitives/button.js";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "../../../primitives/sheet.js";
import { EnvironmentEnablementList } from "../../environment-workflow/environment-status-column.js";
import { ExtendedFieldsSection } from "../../extended-fields-section.js";
import { resolveEventTypeLabel } from "./event-type-config-columns.js";
import { EventTypeDependents } from "./event-type-dependents.js";
import type { EventTypeVariant } from "./types.js";

export interface EventTypeConfigDetailSheetProps {
  /** Whether the sheet is open. */
  open: boolean;
  /** Callback when open state changes (e.g. closing returns focus to the anchor sheet underneath). */
  onOpenChange: (open: boolean) => void;
  /** The variant this sheet displays. `null` while nothing is selected — the sheet then renders no content. */
  variant: EventTypeVariant | null;
  /** The owning event type's name, shown in the sheet's description for context. */
  eventTypeName?: string;
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
  /**
   * Dependent event rules already scoped to this configuration's
   * `eventSubTypeIdentifier` (R9, KTD3) — the caller (`useEventTypeDependents`)
   * does the scoping; this component only renders what it's given.
   */
  rules: EventRule[];
  /** True when the dependents query returned more results than `rules` contains. */
  rulesCapped?: boolean;
  /**
   * True while the dependents query's initial fetch is in flight. Forwarded
   * straight to `EventTypeDependents`'s own `rulesLoading` (the same
   * loading/error/retry handling the anchor sheet's unscoped section already
   * uses) — the configuration's own fields above and Edit/Delete below don't
   * wait on it, since they're already available synchronously from the
   * anchor page's own already-fetched data.
   */
  dependentsLoading?: boolean;
  /** True when the dependents query failed. Forwarded to `EventTypeDependents`'s `rulesError`. */
  dependentsError?: boolean;
  onRetryDependents?: () => void;
}

/**
 * Stacked configuration detail sheet — the destination for clicking a
 * variant row in `EventTypeConfigDetail` (R8).
 */
export function EventTypeConfigDetailSheet({
  open,
  onOpenChange,
  variant,
  eventTypeName,
  onEdit,
  onDelete,
  canEdit = true,
  canDelete = true,
  schema,
  extendedFields = [],
  rules,
  rulesCapped = false,
  dependentsLoading = false,
  dependentsError = false,
  onRetryDependents,
}: EventTypeConfigDetailSheetProps): ReactNode {
  const config = variant?.configuration;
  const variantLabel = variant ? variant.eventSubTypeIdentifier || "Default" : undefined;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{config?.name ?? variantLabel ?? "Configuration Details"}</SheetTitle>
          <SheetDescription>
            {eventTypeName
              ? variantLabel
                ? `${variantLabel} configuration for ${eventTypeName}`
                : eventTypeName
              : "Event type configuration details"}
          </SheetDescription>
        </SheetHeader>
        <SheetBody className="overflow-y-auto">
          {config && (
            <div className="space-y-6">
              {/* Basic Information */}
              <section className="space-y-4">
                <h3 className="text-foreground text-sm font-semibold tracking-wide uppercase">
                  Basic Information
                </h3>
                <div className="space-y-3">
                  <DetailRow label="Name" value={config.name} />
                  <DetailRow label="Code" value={config.code} mono />
                  {extractLocalizedString(config.description) && (
                    <DetailRow
                      label="Description"
                      value={extractLocalizedString(config.description)!}
                    />
                  )}
                </div>
              </section>

              {/* Event Type Configuration */}
              <section className="space-y-4">
                <h3 className="text-foreground text-sm font-semibold tracking-wide uppercase">
                  Event Type Configuration
                </h3>
                <div className="space-y-3">
                  <div>
                    <p className="text-muted-foreground text-sm">Event Type</p>
                    {resolveEventTypeLabel(config) ? (
                      <Badge variant="secondary" className="mt-1 font-normal">
                        {resolveEventTypeLabel(config)}
                      </Badge>
                    ) : (
                      <p className="text-muted-foreground text-sm">—</p>
                    )}
                  </div>
                  {config.eventSubTypeIdentifier && (
                    <DetailRow label="Sub Type Identifier" value={config.eventSubTypeIdentifier} />
                  )}
                </div>
              </section>

              {/* Processing Settings */}
              <section className="space-y-4">
                <h3 className="text-foreground text-sm font-semibold tracking-wide uppercase">
                  Processing Settings
                </h3>
                <div className="space-y-3">
                  <div>
                    <p className="text-muted-foreground text-sm">Synchronous</p>
                    <Badge
                      variant={config.synchronous ? "default" : "outline"}
                      className="mt-1 font-normal"
                    >
                      {config.synchronous ? "Sync" : "Async"}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-sm">Save Unprocessed Events</p>
                    <Badge
                      variant={config.saveUnprocessedEvent ? "default" : "outline"}
                      className="mt-1 font-normal"
                    >
                      {config.saveUnprocessedEvent ? "Enabled" : "Disabled"}
                    </Badge>
                  </div>
                </div>
              </section>

              {/* Archival Settings */}
              <section className="space-y-4">
                <h3 className="text-foreground text-sm font-semibold tracking-wide uppercase">
                  Archival Settings
                </h3>
                <div className="space-y-3">
                  <DetailRow
                    label="Processed Days Till Archival"
                    value={config.processedDaysTillArchival?.toString() ?? "—"}
                  />
                  <DetailRow
                    label="Unprocessed Days Till Archival"
                    value={config.unprocessedDaysTillArchival?.toString() ?? "—"}
                  />
                </div>
              </section>

              {/* Event Description */}
              {(config.defaultEventDescription || config.eventDescriptionJsonPath) && (
                <section className="space-y-4">
                  <h3 className="text-foreground text-sm font-semibold tracking-wide uppercase">
                    Event Description
                  </h3>
                  <div className="space-y-3">
                    {config.defaultEventDescription && (
                      <DetailRow
                        label="Default Description"
                        value={config.defaultEventDescription}
                      />
                    )}
                    {config.eventDescriptionJsonPath && (
                      <DetailRow label="JSON Path" value={config.eventDescriptionJsonPath} mono />
                    )}
                  </div>
                </section>
              )}

              {/* Environments */}
              {config.enabledInEnvironments && config.enabledInEnvironments.length > 0 && (
                <section className="space-y-4">
                  <h3 className="text-foreground text-sm font-semibold tracking-wide uppercase">
                    Enabled Environments
                  </h3>
                  <EnvironmentEnablementList enabledInEnvironments={config.enabledInEnvironments} />
                </section>
              )}

              {/* Timestamps */}
              <section className="space-y-4">
                <h3 className="text-foreground text-sm font-semibold tracking-wide uppercase">
                  Timestamps
                </h3>
                <div className="space-y-3">
                  <DetailRow
                    label="Created"
                    value={formatDateTime(config.createdDateTime) ?? "—"}
                  />
                  <DetailRow
                    label="Last Modified"
                    value={formatDateTime(config.modifiedDateTime) ?? "—"}
                  />
                </div>
              </section>

              {/* ID (if available) */}
              {config.eventTypeConfigurationId && (
                <section className="space-y-4">
                  <h3 className="text-foreground text-sm font-semibold tracking-wide uppercase">
                    System
                  </h3>
                  <DetailRow
                    label="Configuration ID"
                    value={config.eventTypeConfigurationId}
                    mono
                  />
                </section>
              )}

              {/* Extended Fields Section (from data model extensions) */}
              {schema && extendedFields.length > 0 && (
                <ExtendedFieldsSection
                  schema={schema}
                  fields={extendedFields}
                  data={config}
                  mode="view"
                  title="Additional Information"
                  defaultCollapsed={false}
                />
              )}

              {/* Referenced by (R9) — scoped to this configuration's own
                    sub-type, not the whole event type. Reuses
                    EventTypeDependents's own loading/error/retry handling
                    (the same component the anchor sheet's unscoped section
                    already uses) rather than a second, hand-rolled one. */}
              <EventTypeDependents
                rules={rules}
                rulesCapped={rulesCapped}
                rulesLoading={dependentsLoading}
                rulesError={dependentsError}
                onRetryRules={onRetryDependents}
              />

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
          )}
        </SheetBody>
      </SheetContent>
    </Sheet>
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
