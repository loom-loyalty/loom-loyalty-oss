/**
 * BadgeFormSheet audit suite (L1 widget mapping + L3 behavior).
 *
 * L1 asserts canonical compound widgets for the BADGE form-sheet. Direction A
 * maps each field to its current widget. Direction B asserts set-equality of
 * rendered ids against BADGE_EDITABLE_FIELDS.
 *
 * L2 (audit-side Zod schema) lives in badge-form-sheet.schema.test.ts.
 */

import type { Badge } from "@loom-loyalty/sdk";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

// Mock compound widgets to keep the audit suite isolated from SDK hooks.
vi.mock("../../../forms/metadata-field/index.js", () => ({
  MetadataField: ({
    typeCode,
    value,
    onValueChange,
    typeLabel: _typeLabel,
    showCreateNew: _showCreateNew,
    showDescriptions: _showDescriptions,
    onOptionChange: _onOptionChange,
    ...rest
  }: {
    typeCode: string;
    typeLabel?: string;
    value: string;
    onValueChange: (v: string, isSuggested: boolean) => void;
    showCreateNew?: boolean;
    showDescriptions?: boolean;
    onOptionChange?: unknown;
    [key: string]: unknown;
  }): ReactNode => (
    <input
      {...(rest as Record<string, unknown>)}
      data-widget="metadata-select"
      data-metadata-type={typeCode}
      value={value}
      onChange={(e) => onValueChange(e.target.value, false)}
    />
  ),
  useMetadataField: () => ({
    createMetadata: vi.fn().mockResolvedValue(undefined),
    findOption: vi.fn().mockReturnValue(null),
    isTypeNotFound: false,
  }),
}));

vi.mock("../../../forms/program-field/index.js", () => ({
  ProgramMultiField: ({
    id,
    value,
    onValueChange,
    disabled,
  }: {
    id?: string;
    value: string[];
    onValueChange: (ids: string[]) => void;
    disabled?: boolean;
  }): ReactNode => (
    <div id={id} data-widget="program-multi-select" data-entity="PROGRAM">
      <input type="text" readOnly value={value.join(",")} aria-label="programs" />
      <button
        type="button"
        data-testid="program-multi-field-add"
        disabled={disabled}
        onClick={() => onValueChange([...value, "prog_550e8400e29b41d4a716446655440000"])}
      >
        Add Program
      </button>
    </div>
  ),
}));

vi.mock("../../../forms/duration-period-builder.js", () => ({
  DurationPeriodBuilder: ({ label }: { label?: string }): ReactNode => (
    <div data-mock="duration-period-builder">{label}</div>
  ),
}));

import { BadgeFormSheet } from "./badge-form-sheet.js";
import { BADGE_EDITABLE_FIELDS, BADGE_STANDARD_FIELDS } from "./types.js";

/** Minimal valid Badge fixture for edit mode. */
const FIXTURE: Badge = {
  badgeId: "badge_00000000000000000000000000000001",
  code: "loyalty-badge",
  name: "Loyalty Badge",
  type: {
    metadataId: "meta_00000000000000000000000000000001",
    code: "ACHIEVEMENT",
    name: "Achievement",
    typeCode: "BADGE_TYPE",
    dataTypeId: "dtyp_00000000000000000000000000000001",
  },
  programIds: ["prog_550e8400e29b41d4a716446655440000"],
};

