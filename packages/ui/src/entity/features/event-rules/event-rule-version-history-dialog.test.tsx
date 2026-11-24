import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { EventRuleVersionHistoryDialog } from "./event-rule-version-history-dialog.js";

const versions = [
  {
    eventRuleId: "a",
    version: 1,
    versionStatus: "ARCHIVED",
    name: "Free Wash",
    modifiedDateTime: "2026-11-18T10:00:00Z",
  },
  {
    eventRuleId: "c",
    version: 3,
    versionStatus: "DRAFT",
    name: "Free Wash",
    modifiedDateTime: "2026-11-20T10:00:00Z",
  },
  {
    eventRuleId: "b",
    version: 2,
    versionStatus: "PUBLISHED",
    name: "Free Wash",
    modifiedDateTime: "2026-11-20T09:00:00Z",
  },
];

describe("EventRuleVersionHistoryDialog (spec 16)", () => {
  it("lists every version newest first with its status, and offers no actions", () => {
    render(
      <EventRuleVersionHistoryDialog
        open
        onOpenChange={vi.fn()}
        ruleName="Free Wash"
        versions={versions}
      />
    );
    const dialog = screen.getByRole("dialog", { name: "Version history" });
    const rows = within(dialog).getAllByRole("row").slice(1);
    expect(rows.map((row) => within(row).getAllByRole("cell")[0]?.textContent)).toEqual([
      "v3",
      "v2",
      "v1",
    ]);
    expect(within(dialog).getByLabelText("Version 3 status: Draft")).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Version 2 status: Published")).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Version 1 status: Archived")).toBeInTheDocument();
    // Only the dialog's own close control; no lifecycle buttons.
    const buttons = within(dialog)
      .queryAllByRole("button")
      .map((b) => b.textContent?.trim() || b.getAttribute("aria-label"));
    expect(buttons.every((name) => /close/i.test(name ?? ""))).toBe(true);
  });

  it("shows an inline error", () => {
    render(
      <EventRuleVersionHistoryDialog
        open
        onOpenChange={vi.fn()}
        ruleName="X"
        versions={[]}
        error="Failed to load"
      />
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Failed to load");
  });
});

const amountOver = (value: number) => ({ greaterThan: { field: "$.amount", value } });

function version(n: number, status: string, overrides: Record<string, unknown> = {}) {
  return {
    eventRuleId: `id-${n}`,
    code: "free-wash",
    version: n,
    versionStatus: status,
    name: "Free Wash",
    eventTypeCode: "PURCHASE",
    eventExpression: amountOver(10),
    modifiedDateTime: `2026-11-1${n}T10:00:00Z`,
    ...overrides,
  };
}

function renderHistory(list: Record<string, unknown>[]) {
  render(
    <EventRuleVersionHistoryDialog
      open
      onOpenChange={vi.fn()}
      ruleName="Free Wash"
      versions={list}
    />
  );
  return screen.getByRole("dialog", { name: "Version history" });
}

function pick(dialog: HTMLElement, label: string, option: string) {
  const trigger = within(dialog).getByRole("combobox", { name: label });
  fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false, pointerType: "mouse" });
  fireEvent.click(screen.getByRole("option", { name: option }));
}

describe("EventRuleVersionHistoryDialog compare view (fe#1933)", () => {
  it("V1 + V8: compares the newest version with the one before, showing only what changed", () => {
    const dialog = renderHistory([
      version(1, "ARCHIVED"),
      version(2, "PUBLISHED", { eventExpression: amountOver(20) }),
    ]);

    expect(within(dialog).getByRole("combobox", { name: "Older version" })).toHaveTextContent("v1");
    expect(within(dialog).getByRole("combobox", { name: "Newer version" })).toHaveTextContent("v2");
    const changedHeadings = within(dialog)
      .getAllByRole("heading", { level: 3 })
      .map((h) => h.textContent);
    expect(changedHeadings).toEqual(["Conditions"]);
    const conditions = within(dialog).getByRole("region", { name: "Conditions" });
    expect(within(conditions).getByText("Before (v1)")).toBeInTheDocument();
    expect(within(conditions).getByText("After (v2)")).toBeInTheDocument();
    expect(within(dialog).getByText(/^Unchanged:/)).toHaveTextContent(
      "Unchanged: Name and description, Trigger, Actions, Targets, Programs, Environments, Custom fields"
    );
  });

  it("V2: picking another older version compares across both steps", () => {
    const dialog = renderHistory([
      version(1, "ARCHIVED"),
      version(2, "ARCHIVED", { eventExpression: amountOver(20) }),
      version(3, "PUBLISHED", { eventExpression: amountOver(20), name: "Free Wash+" }),
    ]);
    const headings = () =>
      within(dialog)
        .getAllByRole("heading", { level: 3 })
        .map((h) => h.textContent);
    expect(headings()).toEqual(["Name and description"]);

    pick(dialog, "Older version", "v1");

    expect(headings()).toEqual(["Name and description", "Conditions"]);
  });

  it("V3: identical versions say there are no content changes", () => {
    const dialog = renderHistory([version(1, "ARCHIVED"), version(2, "PUBLISHED")]);
    expect(within(dialog).getByText("No content changes between v2 and v1.")).toBeInTheDocument();
    expect(within(dialog).queryAllByRole("heading", { level: 3 })).toHaveLength(0);
  });

  it("the pickers only offer an older version below the newer one, so a diff never runs backwards", () => {
    const dialog = renderHistory([
      version(1, "ARCHIVED"),
      version(2, "ARCHIVED"),
      version(3, "PUBLISHED", { name: "Free Wash+" }),
    ]);
    const trigger = within(dialog).getByRole("combobox", { name: "Older version" });
    fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false, pointerType: "mouse" });
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual(["v2", "v1"]);
  });

  it("V4: one version shows no compare controls", () => {
    const dialog = renderHistory([version(1, "PUBLISHED")]);
    expect(within(dialog).queryByRole("combobox")).toBeNull();
  });

  it("V7: the compare view adds no action buttons", () => {
    const dialog = renderHistory([
      version(1, "ARCHIVED"),
      version(2, "PUBLISHED", { eventExpression: amountOver(20) }),
    ]);
    const buttons = within(dialog)
      .queryAllByRole("button")
      .map((b) => b.textContent?.trim() || b.getAttribute("aria-label"));
    // Only view controls: the dialog close and the expression summaries' JSON toggle.
    expect(buttons.every((name) => /^(close|json)$/i.test(name ?? ""))).toBe(true);
  });

  it("V12: an open draft is compared with the live version", () => {
    const dialog = renderHistory([
      version(1, "ARCHIVED"),
      version(2, "PUBLISHED"),
      version(3, "DRAFT", { name: "Free Wash+" }),
    ]);
    expect(within(dialog).getByRole("combobox", { name: "Older version" })).toHaveTextContent("v2");
    expect(within(dialog).getByRole("combobox", { name: "Newer version" })).toHaveTextContent("v3");
  });
});
