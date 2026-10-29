/**
 * Event Type Anchor Detail Sheet Content
 *
 * Displays the merged Event Type anchor's Identity plus its Configuration
 * Variants list. Per-variant field detail (Basic Information, Processing
 * Settings, Edit/Delete, etc.) no longer renders inline here (R8) — clicking
 * a variant row opens a separate, stacked `EventTypeConfigDetailSheet`
 * instead. See that component for the per-variant field rendering this
 * component used to inline-expand in place.
 */

import { Globe, Plus } from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "../../../primitives/badge.js";
import { Button } from "../../../primitives/button.js";
import type { EventTypeVariant } from "./types.js";

export interface EventTypeConfigDetailProps {
  /**
   * The merged anchor's identity, from the `EVENT_TYPE` metadata record (R1, R3).
   * Renders an Identity section above Configuration Variants when provided.
   */
  eventTypeIdentity?: { name: string; code: string; description?: string; dataModelCode?: string };
  /**
   * Every sub-type variant on this anchor (R2) — always at least one when the
   * anchor has any configuration. Renders a Configuration Variants list;
   * clicking a variant opens that variant's own stacked detail sheet (R8).
   */
  variants?: EventTypeVariant[];
  /**
   * The variant whose stacked detail sheet is currently open, for
   * highlighting the active row (purely cosmetic — no inline rendering).
   */
  selectedEventSubTypeIdentifier?: string;
  /** Fires when a variant row is clicked — opens its stacked detail sheet (R8). */
  onSelectVariant?: (variant: EventTypeVariant) => void;
  /**
   * "+ New rule" (R7, KTD3) — lives on each variant's row rather than a
   * single event-type-level button, since the trigger a contextual rule
   * creation implies is event type PLUS sub-type; a multi-variant anchor has
   * no single unambiguous variant to imply without a per-row entry point.
   * Omitted entirely (no top-level fallback invented) per the plan's parked
   * "multi-variant top-level entry point" open question.
   */
  onNewRule?: (variant: EventTypeVariant) => void;
  /**
   * "Enable in Environment", restored per-variant: each sub-type variant is
   * its own configuration record, so environment enablement is a per-row
   * action here rather than a single anchor-level one.
   */
  onEnableVariant?: (variant: EventTypeVariant) => void;
  /**
   * "+ Add Configuration" (R6, R7) — the sole configuration-creation entry
   * point, rendered as a trailing row after the Configuration Variants list.
   * Unlike `onNewRule`, this is anchor-level rather than per-variant: it
   * opens the configuration form pre-bound and locked to the event type this
   * detail sheet is already showing, so no variant-specific target is needed.
   */
  onAddConfiguration?: () => void;
}

/**
 * Event type configuration detail content for Sheet display
 */
export function EventTypeConfigDetail({
  eventTypeIdentity,
  variants,
  selectedEventSubTypeIdentifier,
  onSelectVariant,
  onNewRule,
  onEnableVariant,
  onAddConfiguration,
}: EventTypeConfigDetailProps): ReactNode {
  return (
    <div className="space-y-6">
      {/* Identity (R1, R3) — the merged anchor's own name/code/description/schema, distinct from this variant's configuration name below. */}
      {eventTypeIdentity && (
        <section className="space-y-4">
          <h3 className="text-foreground text-sm font-semibold tracking-wide uppercase">
            Identity
          </h3>
          <div className="space-y-3">
            <DetailRow label="Name" value={eventTypeIdentity.name} />
            <DetailRow label="Code" value={eventTypeIdentity.code} mono />
            {eventTypeIdentity.description && (
              <DetailRow label="Description" value={eventTypeIdentity.description} />
            )}
            {eventTypeIdentity.dataModelCode && (
              <div>
                <p className="text-muted-foreground text-sm">Data Model</p>
                <Badge variant="secondary" className="mt-1 font-normal">
                  {eventTypeIdentity.dataModelCode}
                </Badge>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Configuration Variants (R2) — always rendered when provided, even with a single "Default" variant. */}
      {variants && (
        <section className="space-y-4">
          <h3 className="text-foreground text-sm font-semibold tracking-wide uppercase">
            Configuration Variants
          </h3>
          {variants.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No configuration yet for this event type.
            </p>
          ) : (
            <ul className="divide-border divide-y rounded-lg border">
              {variants.map((variant) => {
                // `selectedEventSubTypeIdentifier` being `undefined` must mean
                // "no variant's sheet is open" — not "match the Default
                // variant". The Default variant's own `eventSubTypeIdentifier`
                // is `""`, so coalescing `undefined` to `""` here would make
                // it render pre-selected even when nothing is open.
                const isSelected =
                  selectedEventSubTypeIdentifier !== undefined &&
                  variant.eventSubTypeIdentifier === selectedEventSubTypeIdentifier;
                const variantLabel = variant.eventSubTypeIdentifier || "Default";
                return (
                  <li
                    key={variant.eventSubTypeIdentifier || "default"}
                    className={
                      isSelected
                        ? "bg-muted flex items-center justify-between gap-2 px-3 py-2"
                        : "hover:bg-muted/50 flex items-center justify-between gap-2 px-3 py-2"
                    }
                  >
                    <button
                      type="button"
                      onClick={() => onSelectVariant?.(variant)}
                      aria-current={isSelected ? "true" : undefined}
                      className="flex min-w-0 flex-1 items-center justify-between gap-2 text-left"
                    >
                      <span className="text-foreground text-sm font-medium">{variantLabel}</span>
                      <Badge
                        variant={variant.configuration.synchronous ? "default" : "outline"}
                        className="font-normal"
                      >
                        {variant.configuration.synchronous ? "Sync" : "Async"}
                      </Badge>
                    </button>
                    {onNewRule && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="shrink-0"
                        onClick={() => onNewRule(variant)}
                        aria-label={`New rule for ${variantLabel}`}
                      >
                        <Plus className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                        New rule
                      </Button>
                    )}
                    {onEnableVariant && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="shrink-0"
                        onClick={() => onEnableVariant(variant)}
                        aria-label={`Enable ${variantLabel} in environment`}
                      >
                        <Globe className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                        Enable
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          {onAddConfiguration && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full"
              onClick={onAddConfiguration}
            >
              <Plus className="mr-2 h-3.5 w-3.5" aria-hidden="true" />
              Add Configuration
            </Button>
          )}
        </section>
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