function renderSheet(overrides: Partial<React.ComponentProps<typeof BadgeFormSheet>> = {}) {
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  const onOpenChange = vi.fn();
  const result = render(
    <BadgeFormSheet
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
// BadgeFormSheet currently mounts.
// ─────────────────────────────────────────────────────────────────────────

describe("[audit] L1 Direction A — BadgeFormSheet base field widgets (current state)", () => {
  it("renders name as a plain Input[type=text] with id='badge-name' (F1: plain Input — playbook §11.6)", () => {
    renderSheet();
    const input = screen.getByLabelText(/^Name/i, { selector: "input" });
    expect(input.id).toBe("badge-name");
    expect(input.tagName).toBe("INPUT");
    expect(input.getAttribute("type")).toBe("text");
  });

  it("renders code as a CodeInput with id='badge-code'", () => {
    renderSheet();
    const input = screen.getByLabelText(/^Code/i, { selector: "input" }) as HTMLInputElement;
    expect(input.id).toBe("badge-code");
    expect(input.tagName).toBe("INPUT");
  });

  it("auto-generates code in kebab-case when name is typed (CodeInput pipeline)", () => {
    renderSheet();
    const nameInput = screen.getByLabelText(/^Name/i, { selector: "input" });
    const codeInput = screen.getByLabelText(/^Code/i, { selector: "input" }) as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: "Loyalty Star" } });
    expect(codeInput.value).toBe("loyalty-star");
  });

  it("renders typeCode as MetadataField with id='badge-type-code' and data-metadata-type='BADGE_TYPE' (F2 resolved)", () => {
    renderSheet();
    const trigger = document.querySelector('[data-widget="metadata-select"]');
    expect(trigger).not.toBeNull();
    expect(trigger?.getAttribute("data-metadata-type")).toBe("BADGE_TYPE");
    expect(trigger?.getAttribute("id")).toBe("badge-type-code");
  });

  it("renders programIds as ProgramMultiField with id='badge-program-ids' (F3 resolved)", () => {
    renderSheet();
    const widget = document.querySelector('[data-widget="program-multi-select"]');
    expect(widget).not.toBeNull();
    expect(widget?.getAttribute("data-entity")).toBe("PROGRAM");
    expect(widget?.getAttribute("id")).toBe("badge-program-ids");
  });

  it("renders rank as a plain Input[type=number] with id='badge-rank' (F4: plain Input — playbook §11.6)", () => {
    renderSheet();
    const input = document.querySelector("#badge-rank") as HTMLInputElement | null;
    expect(input).not.toBeNull();
    expect(input?.getAttribute("type")).toBe("number");
  });

  it("renders description as LocalizedStringInput bound to id='badge-description' (F5 resolved)", () => {
    renderSheet();
    const labeled = screen.getByLabelText(/^Description$/i);
    expect(labeled.id).toBe("badge-description");
  });

  it("does not render system fields (badgeId, createdDateTime, modifiedDateTime)", () => {
    renderSheet();
    expect(document.querySelector("#badge-badgeId")).toBeNull();
    expect(document.querySelector("#badge-createdDateTime")).toBeNull();
    expect(document.querySelector("#badge-modifiedDateTime")).toBeNull();
  });

  it("locks code input in edit mode", () => {
    renderSheet({ mode: "edit", initialData: FIXTURE });
    const codeInput = screen.getByLabelText(/^Code/i, { selector: "input" }) as HTMLInputElement;
    expect(codeInput.disabled).toBe(true);
  });

  it("prefills name from initialData in edit mode", () => {
    renderSheet({ mode: "edit", initialData: FIXTURE });
    const nameInput = screen.getByLabelText(/^Name/i, {
      selector: "input",
    }) as HTMLInputElement;
    expect(nameInput.value).toBe("Loyalty Badge");
  });
});

// ─────────────────────────────────────────────────────────────────────────
// L1 — Direction B: orphan detection
// ─────────────────────────────────────────────────────────────────────────

