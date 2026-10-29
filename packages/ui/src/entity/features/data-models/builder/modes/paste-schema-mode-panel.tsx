/**
 * PasteSchemaModePanel
 *
 * Typed or pasted text only: a JSON Schema, or a sample payload body the
 * fields are read out of. File-based input is the Sample mode's job.
 */

import type { ReactNode } from "react";

import { Label } from "../../../../../primitives/label.js";
import { Textarea } from "../../../../../primitives/textarea.js";
import type { PasteSchemaModePanelProps } from "../types.js";

export function PasteSchemaModePanel({
  value,
  onValueChange,
  disabled = false,
}: PasteSchemaModePanelProps): ReactNode {
  return (
    <div className="space-y-2">
      <Label htmlFor="builder-paste-schema">JSON Schema or sample payload</Label>
      <Textarea
        id="builder-paste-schema"
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        disabled={disabled}
        spellCheck={false}
        placeholder={'{\n  "orderId": "ord_123",\n  "total": 42.5,\n  "currency": "USD"\n}'}
        className="min-h-[176px] font-mono text-xs"
      />
      <p className="text-muted-foreground text-xs">
        Paste a JSON Schema, a single object, or an array of objects.
      </p>
    </div>
  );
}
