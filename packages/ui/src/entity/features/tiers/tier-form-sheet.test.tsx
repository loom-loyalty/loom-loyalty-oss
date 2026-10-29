/**
 * TierFormSheet audit suite (L1 widget mapping + L3 behavior).
 *
 * L1 asserts canonical compound widgets — ProgramMultiField (T1) and
 * DurationPeriodBuilder (T2). L1 is ★★ until cross-entity consumer
 * probes land.
 *
 * L2 (audit-side Zod schema) lives in tier-form-sheet.schema.test.ts.
 */

import type { Tier } from "@loom-loyalty/sdk";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

// Mock canonical compound widgets to keep the audit suite isolated from
// SDK hooks. Each stub renders an input with the production data-* attrs.
vi.mock("../../../forms/program-field/program-multi-field", () => ({
  ProgramMultiField: ({
    value,
    onValueChange,
    id,
    ...rest
  }: {
    value: string[];
    onValueChange: (ids: string[]) => void;
    id?: string;
    [key: string]: unknown;
  }): ReactNode => (
    <input
      {...(rest as Record<string, unknown>)}
      id={id}
      data-widget="program-multi-select"
      data-entity="PROGRAM"
      value={value.join(",")}
      onChange={(e) => onValueChange(e.target.value ? e.target.value.split(",") : [])}
    />
  ),
}));

vi.mock("../../../forms/duration-period-builder", () => ({
  DurationPeriodBuilder: ({
    value: _value,
    onChange: _onChange,
    label,
    ...rest
  }: {
    value?: unknown;
    onChange: (v: unknown) => void;
    label?: string;
    [key: string]: unknown;
  }): ReactNode => (
    <input
      {...(rest as Record<string, unknown>)}
      data-widget="duration-period-builder"
      data-label={label}
      readOnly
    />
  ),
}));

vi.mock("../../../forms/tier-field", () => ({
  TierField: ({
    value,
    onValueChange,
    id,
    excludeIds,
    ...rest
  }: {
    value: string;
    onValueChange: (id: string) => void;
    id?: string;
    excludeIds?: readonly string[];
    [key: string]: unknown;
  }): ReactNode => (
    <input
      {...(rest as Record<string, unknown>)}
      id={id}
      data-widget="tier-select"
      data-entity="TIER"
      data-exclude-ids={excludeIds?.join(",") ?? ""}
      value={value}
      onChange={(e) => onValueChange(e.target.value)}
    />
  ),
}));

import { TierFormSheet } from "./tier-form-sheet.js";
import { TIER_STANDARD_FIELDS } from "./types.js";

function renderSheet(overrides: Partial<React.ComponentProps<typeof TierFormSheet>> = {}) {
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  const onOpenChange = vi.fn();
  const result = render(
    <TierFormSheet
      open
      onOpenChange={onOpenChange}
      mode="create"
      onSubmit={onSubmit}
      {...overrides}
    />
  );
  return { ...result, onSubmit, onOpenChange };
}

// ─────────────────────────────────────────────────────────────────────────
// L1 — Direction A: every base manifest field renders the widget that
// TierFormSheet currently mounts. Divergence vs. playbook §11.6 is
// documented in TODOS E1–E5 and asserted here as current-state.
// ─────────────────────────────────────────────────────────────────────────

