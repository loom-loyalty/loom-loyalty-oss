/**
 * BulkElementImportDialog
 *
 * Power-user feature for defining many elements at once. Paste tab-separated
 * data into a textarea, get a per-row preview with validation, then import.
 *
 * Format: Name<TAB>Type<TAB>Required (one element per line)
 *
 *   Email Address    STRING    true
 *   First Name       STRING    true
 *   Phone            STRING    false
 *
 * Comma-separated input is also accepted as a fallback for users pasting from
 * a spreadsheet that defaults to commas.
 *
 * Empty lines and lines starting with `#` are skipped (comments).
 */

import { CheckCircle2, XCircle } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { cn } from "../../../lib/utils.js";
import { Button } from "../../../primitives/button.js";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../../primitives/dialog.js";
import { Label } from "../../../primitives/label.js";
import { Textarea } from "../../../primitives/textarea.js";
import { sameDataModelCode } from "./code-key.js";
import { PRIMITIVE_TYPE_CODES } from "./element-dialog.js";
import {
  nameToInputAttribute,
  type BulkElementImportDialogProps,
  type BulkImportRow,
} from "./types.js";

const PLACEHOLDER = `Email Address\tSTRING\ttrue
First Name\tSTRING\ttrue
Phone\tSTRING\tfalse
Birthday\tDATE\tfalse`;

const VALID_BOOL_TRUE = new Set(["true", "yes", "y", "1", "required"]);
const VALID_BOOL_FALSE = new Set(["false", "no", "n", "0", "optional", ""]);

/**
 * Hard cap on rows parsed per paste. A pathological 10K-row paste used to freeze
 * the tab, since parsing runs synchronously in useMemo on every keystroke.
 */
export const MAX_BULK_ROWS = 500;

