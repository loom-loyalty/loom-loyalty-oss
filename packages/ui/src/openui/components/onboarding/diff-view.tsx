import { useTriggerAction } from "@openuidev/react-lang";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";

import { cn } from "../../../lib/utils";
import { Badge } from "../../../primitives/badge";
import { Button } from "../../../primitives/button";
import { Checkbox } from "../../../primitives/checkbox";
import { Label } from "../../../primitives/label";
import { defineOpenUIComponent } from "../../types";

// 50-op threshold ≈ 5s wall clock — match the Hub's UpdatePlanView so apply-time guidance is consistent across surfaces.
const LARGE_BATCH_THRESHOLD = 50;
// Cap each section's rendered op count. Beyond this the user can't realistically review; remaining ops shown via overflow count and the user gets pointed at /programs/upload-template for a full-screen review.
const SECTION_MAX_ROWS = 100;

const opSchema = z.object({
  kind: z.enum(["create", "update", "delete"]),
  entityType: z.string(),
  summary: z.string(),
  reason: z.string().optional(),
  category: z.enum(["safe", "breaking", "dataLoss"]),
  defaultChecked: z.boolean().optional(),
  // Optional disabled-with-hint pattern (e.g., shared eventType rename).
  disabled: z.boolean().optional(),
  disabledHint: z.string().optional(),
  // Optional payload the agent attaches to each op so the click-back can rebuild the apply_program_update operations[] without re-deriving entity IDs.
  payload: z.record(z.string(), z.unknown()).optional(),
  // Required for update/delete ops; ignored for create. Matches ApplyOperation.id.
  id: z.string().optional(),
});

type DiffOp = z.infer<typeof opSchema>;

const diffViewProps = z.object({
  programCode: z.string().describe("Program code the diff targets."),
  ops: z
    .array(opSchema)
    .max(SECTION_MAX_ROWS * 3)
    .describe(
      "Array of classified diff ops. Each op belongs to one of three categories (safe/breaking/dataLoss); the component groups them visually."
    ),
  applyLabel: z.string().optional().describe("Label for the Apply button. Default: 'Apply'."),
  /** Apply is disabled when this is true regardless of selection (e.g., updateSafe=false). */
  disabled: z.boolean().optional(),
  disabledHint: z.string().optional(),
  /** User-message string the click sends back via triggerAction — picks up the rest of the apply flow on the agent side. Required to wire Apply. */
  applyAction: z
    .string()
    .optional()
    .describe(
      "User-message string sent via triggerAction when the user clicks Apply. The structured action payload carries { programCode, operations } to apply_program_update. Defaults to 'Apply selected updates.'"
    ),
});