describe("[audit] L1 Direction A — TierFormSheet base field widgets (current state)", () => {
  it("renders name as an Input[type=text] with data-widget='text-input' and id='tier-name' (E1 resolved)", () => {
    renderSheet();
    const input = screen.getByLabelText(/Name/i, { selector: "input" });
    expect(input.id).toBe("tier-name");
    expect(input.tagName).toBe("INPUT");
    expect(input.getAttribute("type")).toBe("text");
    expect(input.getAttribute("data-widget")).toBe("text-input");
  });

  it("renders code as a CodeInput with id='tier-code'", () => {
    renderSheet();
    const input = screen.getByLabelText(/^Code/i, { selector: "input" }) as HTMLInputElement;
    expect(input.id).toBe("tier-code");
    expect(input.tagName).toBe("INPUT");
  });

  it("auto-generates code in kebab-case when name is typed (CodeInput pipeline)", () => {
    renderSheet();
    const nameInput = screen.getByLabelText(/Name/i, { selector: "input" });
    const codeInput = screen.getByLabelText(/^Code/i, { selector: "input" }) as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: "Gold Plus" } });
    expect(codeInput.value).toBe("gold-plus");
  });

  it("renders rank as a plain Input[type=number] with id='tier-rank' and data-widget='text-input' (E10 resolved)", () => {
    renderSheet();
    const input = document.querySelector("#tier-rank") as HTMLInputElement;
    expect(input).not.toBeNull();
    expect(input.getAttribute("type")).toBe("number");
    expect(input.getAttribute("data-widget")).toBe("text-input");
  });

  it("renders subscription as a Switch with id='tier-subscription' and data-widget='switch' (E10 resolved)", () => {
    renderSheet();
    const el = document.querySelector("#tier-subscription");
    expect(el).not.toBeNull();
    expect(el?.getAttribute("data-widget")).toBe("switch");
  });

  it("renders programIds as ProgramMultiField with data-widget='program-multi-select' and id='tier-program-ids' (T1 + E3 resolved)", () => {
    renderSheet();
    const trigger = document.querySelector('[data-widget="program-multi-select"]');
    expect(trigger).not.toBeNull();
    expect(trigger?.getAttribute("data-entity")).toBe("PROGRAM");
    expect(trigger?.getAttribute("id")).toBe("tier-program-ids");
  });

  it("renders durationPeriod as DurationPeriodBuilder (T2 — Set Duration Period)", () => {
    renderSheet();
    const builders = document.querySelectorAll('[data-widget="duration-period-builder"]');
    const durationBuilder = Array.from(builders).find(
      (el) => el.getAttribute("data-label") === "Set Duration Period"
    );
    expect(durationBuilder).not.toBeNull();
  });

  it("renders tierExpiryDowngradeTierId as TierField with id='tier-downgrade-tier-id' (E4 resolved)", () => {
    renderSheet();
    const widget = document.querySelector("#tier-downgrade-tier-id") as HTMLInputElement;
    expect(widget).not.toBeNull();
    expect(widget.getAttribute("data-widget")).toBe("tier-select");
    expect(widget.getAttribute("data-entity")).toBe("TIER");
  });

  it("binds Label htmlFor to TierField id (WCAG 1.3.1 parity with E5)", () => {
    renderSheet();
    const label = document.querySelector("label[for='tier-downgrade-tier-id']") as HTMLLabelElement;
    expect(label).not.toBeNull();
    expect(label.textContent ?? "").toMatch(/downgrade tier/i);
  });

  it("passes excludeIds to TierField with the editing tierId on edit (self-exclusion)", () => {
    const initial: Tier = {
      tierId: "tier_self_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      code: "self",
      name: "Self",
      rank: 1,
    };
    renderSheet({ mode: "edit", initialData: initial });
    const widget = document.querySelector("#tier-downgrade-tier-id") as HTMLInputElement;
    expect(widget.getAttribute("data-exclude-ids")).toBe(
      "tier_self_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
    );
  });

  it("does not exclude any tier id in create mode", () => {
    renderSheet();
    const widget = document.querySelector("#tier-downgrade-tier-id") as HTMLInputElement;
    expect(widget.getAttribute("data-exclude-ids")).toBe("");
  });

  it("renders tierExpiryDowngradeDurationPeriod as DurationPeriodBuilder (Downgrade Duration)", () => {
    renderSheet();
    const builders = document.querySelectorAll('[data-widget="duration-period-builder"]');
    const downgradeBuilder = Array.from(builders).find(
      (el) => el.getAttribute("data-label") === "Downgrade Duration"
    );
    expect(downgradeBuilder).not.toBeNull();
  });

  it("renders description via LocalizedStringInput with data-widget='locale-tabbed-input' and id='tier-description' (E5 resolved)", () => {
    renderSheet();
    const lsi = document.querySelector('[data-widget="locale-tabbed-input"]');
    expect(lsi).not.toBeNull();
    // E5 — WCAG 1.3.1: Label htmlFor binds to the active locale input via getByLabelText
    const labeled = screen.getByLabelText(/^Description$/i);
    expect(labeled.id).toBe("tier-description");
  });

  it("does not render system fields (tierId, createdDateTime, modifiedDateTime)", () => {
    renderSheet();
    expect(document.querySelector("#tier-tierId")).toBeNull();
    expect(document.querySelector("#tier-createdDateTime")).toBeNull();
    expect(document.querySelector("#tier-modifiedDateTime")).toBeNull();
  });

  it("locks code input in edit mode", () => {
    const initial: Tier = {
      tierId: "tier_00000000000000000000000000000001",
      code: "gold",
      name: "Gold",
      rank: 1,
    };
    renderSheet({ mode: "edit", initialData: initial });
    const codeInput = screen.getByLabelText(/^Code/i, { selector: "input" }) as HTMLInputElement;
    expect(codeInput.disabled).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// L1 — Direction B: every editable field rendered in the sheet maps to a
// manifest base field. The orphan check enumerates by data-* attrs and
// id-prefix invariant since compound widgets carry data-widget but not
// always tier- prefixed ids (defect E3, E5).
// ─────────────────────────────────────────────────────────────────────────

const TIER_EDITABLE_FIELDS = new Set([
  "name",
  "code",
  "rank",
  "subscription",
  "programIds",
  "durationPeriod",
  "tierExpiryDowngradeTierId",
  "tierExpiryDowngradeDurationPeriod",
  "description",
] as const);

describe("[audit] L1 Direction B — TierFormSheet orphan detection", () => {
  it("renders compound widgets for programIds and durationPeriod fields (T1 + T2)", () => {
    renderSheet();
    expect(document.querySelector('[data-widget="program-multi-select"]')).not.toBeNull();
    const builders = document.querySelectorAll('[data-widget="duration-period-builder"]');
    expect(builders.length).toBeGreaterThanOrEqual(2);
  });

  it("standard tier fields cover all user-editable fields (set equality with TIER_STANDARD_FIELDS)", () => {
    const editable: ReadonlySet<string> = TIER_EDITABLE_FIELDS;
    const known: readonly string[] = TIER_STANDARD_FIELDS;
    for (const key of editable) {
      expect(known.includes(key), `editable field '${key}' is not in TIER_STANDARD_FIELDS`).toBe(
        true
      );
    }
    for (const key of known) {
      if (key === "createdDateTime" || key === "modifiedDateTime") continue;
      expect(
        editable.has(key),
        `TIER_STANDARD_FIELDS field '${key}' is not in TIER_EDITABLE_FIELDS`
      ).toBe(true);
    }
  });

  it("compound widgets carry tier- prefixed ids (E3 + E5 resolved)", () => {
    renderSheet();
    // E3: ProgramMultiField bound to id="tier-program-ids"
    const programWidget = document.querySelector('[data-widget="program-multi-select"]');
    expect(programWidget?.getAttribute("id")).toBe("tier-program-ids");
    // E5: LocalizedStringInput forwards id to its active locale input; the
    // wrapping <Label htmlFor> resolves to that input via getByLabelText.
    const labeled = screen.getByLabelText(/^Description$/i);
    expect(labeled.id).toBe("tier-description");
  });

  it("does not render an ExtendedFieldsSection without schema + extendedFields props", () => {
    renderSheet();
    expect(document.querySelector("[data-extended-section]")).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────
// L3 — Behavior. Form submit, mode-driven edits, error surfacing.
// ─────────────────────────────────────────────────────────────────────────

describe("[audit] L3 — TierFormSheet behavior", () => {
  it("submits CreateTier payload with required fields", async () => {
    const { onSubmit } = renderSheet();
    fireEvent.change(screen.getByLabelText(/Name/i, { selector: "input" }), {
      target: { value: "Gold" },
    });

    fireEvent.click(screen.getByRole("button", { name: /Create Tier/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));

    const payload = onSubmit.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload).toMatchObject({
      name: "Gold",
      code: "gold",
      rank: 1,
      subscription: false,
    });
  });

  it("submits with description when description is filled", async () => {
    const { onSubmit } = renderSheet();
    fireEvent.change(screen.getByLabelText(/Name/i, { selector: "input" }), {
      target: { value: "Platinum" },
    });
    const textarea = screen.getByLabelText(/^Description$/i) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "Top tier status" } });

    fireEvent.click(screen.getByRole("button", { name: /Create Tier/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));

    const payload = onSubmit.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload.description).toEqual({ en: "Top tier status" });
  });

  it("omits the description key entirely when description is empty (E6 resolved)", async () => {
    const { onSubmit } = renderSheet();
    fireEvent.change(screen.getByLabelText(/Name/i, { selector: "input" }), {
      target: { value: "Silver" },
    });

    fireEvent.click(screen.getByRole("button", { name: /Create Tier/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));

    const payload = onSubmit.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload).not.toHaveProperty("description");
  });

  it("strips whitespace-only description from the payload (E6 resolved)", async () => {
    const { onSubmit } = renderSheet();
    fireEvent.change(screen.getByLabelText(/Name/i, { selector: "input" }), {
      target: { value: "Trim Test" },
    });
    const textarea = document.querySelector('[data-widget="locale-tabbed-input"] textarea');
    expect(textarea).not.toBeNull();
    fireEvent.change(textarea!, { target: { value: "   " } });

    fireEvent.click(screen.getByRole("button", { name: /Create Tier/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));

    const payload = onSubmit.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload).not.toHaveProperty("description");
  });

  it("surfaces error prop in the FormSheet alert region", () => {
    renderSheet({ error: "Server returned 422 — code already exists" });
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toMatch(/Server returned 422/);
  });

  it("prefills name + code + rank from initialData in edit mode", () => {
    const initial: Tier = {
      tierId: "tier_00000000000000000000000000000002",
      code: "gold",
      name: "Gold",
      rank: 2,
    };
    renderSheet({ mode: "edit", initialData: initial });
    expect((screen.getByLabelText(/Name/i, { selector: "input" }) as HTMLInputElement).value).toBe(
      "Gold"
    );
    expect((screen.getByLabelText(/^Code/i, { selector: "input" }) as HTMLInputElement).value).toBe(
      "gold"
    );
    expect((document.querySelector("#tier-rank") as HTMLInputElement).value).toBe("2");
  });

  it("renders 'Save Changes' button label in edit mode", () => {
    const initial: Tier = {
      tierId: "tier_00000000000000000000000000000001",
      code: "gold",
      name: "Gold",
      rank: 1,
    };
    renderSheet({ mode: "edit", initialData: initial });
    expect(screen.getByRole("button", { name: /Save Changes/i })).toBeInTheDocument();
  });

  it("preserves multi-locale description on edit-mode load (locale preservation)", async () => {
    const initial: Tier = {
      tierId: "tier_00000000000000000000000000000003",
      code: "platinum",
      name: "Platinum",
      rank: 1,
      description: { en: "english text", es: "texto en español" },
    };
    const { onSubmit } = renderSheet({ mode: "edit", initialData: initial });
    const textarea = document.querySelector(
      '[data-widget="locale-tabbed-input"] textarea'
    ) as HTMLTextAreaElement;
    expect(textarea).not.toBeNull();
    expect(textarea.value).toBe("english text");

    fireEvent.click(screen.getByRole("button", { name: /Save Changes/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const payload = onSubmit.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload.description).toEqual({ en: "english text", es: "texto en español" });
  });
});