export function BulkElementImportDialog({
  open,
  onOpenChange,
  onImport,
}: BulkElementImportDialogProps): ReactNode {
  const [input, setInput] = useState("");

  const { rows, truncated } = useMemo(() => parseBulkInputWithMeta(input), [input]);

  const validRows = rows.filter((r) => r.parsed !== null);
  const invalidRows = rows.filter((r) => r.parsed === null);
  const hasInput = input.trim().length > 0;
  const canImport = hasInput && validRows.length > 0 && invalidRows.length === 0;

  const handleImport = () => {
    const elements = validRows.flatMap((r) => (r.parsed ? [r.parsed] : []));
    onImport(elements);
    setInput("");
    onOpenChange(false);
  };

  const handleClose = () => {
    setInput("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Bulk Import Elements</DialogTitle>
          <DialogDescription>
            Paste tab-separated rows: <code className="font-mono text-xs">Name⇥Type⇥Required</code>.
            Lines starting with <code className="font-mono text-xs">#</code> are treated as
            comments. Required can be <code className="font-mono text-xs">true</code> /{" "}
            <code className="font-mono text-xs">false</code>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="bulk-input">Elements</Label>
            <Textarea
              id="bulk-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={PLACEHOLDER}
              rows={8}
              className="font-mono text-xs"
              autoFocus
            />
          </div>

          {hasInput && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm">Preview</Label>
                <div
                  className="flex items-center gap-3 text-xs"
                  aria-live="polite"
                  aria-atomic="true"
                >
                  <span className="text-success-dark flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                    {validRows.length} valid
                  </span>
                  {invalidRows.length > 0 && (
                    <span className="text-destructive flex items-center gap-1">
                      <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
                      {invalidRows.length} invalid
                    </span>
                  )}
                </div>
              </div>

              <div className="border-border max-h-64 overflow-y-auto rounded-md border">
                <table className="w-full text-xs">
                  <thead className="bg-muted sticky top-0">
                    <tr className="border-chrome-border border-b">
                      <th
                        scope="col"
                        className="text-chrome-muted-foreground w-8 px-2 py-1.5 text-left font-medium"
                      />
                      <th
                        scope="col"
                        className="text-chrome-muted-foreground px-2 py-1.5 text-left font-medium"
                      >
                        Name
                      </th>
                      <th
                        scope="col"
                        className="text-chrome-muted-foreground px-2 py-1.5 text-left font-medium"
                      >
                        Input Attr
                      </th>
                      <th
                        scope="col"
                        className="text-chrome-muted-foreground px-2 py-1.5 text-left font-medium"
                      >
                        Type
                      </th>
                      <th
                        scope="col"
                        className="text-chrome-muted-foreground px-2 py-1.5 text-left font-medium"
                      >
                        Required
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, idx) => (
                      <PreviewRow key={idx} row={row} />
                    ))}
                  </tbody>
                </table>
              </div>

              {truncated && (
                <div className="border-warning/30 bg-warning/5 rounded-md border p-3" role="status">
                  <p className="text-warning-foreground text-sm">
                    Only the first {MAX_BULK_ROWS} rows are shown. Import these, then paste the rest
                    in a second batch.
                  </p>
                </div>
              )}

              {invalidRows.length > 0 && (
                <div
                  className="border-destructive/30 bg-destructive/5 rounded-md border p-3"
                  role="alert"
                >
                  <p className="text-destructive text-sm">
                    Fix the {invalidRows.length} invalid {invalidRows.length === 1 ? "row" : "rows"}{" "}
                    above before importing.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary-gradient"
            onClick={handleImport}
            disabled={!canImport}
          >
            Import{" "}
            {validRows.length > 0
              ? `${validRows.length} ${validRows.length === 1 ? "Element" : "Elements"}`
              : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PreviewRow({ row }: { row: BulkImportRow }): ReactNode {
  const isValid = row.parsed !== null;
  return (
    <tr
      className={cn("border-border/60 border-t", !isValid && "bg-destructive/5")}
      title={row.error ?? undefined}
    >
      <td className="px-2 py-1.5">
        {isValid ? (
          <CheckCircle2 role="img" className="text-success-dark h-3.5 w-3.5" aria-label="Valid" />
        ) : (
          <XCircle role="img" className="text-destructive h-3.5 w-3.5" aria-label="Invalid" />
        )}
      </td>
      {isValid && row.parsed ? (
        <>
          <td className="text-foreground px-2 py-1.5">{row.parsed.name}</td>
          <td className="text-muted-foreground px-2 py-1.5 font-mono">
            {row.parsed.inputAttribute}
          </td>
          <td className="text-muted-foreground px-2 py-1.5 font-mono">{row.parsed.typeCode}</td>
          <td className="px-2 py-1.5">
            {row.parsed.required ? (
              <span className="text-success-dark">Yes</span>
            ) : (
              <span className="text-muted-foreground">No</span>
            )}
          </td>
        </>
      ) : (
        <td colSpan={4} className="text-destructive px-2 py-1.5">
          <span className="font-mono">{row.raw}</span>
          <span className="ml-2">— {row.error}</span>
        </td>
      )}
    </tr>
  );
}

/**
 * Parse the textarea content into rows, reporting whether the input exceeded MAX_BULK_ROWS.
 *
 * Each non-blank, non-comment line is parsed as Name / Type / Required (in that order).
 * Tabs are the primary delimiter; commas are accepted as a fallback. Parsing stops once
 * MAX_BULK_ROWS rows have been consumed so a pathological paste cannot freeze the tab,
 * since parsing runs synchronously in useMemo on every keystroke.
 */
export function parseBulkInputWithMeta(input: string): {
  rows: BulkImportRow[];
  truncated: boolean;
} {
  const lines = input.split(/\r?\n/);
  const rows: BulkImportRow[] = [];
  let truncated = false;

  for (const raw of lines) {
    const trimmed = raw.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    if (rows.length >= MAX_BULK_ROWS) {
      truncated = true;
      break;
    }
    rows.push(parseLine(raw));
  }

  return { rows, truncated };
}

/**
 * Array-only convenience wrapper retained for tests and other call sites that
 * do not need truncation metadata.
 */
export function parseBulkInput(input: string): BulkImportRow[] {
  return parseBulkInputWithMeta(input).rows;
}

/**
 * Case-normalize a pasted type code, but only when it names a primitive.
 *
 * Pasted input is free text, so `string` should still import as `STRING`. A code
 * that is not in the palette is a reference to a system or custom DataModelType,
 * whose code is lowercase-hyphenated under the resource-code convention
 * — upper-casing that turns `order-line-item` into
 * `ORDER-LINE-ITEM`, which resolves to nothing. Leave anything unrecognized
 * exactly as pasted.
 */
function normalizePastedTypeCode(raw: string): string {
  const trimmed = raw.trim();
  // Matched on the folded key so `date_time`, `date-time` and `DATE_TIME` all
  // resolve, and the palette's own spelling is what gets used.
  const primitive = PRIMITIVE_TYPE_CODES.find((code) => sameDataModelCode(code, trimmed));
  return primitive ?? trimmed;
}

function parseLine(raw: string): BulkImportRow {
  // Split on tabs first; if only one column, fall back to commas
  let parts = raw.split("\t").map((p) => p.trim());
  if (parts.length === 1 && raw.includes(",")) {
    parts = raw.split(",").map((p) => p.trim());
  }

  if (parts.length < 2) {
    return {
      raw,
      parsed: null,
      error: "Need at least Name and Type, separated by tab or comma.",
    };
  }

  const [name, typeCode, requiredRaw = ""] = parts;
  if (!name) {
    return { raw, parsed: null, error: "Name is empty." };
  }
  if (!typeCode) {
    return { raw, parsed: null, error: "Type is empty." };
  }

  // Validate required
  const requiredLower = requiredRaw.toLowerCase();
  let required: boolean;
  if (VALID_BOOL_TRUE.has(requiredLower)) {
    required = true;
  } else if (VALID_BOOL_FALSE.has(requiredLower)) {
    required = false;
  } else {
    return {
      raw,
      parsed: null,
      error: `Required must be true/false (got "${requiredRaw}").`,
    };
  }

  return {
    raw,
    parsed: {
      name,
      inputAttribute: nameToInputAttribute(name),
      outputAttribute: nameToInputAttribute(name),
      typeCode: normalizePastedTypeCode(typeCode),
      required,
      isArray: false,
      sensitive: false,
      inputOnly: false,
      outputOnly: false,
      createOnly: false,
    },
    error: null,
  };
}