describe("[audit] L1 Direction B — BadgeFormSheet orphan detection", () => {
  it("every rendered input has a badge- prefixed id (no naming-convention orphans)", () => {
    renderSheet();
    const inputs = Array.from(document.querySelectorAll("input[id]"));
    expect(inputs.length).toBeGreaterThan(0);
    for (const el of inputs) {
      const id = el.getAttribute("id") ?? "";
      if (id === "") continue; // hidden inputs with no id are not orphans
      expect(
        id,
        `input element ${el.outerHTML.slice(0, 120)} must have a badge- prefixed id`
      ).toMatch(/^badge-/);
    }
  });

  it("renders exactly the user-editable base fields — no orphans, no missing", () => {
    renderSheet();
    const ids = Array.from(document.querySelectorAll("[id^='badge-']"))
      .map((el) => el.getAttribute("id") ?? "")
      // Hint-paragraph ids (aria-describedby targets) are presentational, not editable fields.
      .filter((id) => id.startsWith("badge-") && !id.endsWith("-hint"));
    const fieldKeys = ids
      .map((id) => id.replace(/^badge-/, ""))
      .map((slug) => slug.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase()));

    const editable: ReadonlySet<string> = BADGE_EDITABLE_FIELDS;
    const known: readonly string[] = BADGE_STANDARD_FIELDS;
    for (const key of fieldKeys) {
      expect(
        editable.has(key) || known.includes(key),
        `rendered field '${key}' is not in BADGE_STANDARD_FIELDS`
      ).toBe(true);
    }
    const FIELDS_WITH_IDS: ReadonlySet<string> = new Set([
      "name",
      "code",
      "typeCode",
      "programIds",
      "rank",
      "description",
    ]);
    for (const key of FIELDS_WITH_IDS) {
      expect(fieldKeys.includes(key), `field '${key}' expected in DOM but not found`).toBe(true);
    }
  });

  it("does not accept a schema/extendedFields prop (extension fields invisible — F6)", () => {
    renderSheet();
    // BadgeFormSheet does accept schema + extendedFields but only renders
    // ExtendedFieldsSection when schema is truthy — providing neither means
    // the section is absent. Pin current-state.
    expect(document.querySelector("[data-extended-section]")).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────
// L3 — Behavior tests
// ─────────────────────────────────────────────────────────────────────────

describe("[audit] L3 — BadgeFormSheet behavior", () => {
  it("blocks submit when no program is selected (required-program guard)", () => {
    const { onSubmit } = renderSheet();
    const nameInput = screen.getByLabelText(/^Name/i, { selector: "input" });
    fireEvent.change(nameInput, { target: { value: "Test Badge" } });
    fireEvent.click(screen.getByRole("button", { name: /^Create Badge$/i }));
    expect(onSubmit).not.toHaveBeenCalled();
    const errors = screen.getAllByRole("alert");
    expect(errors.length).toBeGreaterThan(0);
  });

  it("submits CreateBadge payload after adding a program", async () => {
    const { onSubmit } = renderSheet();
    const nameInput = screen.getByLabelText(/^Name/i, { selector: "input" });
    fireEvent.change(nameInput, { target: { value: "Loyalty Star" } });

    // Add a program via mock button
    fireEvent.click(screen.getByTestId("program-multi-field-add"));

    fireEvent.click(screen.getByRole("button", { name: /^Create Badge$/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));

    const payload = onSubmit.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload.name).toBe("Loyalty Star");
    expect(payload.code).toBe("loyalty-star");
    expect(Array.isArray(payload.programIds)).toBe(true);
    expect((payload.programIds as string[]).length).toBeGreaterThan(0);
    // typeCode falls back to "default" when no type is selected — pre-existing
    // form behavior, pinned here so any future change to the fallback is loud.
    expect(payload.typeCode).toBe("default");
  });

  it("omits description from payload when it is empty", async () => {
    const { onSubmit } = renderSheet();
    fireEvent.change(screen.getByLabelText(/^Name/i, { selector: "input" }), {
      target: { value: "Empty Desc Badge" },
    });
    fireEvent.click(screen.getByTestId("program-multi-field-add"));
    fireEvent.click(screen.getByRole("button", { name: /^Create Badge$/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const payload = onSubmit.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload.description).toBeUndefined();
  });

  it("omits rank from payload when rank field is empty", async () => {
    const { onSubmit } = renderSheet();
    fireEvent.change(screen.getByLabelText(/^Name/i, { selector: "input" }), {
      target: { value: "No Rank Badge" },
    });
    fireEvent.click(screen.getByTestId("program-multi-field-add"));
    fireEvent.click(screen.getByRole("button", { name: /^Create Badge$/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const payload = onSubmit.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload.rank).toBeUndefined();
  });

  it("surfaces error prop in the FormSheet alert region", () => {
    renderSheet({ error: "Server returned 422 — code already exists" });
    const alerts = screen.getAllByRole("alert");
    const errorAlert = alerts.find((a) => a.textContent?.includes("Server returned 422"));
    expect(errorAlert).toBeDefined();
  });

  it("renders 'Save Changes' button label in edit mode", () => {
    renderSheet({ mode: "edit", initialData: FIXTURE });
    expect(screen.getByRole("button", { name: /Save Changes/i })).toBeInTheDocument();
  });

  it("prefills rank from initialData in edit mode", () => {
    const fixtureWithRank: Badge = { ...FIXTURE, rank: 5 };
    renderSheet({ mode: "edit", initialData: fixtureWithRank });
    const rankInput = document.querySelector("#badge-rank") as HTMLInputElement | null;
    expect(rankInput?.value).toBe("5");
  });

  it("includes rank in payload when filled in", async () => {
    const { onSubmit } = renderSheet();
    fireEvent.change(screen.getByLabelText(/^Name/i, { selector: "input" }), {
      target: { value: "Ranked Badge" },
    });
    fireEvent.change(document.querySelector("#badge-rank")!, {
      target: { value: "3" },
    });
    fireEvent.click(screen.getByTestId("program-multi-field-add"));
    fireEvent.click(screen.getByRole("button", { name: /^Create Badge$/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const payload = onSubmit.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload.rank).toBe(3);
  });
});