export const LoomDiffView = defineOpenUIComponent({
  name: "LoomDiffView",
  props: diffViewProps,
  description:
    "UPDATE-mode diff preview for in-chat program template upload. Renders Safe / Breaking / Data Loss sections with a checkbox + summary + reason per op. Mirrors apps/hub/src/features/template-upload/update-plan-view.tsx. The Apply button is enabled iff at least one op is checked. Clicking Apply triggers an action with the selected operations[] so the agent can dispatch apply_program_update.",
  component: ({ props }) => {
    // Stable identity for `ops` — without useMemo, the `?? []` fallback fabricates a fresh array reference on every render, which would invalidate the useMemo + useEffect deps below and reset the user's checkbox state on every parent render.
    const ops = useMemo(() => props.ops ?? [], [props.ops]);
    const applyLabel = props.applyLabel ?? "Apply";
    const applyAction = props.applyAction ?? "Apply selected updates.";
    const disabledGlobal = props.disabled ?? false;
    const disabledHint = props.disabledHint;

    const triggerAction = useTriggerAction();

    // Per-op visibility: rows beyond SECTION_MAX_ROWS in their own category
    // are hidden behind the overflow notice. They MUST NOT contribute to the
    // apply payload — the user can't deselect what they can't see.
    const visible = useMemo(() => {
      const counts = { safe: 0, breaking: 0, dataLoss: 0 };
      return ops.map((op) => {
        counts[op.category] += 1;
        return counts[op.category] <= SECTION_MAX_ROWS;
      });
    }, [ops]);

    const [checked, setChecked] = useState<boolean[]>(() =>
      ops.map((op) => (op.defaultChecked ?? op.category !== "dataLoss") && !op.disabled)
    );

    // If the agent re-renders with a different ops array (e.g., after the user disables a shared-eventType rename and the LLM emits a refined diff), reset checked state to match the new defaults. Without this, new ops at the end of the array would silently be treated as unchecked regardless of defaultChecked.
    useEffect(() => {
      setChecked(
        ops.map((op) => (op.defaultChecked ?? op.category !== "dataLoss") && !op.disabled)
      );
    }, [ops]);

    const checkedCount = checked.reduce(
      (n, c, i) => (c && visible[i] && !ops[i]?.disabled ? n + 1 : n),
      0
    );
    const dataLossCheckedCount = ops.reduce(
      (n, op, i) => (op.category === "dataLoss" && checked[i] && visible[i] ? n + 1 : n),
      0
    );
    const total = ops.length;

    const applyDisabled = disabledGlobal || total === 0 || checkedCount === 0;

    const toggle = (idx: number) => {
      setChecked((prev) => {
        if (ops[idx]?.disabled) return prev;
        const next = [...prev];
        next[idx] = !next[idx];
        return next;
      });
    };

    const handleApply = () => {
      // Build the selected-operations payload. Drop: unchecked, disabled, overflow-hidden, and structurally-incomplete rows. The server's applyOperationSchema enforces `id: z.string().min(1)` for update/delete, so emitting `id: ""` would 400 with ToolInputParsingException — filter those out client-side so the user sees a clean apply attempt instead of a generic schema error.
      type ApplyOp =
        | { op: "create"; entityType: string; payload: Record<string, unknown> }
        | { op: "update"; entityType: string; id: string; payload: Record<string, unknown> }
        | { op: "delete"; entityType: string; id: string };
      const operations = ops
        .map((op, i) => ({ op, i }))
        .filter(({ op, i }) => checked[i] && visible[i] && !op.disabled)
        .flatMap(({ op }): ApplyOp[] => {
          if (op.kind === "create") {
            return [{ op: "create", entityType: op.entityType, payload: op.payload ?? {} }];
          }
          // update / delete require a non-empty id from the agent's diff payload.
          if (!op.id) return [];
          if (op.kind === "delete") {
            return [{ op: "delete", entityType: op.entityType, id: op.id }];
          }
          return [
            {
              op: "update",
              entityType: op.entityType,
              id: op.id,
              payload: op.payload ?? {},
            },
          ];
        });
      triggerAction(applyAction, undefined, {
        type: "apply_program_update",
        params: { programCode: props.programCode, operations },
      });
    };

    if (total === 0) {
      return (
        <section className="border-border bg-muted/40 space-y-3 rounded-md border p-4">
          <h3 className="text-foreground text-base font-semibold">No changes</h3>
          <p className="text-muted-foreground text-sm">
            The uploaded template matches the existing program. Nothing to apply.
          </p>
        </section>
      );
    }

    return (
      <section className="space-y-3" aria-label="Update plan">
        <header className="flex items-center justify-between">
          <h3 className="text-foreground text-base font-semibold">
            Update plan for{" "}
            <code className="bg-muted rounded px-1.5 py-0.5 text-sm">{props.programCode}</code>
          </h3>
          <Badge variant="secondary" aria-label={`${total} total operations`}>
            {total} op{total === 1 ? "" : "s"}
          </Badge>
        </header>

        {disabledGlobal && disabledHint ? (
          <div
            role="alert"
            className="border-destructive/40 bg-destructive/10 text-destructive rounded-md border p-3 text-sm"
          >
            {disabledHint}
          </div>
        ) : null}

        {checkedCount >= LARGE_BATCH_THRESHOLD ? (
          <div
            role="alert"
            className="border-warning/40 bg-warning/10 text-warning-foreground rounded-md border p-3 text-sm"
          >
            <strong>Heads up:</strong> this is a {checkedCount}-op apply. Sequential dispatch takes
            ~{Math.ceil(checkedCount / 10)}s; another admin editing this program during the window
            can be silently overwritten. Pause concurrent edits while applying.
          </div>
        ) : null}

        {dataLossCheckedCount > 0 ? (
          <div
            role="alert"
            className="border-destructive/40 bg-destructive/10 text-destructive rounded-md border p-3 text-sm"
          >
            <strong>Irreversible:</strong> {dataLossCheckedCount} delete op
            {dataLossCheckedCount === 1 ? "" : "s"} selected. Removed entities and their associated
            data cannot be recovered after Apply.
          </div>
        ) : null}

        <Region
          labelId="loom-diff-safe"
          heading="Safe changes"
          tone="bg-success/10 border-success/30"
          empty={visible.every((v, i) => !(v && ops[i]?.category === "safe"))}
          emptyMessage="No safe changes."
        >
          {renderOps(ops, checked, toggle, "safe")}
        </Region>

        <Region
          labelId="loom-diff-breaking"
          heading="Breaking changes"
          tone="bg-warning/10 border-warning/30"
          empty={visible.every((v, i) => !(v && ops[i]?.category === "breaking"))}
          emptyMessage="No breaking changes."
        >
          <p className="text-muted-foreground px-2 text-xs">
            Warning: these recreate or coordinate downstream consumers. Review before applying.
          </p>
          {renderOps(ops, checked, toggle, "breaking")}
        </Region>

        <Region
          labelId="loom-diff-data-loss"
          heading="Data loss"
          tone="bg-destructive/10 border-destructive/30"
          empty={visible.every((v, i) => !(v && ops[i]?.category === "dataLoss"))}
          emptyMessage="No removals."
        >
          <p className="text-destructive px-2 text-xs">
            Removals delete persisted data. Default unchecked — opt in explicitly.
          </p>
          {renderOps(ops, checked, toggle, "dataLoss")}
        </Region>

        <div className="flex items-center justify-end gap-3">
          <span className="text-muted-foreground text-sm" aria-live="polite">
            {checkedCount} selected
          </span>
          <Button type="button" disabled={applyDisabled} onClick={handleApply}>
            {applyLabel}
          </Button>
        </div>
      </section>
    );
  },
});

