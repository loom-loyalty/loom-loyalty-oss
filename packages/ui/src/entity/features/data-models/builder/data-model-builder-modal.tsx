/**
 * DataModelBuilderModal
 *
 * The one surface that earns width: schema editing at 20+ fields does not fit a
 * 384px sheet, so this is a 1240x960 centred modal: a bounded, documented
 * exception to the Sheet default (see docs/patterns/wizard-vs-sheet.md).
 *
 * Left rail authors the model's identity and picks how the fields get drafted;
 * the right pane is always the same field review table. Presentational only:
 * every value, option list and callback arrives via props.
 *
 * Origin-aware footer: opened from another surface it promises a return trip
 * ("Create & use"); opened from the Data Models list it is a plain "Create".
 */

import { Database } from "lucide-react";
import type { ReactNode } from "react";

import { LiveRegion } from "../../../../a11y/live-region.js";
import { AiLimitNotice } from "../../../../ai/ai-limit-notice.js";
import { Button } from "../../../../primitives/button.js";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../../../primitives/dialog.js";
import { BuilderLeftRail } from "./builder-left-rail.js";
import { FieldReviewTable } from "./field-review-table.js";
import { DescribeModePanel } from "./modes/describe-mode-panel.js";
import { FieldByFieldModePanel } from "./modes/field-by-field-mode-panel.js";
import { PasteSchemaModePanel } from "./modes/paste-schema-mode-panel.js";
import { SampleModePanel } from "./modes/sample-mode-panel.js";
import { hasUnresolvedRows, type DataModelBuilderModalProps } from "./types.js";

export function DataModelBuilderModal({
  open,
  onOpenChange,
  originLabel,
  name,
  onNameChange,
  extendsCode,
  onExtendsChange,
  extendsOptions,
  extendsLoading,
  extendsRequired = false,
  mode,
  onModeChange,
  describe,
  pasteSchema,
  sample,
  fields,
  onSubmit,
  isSubmitting = false,
  statusMessage = "",
  error,
  aiLimit,
}: DataModelBuilderModalProps): ReactNode {
  const unresolved = hasUnresolvedRows(fields.rows);
  const canSubmit = name.trim().length > 0 && !unresolved;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="grid h-[960px] max-h-[92vh] w-[min(1240px,95vw)] max-w-none grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0">
        <DialogHeader className="border-border border-b px-6 py-5 pr-14 text-left">
          <div className="flex items-start gap-3">
            <span
              aria-hidden="true"
              className="bg-primary/10 text-primary flex h-9 w-9 shrink-0 items-center justify-center rounded-md"
            >
              <Database className="h-4 w-4" />
            </span>
            <div className="space-y-1">
              <DialogTitle>New data model type</DialogTitle>
              {originLabel ? (
                <p className="text-muted-foreground text-xs">
                  Opened from <span className="text-foreground font-medium">{originLabel}</span>
                </p>
              ) : null}
              <DialogDescription>
                Defines the payload shape events of this type must match. Fields you declare here
                are what rules and rewards can read.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="grid min-h-0 grid-cols-[352px_minmax(0,1fr)]">
          <BuilderLeftRail
            name={name}
            onNameChange={onNameChange}
            extendsCode={extendsCode}
            onExtendsChange={onExtendsChange}
            extendsOptions={extendsOptions}
            extendsLoading={extendsLoading}
            extendsRequired={extendsRequired}
            mode={mode}
            onModeChange={onModeChange}
            disabled={isSubmitting}
          >
            {mode === "describe" ? <DescribeModePanel {...describe} /> : null}
            {mode === "paste-schema" ? <PasteSchemaModePanel {...pasteSchema} /> : null}
            {mode === "field-by-field" ? <FieldByFieldModePanel /> : null}
            {mode === "sample" ? <SampleModePanel {...sample} /> : null}
          </BuilderLeftRail>

          <div className="min-h-0 overflow-y-auto p-6">
            <FieldReviewTable {...fields} disabled={fields.disabled ?? isSubmitting} />
          </div>
        </div>

        <div className="border-border border-t px-6 py-4">
          <LiveRegion message={statusMessage} />
          {aiLimit ? (
            <AiLimitNotice limit={aiLimit} className="mb-3" />
          ) : error ? (
            <p
              role="alert"
              className="border-destructive/30 bg-destructive/5 text-destructive mb-3 rounded-md border p-3 text-sm"
            >
              {error}
            </p>
          ) : null}
          <DialogFooter className="flex-row items-center gap-4 sm:justify-between sm:space-x-0">
            {originLabel ? (
              <p className="text-muted-foreground min-w-0 text-xs">
                Returns you to <span className="text-foreground font-medium">{originLabel}</span>{" "}
                with this model selected
              </p>
            ) : (
              <span />
            )}
            <div className="flex shrink-0 items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="primary-gradient"
                onClick={onSubmit}
                disabled={!canSubmit || isSubmitting}
              >
                {originLabel ? "Create & use" : "Create"}
              </Button>
            </div>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
