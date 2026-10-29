import "@testing-library/jest-dom/vitest";

import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

// Module-level spy: every useTriggerAction() call returns this same fn so
// tests can assert on the click-back payload after firing Apply.
const triggerActionSpy = vi.fn();

vi.mock("@openuidev/react-lang", () => ({
  defineComponent: (config: Record<string, unknown>) => ({
    ...config,
    ref: z.any(),
  }),
  useTriggerAction: () => triggerActionSpy,
}));

import { LoomDiffView } from "../components/onboarding/diff-view";

const Component = LoomDiffView.component;
const renderNode = (value: unknown) => <span>{String(value)}</span>;

const safeOp = (i: number) => ({
  kind: "update" as const,
  entityType: "tier",
  summary: `silver name → S${i}`,
  reason: "field rename — same shape, same id",
  category: "safe" as const,
});

const breakingOp = () => ({
  kind: "update" as const,
  entityType: "eventType",
  summary: "code rename: purchase → checkout",
  reason: "renames coordinate downstream consumers",
  category: "breaking" as const,
});

const dataLossOp = () => ({
  kind: "delete" as const,
  entityType: "tier",
  summary: "bronze",
  reason: "removed from template",
  category: "dataLoss" as const,
});

describe("LoomDiffView", () => {
  it("renders no-changes state when ops is empty", () => {
    render(<Component props={{ programCode: "demo", ops: [] }} renderNode={renderNode} />);
    expect(screen.getByText("No changes")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /apply/i })).not.toBeInTheDocument();
  });

  it("renders three sections in order: Safe, Breaking, Data Loss", () => {
    render(
      <Component
        props={{
          programCode: "demo",
          ops: [safeOp(1), breakingOp(), dataLossOp()],
        }}
        renderNode={renderNode}
      />
    );
    const headings = screen.getAllByRole("heading", { level: 4 }).map((h) => h.textContent);
    expect(headings).toEqual(["Safe changes", "Breaking changes", "Data loss"]);
  });

  it("defaults safe + breaking checked, data-loss unchecked", () => {
    render(
      <Component
        props={{
          programCode: "demo",
          ops: [safeOp(1), breakingOp(), dataLossOp()],
        }}
        renderNode={renderNode}
      />
    );
    const checkboxes = screen.getAllByRole("checkbox");
    expect(checkboxes).toHaveLength(3);
    // safe + breaking checked (data-checked-state from Radix UI).
    expect(checkboxes[0]).toHaveAttribute("data-state", "checked");
    expect(checkboxes[1]).toHaveAttribute("data-state", "checked");
    expect(checkboxes[2]).toHaveAttribute("data-state", "unchecked");
  });

  it("Apply button disabled when no ops checked", () => {
    render(
      <Component props={{ programCode: "demo", ops: [dataLossOp()] }} renderNode={renderNode} />
    );
    const applyBtn = screen.getByRole("button", { name: /apply/i });
    expect(applyBtn).toBeDisabled();
  });

  it("Apply button enabled once user checks a data-loss op", () => {
    render(
      <Component props={{ programCode: "demo", ops: [dataLossOp()] }} renderNode={renderNode} />
    );
    const checkbox = screen.getByRole("checkbox");
    fireEvent.click(checkbox);
    expect(screen.getByRole("button", { name: /apply/i })).toBeEnabled();
  });

  it("shows irreversible warning when any data-loss op is checked", () => {
    render(
      <Component
        props={{
          programCode: "demo",
          ops: [safeOp(1), dataLossOp(), dataLossOp()],
        }}
        renderNode={renderNode}
      />
    );
    const dataLossCheckbox = screen.getAllByRole("checkbox")[1]!;
    fireEvent.click(dataLossCheckbox);
    expect(screen.getByText(/irreversible/i)).toBeInTheDocument();
    expect(screen.getByText(/1 delete op/i)).toBeInTheDocument();
  });

  it("shows large-batch advisory at 50+ ops checked", () => {
    const ops = Array.from({ length: 60 }, (_, i) => safeOp(i));
    render(<Component props={{ programCode: "demo", ops }} renderNode={renderNode} />);
    expect(screen.getByText(/heads up/i)).toBeInTheDocument();
    expect(screen.getByText(/60-op apply/i)).toBeInTheDocument();
  });

  it("respects disabled prop with disabledHint banner", () => {
    render(
      <Component
        props={{
          programCode: "demo",
          ops: [safeOp(1)],
          disabled: true,
          disabledHint: "Update unsafe: tiers list was truncated.",
        }}
        renderNode={renderNode}
      />
    );
    expect(screen.getByRole("alert")).toHaveTextContent("tiers list was truncated");
    expect(screen.getByRole("button", { name: /apply/i })).toBeDisabled();
  });

  it("disabled op renders disabled checkbox with hint", () => {
    render(
      <Component
        props={{
          programCode: "demo",
          ops: [
            {
              kind: "update",
              entityType: "eventType",
              summary: "rename purchase → checkout",
              category: "breaking",
              disabled: true,
              disabledHint: "shared with other programs",
            },
          ],
        }}
        renderNode={renderNode}
      />
    );
    expect(screen.getByRole("checkbox")).toBeDisabled();
    expect(screen.getByText(/shared with other programs/i)).toBeInTheDocument();
  });

  it("renders programCode in the header", () => {
    render(
      <Component
        props={{ programCode: "coffee-loyalty", ops: [safeOp(1)] }}
        renderNode={renderNode}
      />
    );
    expect(screen.getByText("coffee-loyalty")).toBeInTheDocument();
  });

  it("truncates a section to SECTION_MAX_ROWS (100) and shows overflow notice", () => {
    const ops = Array.from({ length: 105 }, (_, i) => safeOp(i));
    render(<Component props={{ programCode: "demo", ops }} renderNode={renderNode} />);
    // First 100 rendered as checkboxes; the rest replaced by an overflow note.
    expect(screen.getAllByRole("checkbox")).toHaveLength(100);
    expect(screen.getByText(/Showing first 100/)).toBeInTheDocument();
  });

  it("re-syncs checked state when the ops prop changes after mount", () => {
    // The LLM may rerender LoomDiffView with a refined ops list mid-turn (e.g., after the user asks to drop a data-loss op). useState's initializer runs once at mount, so the checked array would otherwise keep its old length. A useEffect resyncs against ops.
    const initialOps = [safeOp(1)];
    const { rerender } = render(
      <Component props={{ programCode: "demo", ops: initialOps }} renderNode={renderNode} />
    );
    expect(screen.getAllByRole("checkbox")).toHaveLength(1);

    const nextOps = [safeOp(2), breakingOp()];
    rerender(<Component props={{ programCode: "demo", ops: nextOps }} renderNode={renderNode} />);
    const cbs = screen.getAllByRole("checkbox");
    expect(cbs).toHaveLength(2);
    expect(cbs[0]).toHaveAttribute("data-state", "checked");
    expect(cbs[1]).toHaveAttribute("data-state", "checked");
  });

  describe("Apply click-back via useTriggerAction", () => {
    beforeEach(() => triggerActionSpy.mockReset());

    it("triggers the action with the agent-supplied applyAction string + structured params", () => {
      render(
        <Component
          props={{
            programCode: "coffee",
            applyAction: "Apply 1 update.",
            ops: [
              {
                ...safeOp(1),
                id: "tier_abc",
                payload: { name: "Silver" },
              },
            ],
          }}
          renderNode={renderNode}
        />
      );
      fireEvent.click(screen.getByRole("button", { name: /apply/i }));
      expect(triggerActionSpy).toHaveBeenCalledTimes(1);
      const [userMessage, formName, action] = triggerActionSpy.mock.calls[0]!;
      expect(userMessage).toBe("Apply 1 update.");
      expect(formName).toBeUndefined();
      expect(action).toMatchObject({
        type: "apply_program_update",
        params: {
          programCode: "coffee",
          operations: [
            { op: "update", entityType: "tier", id: "tier_abc", payload: { name: "Silver" } },
          ],
        },
      });
    });

    it("only sends checked ops in the apply payload", () => {
      render(
        <Component
          props={{
            programCode: "demo",
            ops: [
              { ...safeOp(1), id: "tier_a", payload: { name: "A" } },
              { ...safeOp(2), id: "tier_b", payload: { name: "B" } },
            ],
          }}
          renderNode={renderNode}
        />
      );
      // Both default-checked (safe). Uncheck the first.
      const checkboxes = screen.getAllByRole("checkbox");
      fireEvent.click(checkboxes[0]!);
      fireEvent.click(screen.getByRole("button", { name: /apply/i }));
      const action = triggerActionSpy.mock.calls[triggerActionSpy.mock.calls.length - 1]?.[2] as
        | { params: { operations: unknown[] } }
        | undefined;
      expect(action?.params.operations).toHaveLength(1);
      expect((action?.params.operations[0] as { id: string }).id).toBe("tier_b");
    });

    it("excludes overflow-hidden rows from the apply payload even if defaultChecked", () => {
      // 105 safe ops, all default-checked. The visible cap is 100. Only the
      // first 100 should flow into the apply payload — the invisible 5 are
      // dropped (user couldn't deselect what they couldn't see).
      const ops = Array.from({ length: 105 }, (_, i) => ({
        ...safeOp(i),
        id: `tier_${i}`,
        payload: { idx: i },
      }));
      render(<Component props={{ programCode: "demo", ops }} renderNode={renderNode} />);
      fireEvent.click(screen.getByRole("button", { name: /apply/i }));
      const action = triggerActionSpy.mock.calls[triggerActionSpy.mock.calls.length - 1]?.[2] as
        | { params: { operations: { id: string }[] } }
        | undefined;
      expect(action?.params.operations).toHaveLength(100);
      expect(action?.params.operations[action.params.operations.length - 1]?.id).toBe("tier_99");
    });

    it("disabled ops are excluded from the apply payload even when checked", () => {
      render(
        <Component
          props={{
            programCode: "demo",
            ops: [
              {
                ...safeOp(1),
                id: "tier_disabled",
                disabled: true,
                defaultChecked: true,
              },
              { ...safeOp(2), id: "tier_enabled" },
            ],
          }}
          renderNode={renderNode}
        />
      );
      fireEvent.click(screen.getByRole("button", { name: /apply/i }));
      const action = triggerActionSpy.mock.calls[triggerActionSpy.mock.calls.length - 1]?.[2] as
        | { params: { operations: { id: string }[] } }
        | undefined;
      expect(action?.params.operations.map((o) => o.id)).toEqual(["tier_enabled"]);
    });

    it("filters out update/delete ops with empty id (server-side schema would 400 them)", () => {
      // The server's applyOperationSchema requires id: z.string().min(1) on
      // update/delete. Filtering client-side keeps the user-visible flow
      // clean: bad agent payloads don't reach the LLM tool boundary.
      render(
        <Component
          props={{
            programCode: "demo",
            ops: [
              {
                kind: "update",
                entityType: "tier",
                summary: "rename bronze",
                category: "safe",
                // id intentionally missing — should be dropped.
                payload: { name: "Bronze v2" },
              },
              {
                kind: "delete",
                entityType: "tier",
                summary: "remove silver",
                category: "dataLoss",
                defaultChecked: true,
                // id intentionally missing — should be dropped.
              },
              {
                kind: "update",
                entityType: "tier",
                summary: "rename gold",
                category: "safe",
                id: "tier_gold",
                payload: { name: "Gold v2" },
              },
            ],
          }}
          renderNode={renderNode}
        />
      );
      fireEvent.click(screen.getByRole("button", { name: /apply/i }));
      const action = triggerActionSpy.mock.calls[triggerActionSpy.mock.calls.length - 1]?.[2] as
        | { params: { operations: { id?: string }[] } }
        | undefined;
      // Only the one op with a real id survives.
      expect(action?.params.operations).toHaveLength(1);
      expect(action?.params.operations[0]?.id).toBe("tier_gold");
    });

    it("create ops carry payload but no id", () => {
      render(
        <Component
          props={{
            programCode: "demo",
            ops: [
              {
                kind: "create",
                entityType: "badge",
                summary: "new badge: gold-star",
                category: "safe",
                payload: { programIds: ["prog_1"], code: "gold-star", name: "Gold Star" },
              },
            ],
          }}
          renderNode={renderNode}
        />
      );
      fireEvent.click(screen.getByRole("button", { name: /apply/i }));
      const action = triggerActionSpy.mock.calls[triggerActionSpy.mock.calls.length - 1]?.[2] as
        | { params: { operations: { op: string; id?: string; payload: unknown }[] } }
        | undefined;
      expect(action?.params.operations[0]?.op).toBe("create");
      expect(action?.params.operations[0]?.id).toBeUndefined();
      expect(action?.params.operations[0]?.payload).toMatchObject({ code: "gold-star" });
    });

    it("defaults applyAction to 'Apply selected updates.' when prop omitted", () => {
      render(
        <Component
          props={{ programCode: "demo", ops: [{ ...safeOp(1), id: "x", payload: {} }] }}
          renderNode={renderNode}
        />
      );
      fireEvent.click(screen.getByRole("button", { name: /apply/i }));
      expect(triggerActionSpy.mock.calls[triggerActionSpy.mock.calls.length - 1]?.[0]).toBe(
        "Apply selected updates."
      );
    });
  });
});