function renderOps(
  ops: DiffOp[],
  checked: boolean[],
  toggle: (idx: number) => void,
  category: DiffOp["category"]
) {
  let count = 0;
  return ops.map((op, idx) => {
    if (op.category !== category) return null;
    count += 1;
    if (count > SECTION_MAX_ROWS) {
      if (count === SECTION_MAX_ROWS + 1) {
        return (
          <p key={`overflow-${category}`} className="text-muted-foreground px-2 text-xs italic">
            Showing first {SECTION_MAX_ROWS} of this section. Open the program in
            /programs/upload-template for the full diff.
          </p>
        );
      }
      return null;
    }
    return (
      <Row
        key={`${category}-${idx}`}
        id={`loom-diff-${category}-${idx}`}
        checked={!op.disabled && (checked[idx] ?? false)}
        onChange={() => toggle(idx)}
        title={`${op.kind} ${op.entityType} — ${op.summary}`}
        subtitle={op.reason}
        disabled={op.disabled}
        disabledHint={op.disabledHint}
      />
    );
  });
}

function Region({
  labelId,
  heading,
  tone,
  empty,
  emptyMessage,
  children,
}: {
  labelId: string;
  heading: string;
  tone: string;
  empty: boolean;
  emptyMessage: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={labelId} className={cn("space-y-2 rounded-md border p-3", tone)}>
      <h4 id={labelId} className="text-foreground text-sm font-semibold">
        {heading}
      </h4>
      {empty ? <p className="text-muted-foreground text-xs">{emptyMessage}</p> : children}
    </section>
  );
}

function Row({
  id,
  checked,
  onChange,
  title,
  subtitle,
  disabled = false,
  disabledHint,
}: {
  id: string;
  checked: boolean;
  onChange: () => void;
  title: string;
  subtitle?: string;
  disabled?: boolean;
  disabledHint?: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <Checkbox
        id={id}
        checked={disabled ? false : checked}
        onCheckedChange={disabled ? undefined : onChange}
        disabled={disabled}
        className="mt-1"
      />
      <Label
        htmlFor={id}
        className={cn(
          "text-sm leading-snug",
          disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"
        )}
      >
        <span className="text-foreground font-medium">
          {title}
          {disabledHint ? (
            <span className="text-muted-foreground ml-2 text-xs font-normal italic">
              ({disabledHint})
            </span>
          ) : null}
        </span>
        {subtitle ? <span className="text-muted-foreground block text-xs">{subtitle}</span> : null}
      </Label>
    </div>
  );
}
