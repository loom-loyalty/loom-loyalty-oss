/**
 * TargetFormSheet audit suite (L1 widget mapping + L3 behavior).
 *
 * TARGET is polymorphic across FOUR variants — `type` drives whether the
 * COMPLETION / COUNTER / MILESTONE / X_OF_Y configuration block renders.
 * Direction C pins the discriminator-gated branches (the defining audit
 * assertion for a polymorphic entity).
 *
 * `ProgramMultiField` + `MetadataField`/`useMetadataField` are mocked because
 * they pull the SDK + react-query at import time. The milestone/xofy target
 * pickers are inline Popover+Command (no SDK), and the compound widgets
 * (`CodeInput`, `LocalizedStringInput`) are pure presentation, so they mount
 * for real.
 *
 * L2 (audit-side Zod schema) lives in target-form-sheet.schema.test.ts.
 */

import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

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
  }) => (
    <div data-mock="program-multi-field">
      {/* Forward the caller-provided id so <Label htmlFor> binds to a real
          DOM node — matches the production ProgramMultiField contract and
          keeps the WCAG 1.3.1 test honest. */}
      <input id={id} type="text" readOnly value={value.join(",")} />
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

// Hoisted mutable state so individual tests can flip the isSuggested flag fired
// by MetadataField's onValueChange + override the useMetadataField return shape.
// vi.mock factories are hoisted; use vi.hoisted to share state with them.
const metadataFieldMock = vi.hoisted(() => {
  const mock = {
    fireAsSuggested: false as boolean,
    hookReturn: {
      category: undefined as string | undefined,
      isTypeNotFound: false as boolean,
      findOption: ((_code: string) => undefined) as (code: string) => unknown,
      createMetadata: vi.fn<(data: unknown) => Promise<void>>().mockResolvedValue(undefined),
    },
  };

  return Object.assign(mock, {
    useMetadataField: vi.fn((_typeCode: string) => mock.hookReturn),
  });
});

// Stub MetadataField + useMetadataField; the form mounts both so neither can hit the real SDK.
vi.mock("../../../forms/metadata-field/index.js", () => ({
  MetadataField: ({
    id,
    typeCode,
    value,
    onValueChange,
  }: {
    id?: string;
    typeCode: string;
    value: string;
    onValueChange: (v: string, isSuggested: boolean) => void;
  }) => (
    <input
      id={id}
      data-widget="metadata-select"
      data-metadata-type={typeCode}
      value={value}
      onChange={(e) => onValueChange(e.target.value, metadataFieldMock.fireAsSuggested)}
    />
  ),
  useMetadataField: metadataFieldMock.useMetadataField,
}));

beforeEach(() => {
  metadataFieldMock.fireAsSuggested = false;
  metadataFieldMock.useMetadataField.mockClear();
  metadataFieldMock.hookReturn = {
    category: undefined,
    isTypeNotFound: false,
    findOption: () => undefined,
    createMetadata: vi.fn<(data: unknown) => Promise<void>>().mockResolvedValue(undefined),
  };
});

import { TargetFormSheet } from "./target-form-sheet.js";
import type { TargetFormSheetProps } from "./types.js";

function renderSheet(overrides: Partial<TargetFormSheetProps> = {}) {
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  const onOpenChange = vi.fn();
  const result = render(
    <TargetFormSheet
      open
      onOpenChange={onOpenChange}
      mode="create"
      onSubmit={onSubmit}
      {...overrides}
    />
  );
  return { ...result, onSubmit, onOpenChange };
}

function addProgram() {
  fireEvent.click(screen.getByTestId("program-multi-field-add"));
}

/** Pick a Target Type radio by visible label. */
function selectType(label: RegExp) {
  fireEvent.click(screen.getByRole("radio", { name: label }));
}

/** Edit-mode initialData fixtures keyed by variant. */
const counterInitial = {
  targetId: "tgt_550e8400e29b41d4a716446655440010",
  type: "COUNTER",
  code: "spend-100",
  name: "Spend 100",
  scope: "GLOBAL",
  programIds: ["prog_550e8400e29b41d4a716446655440000"],
  counterTargetType: { code: "POINTS" },
  targetValue: 100,
} as unknown as NonNullable<TargetFormSheetProps["initialData"]>;

// ─────────────────────────────────────────────────────────────────────────
// L1 — Direction A: every base manifest field renders the widget the form
// currently mounts. data-widget + id attrs resolved in this audit.
// ─────────────────────────────────────────────────────────────────────────

describe("[audit] L1 Direction A — TargetFormSheet base field widgets", () => {
  it("renders name as Input[type=text] with data-widget='text-input' and id='target-name'", () => {
    renderSheet();
    const input = screen.getByLabelText(/^Name/i, { selector: "input" });
    expect(input.id).toBe("target-name");
    expect(input.tagName).toBe("INPUT");
    expect(input.getAttribute("type")).toBe("text");
    expect(input.getAttribute("data-widget")).toBe("text-input");
  });

  it("renders code as a CodeInput with id='target-code'", () => {
    renderSheet();
    const input = screen.getByLabelText(/^Code/i, { selector: "input" }) as HTMLInputElement;
    expect(input.id).toBe("target-code");
    expect(input.tagName).toBe("INPUT");
  });

  // Was "auto-generates code in UPPER_SNAKE_CASE". Target's create/update DTO
  // pattern-validates `code` against the resource-code convention, so the old
  // expectation was asserting a value the API rejects.
  it("auto-generates a convention-compliant code when name is typed", () => {
    renderSheet();
    const nameInput = screen.getByLabelText(/^Name/i, { selector: "input" });
    const codeInput = screen.getByLabelText(/^Code/i, { selector: "input" }) as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: "Monthly Spend Goal" } });
    expect(codeInput.value).toBe("monthly-spend-goal");
  });

  it("renders type as a Radix RadioGroup with data-widget='radio-group' and data-discriminator='true'", () => {
    renderSheet();
    const trigger = screen.getByLabelText(/Target Type/i);
    expect(trigger.id).toBe("target-type");
    expect(trigger.getAttribute("role")).toBe("radiogroup");
    expect(trigger.getAttribute("data-widget")).toBe("radio-group");
    expect(trigger.getAttribute("data-discriminator")).toBe("true");
  });

  it("renders programIds via the ProgramMultiField compound with associated label (WCAG 1.3.1)", () => {
    renderSheet();
    // getByLabelText resolves only when <Label htmlFor> binds to a DOM node —
    // catches a regression where someone drops `htmlFor` on the Programs
    // Label or `id` on ProgramMultiField.
    const labeled = screen.getByLabelText(/Programs/i);
    expect(labeled.id).toBe("target-programs");
    const probe = document.querySelector("[data-mock='program-multi-field']");
    expect(probe).not.toBeNull();
  });

  it("renders description via LocalizedStringInput with associated label (WCAG 1.3.1)", () => {
    renderSheet();
    // LocalizedStringInput forwards the id to its active locale input. A
    // missing `htmlFor` on the Description Label would break this lookup.
    const description = screen.getByLabelText(/^Description$/i);
    expect(description.id).toBe("target-description");
  });

  it("renders scope as a Radix Select with data-widget='select' and id='target-scope'", () => {
    renderSheet();
    const trigger = screen.getByLabelText(/^Scope$/i);
    expect(trigger.id).toBe("target-scope");
    expect(trigger.getAttribute("role")).toBe("combobox");
    expect(trigger.getAttribute("data-widget")).toBe("select");
  });

  it("does not render system fields (targetId, enabledInEnvironments, createdDateTime, modifiedDateTime)", () => {
    renderSheet();
    expect(document.querySelector("#target-targetId")).toBeNull();
    expect(document.querySelector("#target-enabledInEnvironments")).toBeNull();
    expect(document.querySelector("#target-createdDateTime")).toBeNull();
    expect(document.querySelector("#target-modifiedDateTime")).toBeNull();
  });

  it("keeps a create-mode code pinned when lockCode is set", () => {
    renderSheet({ mode: "create", initialData: counterInitial, lockCode: true });
    const nameInput = screen.getByLabelText(/^Name/i, { selector: "input" });
    const codeInput = screen.getByLabelText(/^Code/i, { selector: "input" }) as HTMLInputElement;
    expect(codeInput.disabled).toBe(true);
    fireEvent.change(nameInput, { target: { value: "Renamed goal" } });
    expect(codeInput.value).toBe("spend-100");
  });

  it("locks code input in edit mode (mode='edit' disables the field)", () => {
    renderSheet({ mode: "edit", initialData: counterInitial });
    const codeInput = screen.getByLabelText(/^Code/i, { selector: "input" }) as HTMLInputElement;
    expect(codeInput.disabled).toBe(true);
  });

  // Regression. Target's code is pattern-validated by the API, and existing
  // tenant data is full of pre-convention codes like this one. Because edit mode
  // pins the field to the persisted value AND disables it, validating it would
  // disable Save over something the user cannot change — making the whole record
  // uneditable, name and description included.
  it("keeps Save available in edit mode when the persisted code predates the convention", () => {
    renderSheet({
      mode: "edit",
      initialData: { ...counterInitial, code: "FINISH_ONBOARDING" },
    });

    const codeInput = screen.getByLabelText(/^Code/i, { selector: "input" }) as HTMLInputElement;
    expect(codeInput.value, "the legacy code must round-trip verbatim").toBe("FINISH_ONBOARDING");
    expect(codeInput.disabled).toBe(true);

    // No inline error on a field the user cannot reach...
    expect(document.querySelector('[data-slot="code-input-error"]')).toBeNull();
    // ...and, the point of the test, Save is still clickable.
    expect(screen.getByRole("button", { name: /^Save Changes$/i })).not.toBeDisabled();
  });

  it("locks type radio group in edit mode (discriminator cannot change)", () => {
    renderSheet({ mode: "edit", initialData: counterInitial });
    const group = screen.getByLabelText(/Target Type/i);
    expect(group.getAttribute("data-disabled")).toBe("");
    for (const radio of screen.getAllByRole("radio")) {
      expect((radio as HTMLButtonElement).disabled).toBe(true);
      expect(radio.getAttribute("data-disabled")).toBe("");
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────
// L1 — Direction B: every target-prefixed editable field maps to a known
// field. Enumerated by id-prefix + set-equality. Default type is "" (no
// variant selected) so only the common fields render.
// ─────────────────────────────────────────────────────────────────────────

const TARGET_EDITABLE_IDS_DEFAULT = new Set([
  "target-name",
  "target-code",
  "target-type",
  "target-type-COMPLETION",
  "target-type-COUNTER",
  "target-type-MILESTONE",
  "target-type-X_OF_Y",
  "target-programs",
  "target-description",
  "target-scope",
] as const);

const EDITABLE_TAGS = new Set(["INPUT", "SELECT", "TEXTAREA", "BUTTON"]);
function isEditableEl(el: Element): boolean {
  return EDITABLE_TAGS.has(el.tagName) || el.getAttribute("role") === "radiogroup";
}

function targetPrefixedIds(): string[] {
  return Array.from(document.querySelectorAll("[id^='target-']"))
    .filter(isEditableEl)
    .map((el) => el.getAttribute("id") ?? "")
    .filter((id) => id.startsWith("target-"));
}

describe("[audit] L1 Direction B — TargetFormSheet orphan detection", () => {
  it("every rendered target- prefixed element is in the known set (no variant selected)", () => {
    renderSheet();
    const ids = targetPrefixedIds();
    expect(ids.length).toBeGreaterThan(0);
    const known: ReadonlySet<string> = TARGET_EDITABLE_IDS_DEFAULT;
    for (const id of ids) {
      expect(known.has(id as never), `unexpected target-prefixed id '${id}'`).toBe(true);
    }
  });

  it("renders every expected common field — no missing widgets before a variant is picked", () => {
    renderSheet();
    const ids = new Set(targetPrefixedIds());
    for (const expected of TARGET_EDITABLE_IDS_DEFAULT) {
      expect(ids.has(expected), `expected target-prefixed id '${expected}' is missing`).toBe(true);
    }
  });

  it("does not render an ExtendedFieldsSection without schema + extendedFields props", () => {
    renderSheet();
    expect(document.querySelector("[data-extended-section]")).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────
// L1 — Direction C: discriminator-gated rendering. THE KEY 4-WAY ASSERTION
// for this polymorphic entity. Each variant's config block + variant-specific
// fields render only under their `type` and are absent for the other three.
// ─────────────────────────────────────────────────────────────────────────

describe("[audit] L1 Direction C — discriminator-gated field rendering (4-way)", () => {
  it("default (no type): renders no variant config block", () => {
    renderSheet();
    expect(document.querySelector("#target-completion-type-code")).toBeNull();
    expect(document.querySelector("#target-counter-type-code")).toBeNull();
    expect(document.querySelector("#counter-target-value")).toBeNull();
    expect(document.querySelector("#target-milestone-type-code")).toBeNull();
    expect(document.querySelector("#target-xofy-type-code")).toBeNull();
    expect(document.querySelector("#xofy-target-value")).toBeNull();
  });

  it("COMPLETION: renders only the completion type field, no other variant fields", () => {
    renderSheet();
    selectType(/^Completion$/i);
    expect(document.querySelector("#target-completion-type-code")).not.toBeNull();
    // Other variants' distinguishing fields are absent.
    expect(document.querySelector("#counter-target-value")).toBeNull();
    expect(document.querySelector("#target-counter-type-code")).toBeNull();
    expect(document.querySelector("#target-milestone-type-code")).toBeNull();
    expect(document.querySelector("#target-xofy-type-code")).toBeNull();
    expect(document.querySelector("#xofy-target-value")).toBeNull();
  });

  it("COUNTER: renders the counter type field + #counter-target-value, hides other variants", () => {
    renderSheet();
    selectType(/^Counter$/i);
    expect(document.querySelector("#target-counter-type-code")).not.toBeNull();
    const targetValue = document.querySelector("#counter-target-value");
    expect(targetValue).not.toBeNull();
    expect(targetValue?.getAttribute("data-widget")).toBe("text-input");
    // Capping checkbox is COUNTER-only.
    expect(document.querySelector("#capping-target")).not.toBeNull();
    // Other variants absent.
    expect(document.querySelector("#target-completion-type-code")).toBeNull();
    expect(document.querySelector("#target-milestone-type-code")).toBeNull();
    expect(document.querySelector("#xofy-target-value")).toBeNull();
  });

  it("MILESTONE: renders the milestone type field + hides #counter-target-value", () => {
    renderSheet();
    selectType(/^Milestone$/i);
    expect(document.querySelector("#target-milestone-type-code")).not.toBeNull();
    expect(document.querySelector("#counter-target-value")).toBeNull();
    expect(document.querySelector("#target-completion-type-code")).toBeNull();
    expect(document.querySelector("#target-xofy-type-code")).toBeNull();
  });

  it("X_OF_Y: renders the xofY type field + #xofy-target-value, hides other variants", () => {
    renderSheet();
    selectType(/^X of Y$/i);
    expect(document.querySelector("#target-xofy-type-code")).not.toBeNull();
    const xofyValue = document.querySelector("#xofy-target-value");
    expect(xofyValue).not.toBeNull();
    expect(xofyValue?.getAttribute("data-widget")).toBe("text-input");
    expect(document.querySelector("#counter-target-value")).toBeNull();
    expect(document.querySelector("#target-completion-type-code")).toBeNull();
    expect(document.querySelector("#target-milestone-type-code")).toBeNull();
  });

  it("toggling between variants swaps the gated block (COUNTER → MILESTONE → X_OF_Y)", () => {
    renderSheet();

    selectType(/^Counter$/i);
    expect(document.querySelector("#counter-target-value")).not.toBeNull();

    selectType(/^Milestone$/i);
    expect(document.querySelector("#counter-target-value")).toBeNull();
    expect(document.querySelector("#target-milestone-type-code")).not.toBeNull();

    selectType(/^X of Y$/i);
    expect(document.querySelector("#target-milestone-type-code")).toBeNull();
    expect(document.querySelector("#xofy-target-value")).not.toBeNull();
  });

  it("TGT-D3 (resolved): counter state is cleared on COUNTER → MILESTONE → COUNTER toggle", () => {
    renderSheet();
    selectType(/^Counter$/i);
    const initial = document.querySelector("#counter-target-value") as HTMLInputElement;
    fireEvent.change(initial, { target: { value: "100" } });
    expect(initial.value).toBe("100");

    selectType(/^Milestone$/i);
    selectType(/^Counter$/i);

    expect((document.querySelector("#counter-target-value") as HTMLInputElement).value).toBe("");
  });

  it("edit mode with COUNTER initialData renders the counter block (initial discriminator)", () => {
    renderSheet({ mode: "edit", initialData: counterInitial });
    expect(document.querySelector("#counter-target-value")).not.toBeNull();
    expect(document.querySelector("#target-counter-type-code")).not.toBeNull();
    expect(document.querySelector("#target-completion-type-code")).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────
// L3 — Behavior. Submit per variant, discriminator lock + error surfacing,
// edit-mode prefill.
// ─────────────────────────────────────────────────────────────────────────

describe("[audit] L3 — TargetFormSheet behavior", () => {
  it("submits a COMPLETION CreateTarget payload with completionTargetTypeCode", async () => {
    const { onSubmit } = renderSheet();
    fireEvent.change(screen.getByLabelText(/^Name/i, { selector: "input" }), {
      target: { value: "Finish Onboarding" },
    });
    addProgram();
    selectType(/^Completion$/i);
    fireEvent.change(document.querySelector("#target-completion-type-code") as HTMLInputElement, {
      target: { value: "ONBOARDING" },
    });

    fireEvent.click(screen.getByRole("button", { name: /^Create Target$/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const payload = onSubmit.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload).toMatchObject({
      name: "Finish Onboarding",
      code: "finish-onboarding",
      type: "COMPLETION",
      completionTargetTypeCode: "ONBOARDING",
      programIds: ["prog_550e8400e29b41d4a716446655440000"],
    });
  });

  it("submits a COUNTER payload with counterTargetTypeCode + targetValue + cappingTarget", async () => {
    const { onSubmit } = renderSheet();
    fireEvent.change(screen.getByLabelText(/^Name/i, { selector: "input" }), {
      target: { value: "Spend 500" },
    });
    addProgram();
    selectType(/^Counter$/i);
    fireEvent.change(document.querySelector("#target-counter-type-code") as HTMLInputElement, {
      target: { value: "SPEND" },
    });
    fireEvent.change(document.querySelector("#counter-target-value") as HTMLInputElement, {
      target: { value: "500" },
    });
    fireEvent.click(document.querySelector("#capping-target") as HTMLElement);

    fireEvent.click(screen.getByRole("button", { name: /^Create Target$/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const payload = onSubmit.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload).toMatchObject({
      name: "Spend 500",
      type: "COUNTER",
      counterTargetTypeCode: "SPEND",
      targetValue: 500,
      cappingTarget: true,
    });
  });

  it("submits a MILESTONE payload with milestoneTargetTypeCode + items (≥2 steps)", async () => {
    const allTargets = [
      {
        targetId: "tgt_550e8400e29b41d4a716446655440021",
        type: "COMPLETION",
        code: "STEP_ONE",
        name: "Step One",
      },
      {
        targetId: "tgt_550e8400e29b41d4a716446655440022",
        type: "COMPLETION",
        code: "STEP_TWO",
        name: "Step Two",
      },
    ] as unknown as NonNullable<TargetFormSheetProps["allTargets"]>;

    const { onSubmit } = renderSheet({ allTargets });
    fireEvent.change(screen.getByLabelText(/^Name/i, { selector: "input" }), {
      target: { value: "Journey" },
    });
    addProgram();
    selectType(/^Milestone$/i);
    fireEvent.change(document.querySelector("#target-milestone-type-code") as HTMLInputElement, {
      target: { value: "JOURNEY" },
    });

    // Add the two available targets as milestone steps via the picker.
    fireEvent.click(screen.getByRole("button", { name: /Add Step/i }));
    fireEvent.click(within(document.body).getByText("Step One"));
    fireEvent.click(screen.getByRole("button", { name: /Add Step/i }));
    fireEvent.click(within(document.body).getByText("Step Two"));

    fireEvent.click(screen.getByRole("button", { name: /^Create Target$/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const payload = onSubmit.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload).toMatchObject({
      name: "Journey",
      type: "MILESTONE",
      milestoneTargetTypeCode: "JOURNEY",
    });
    expect(payload.items).toEqual([
      { targetId: "tgt_550e8400e29b41d4a716446655440021", order: 1 },
      { targetId: "tgt_550e8400e29b41d4a716446655440022", order: 2 },
    ]);
  });

  it("submits an X_OF_Y payload with xofYTargetTypeCode + itemTargetIds + targetValue", async () => {
    const allTargets = [
      {
        targetId: "tgt_550e8400e29b41d4a716446655440031",
        type: "COMPLETION",
        code: "TASK_A",
        name: "Task A",
      },
      {
        targetId: "tgt_550e8400e29b41d4a716446655440032",
        type: "COMPLETION",
        code: "TASK_B",
        name: "Task B",
      },
    ] as unknown as NonNullable<TargetFormSheetProps["allTargets"]>;

    const { onSubmit } = renderSheet({ allTargets });
    fireEvent.change(screen.getByLabelText(/^Name/i, { selector: "input" }), {
      target: { value: "Pick Two" },
    });
    addProgram();
    selectType(/^X of Y$/i);
    fireEvent.change(document.querySelector("#target-xofy-type-code") as HTMLInputElement, {
      target: { value: "ANY_TWO" },
    });

    // Add both available targets to the Y set.
    fireEvent.click(screen.getByRole("button", { name: /Add Target/i }));
    fireEvent.click(within(document.body).getByText("Task A"));
    fireEvent.click(screen.getByRole("button", { name: /Add Target/i }));
    fireEvent.click(within(document.body).getByText("Task B"));

    // X must be ≥1 and ≤ number of items.
    fireEvent.change(document.querySelector("#xofy-target-value") as HTMLInputElement, {
      target: { value: "2" },
    });

    fireEvent.click(screen.getByRole("button", { name: /^Create Target$/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const payload = onSubmit.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload).toMatchObject({
      name: "Pick Two",
      type: "X_OF_Y",
      xofYTargetTypeCode: "ANY_TWO",
      targetValue: 2,
    });
    expect(payload.itemTargetIds).toEqual([
      "tgt_550e8400e29b41d4a716446655440031",
      "tgt_550e8400e29b41d4a716446655440032",
    ]);
  });

  it("gates the milestone step picker until all targets have loaded", () => {
    const allTargets = [
      {
        targetId: "tgt_550e8400e29b41d4a716446655440041",
        type: "COMPLETION",
        code: "STEP_ONE",
        name: "Step One",
      },
    ] as unknown as NonNullable<TargetFormSheetProps["allTargets"]>;

    const loadingSheet = renderSheet({ allTargets, allTargetsLoading: true });
    selectType(/^Milestone$/i);

    expect(screen.getByRole("button", { name: /Add Step/i })).toBeDisabled();
    expect(screen.getByText("Loading more targets…")).toBeInTheDocument();

    loadingSheet.unmount();
    renderSheet({ allTargets, allTargetsLoading: false });
    selectType(/^Milestone$/i);

    expect(screen.getByRole("button", { name: /Add Step/i })).toBeEnabled();
    expect(screen.queryByText("Loading more targets…")).not.toBeInTheDocument();
  });

  it("keeps the milestone step picker gated when loading all targets fails", () => {
    const allTargets = [
      {
        targetId: "tgt_550e8400e29b41d4a716446655440043",
        type: "COMPLETION",
        code: "STEP_ONE",
        name: "Step One",
      },
    ] as unknown as NonNullable<TargetFormSheetProps["allTargets"]>;

    renderSheet({ allTargets, allTargetsError: true });
    selectType(/^Milestone$/i);

    expect(screen.getByRole("button", { name: /Add Step/i })).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Failed to load all targets — the list shown may be incomplete."
    );
    expect(screen.queryByText("Loading more targets…")).not.toBeInTheDocument();
  });

  it("gates the X of Y target picker until all targets have loaded", () => {
    const allTargets = [
      {
        targetId: "tgt_550e8400e29b41d4a716446655440042",
        type: "COMPLETION",
        code: "TASK_ONE",
        name: "Task One",
      },
    ] as unknown as NonNullable<TargetFormSheetProps["allTargets"]>;

    const loadingSheet = renderSheet({ allTargets, allTargetsLoading: true });
    selectType(/^X of Y$/i);

    expect(screen.getByRole("button", { name: /Add Target/i })).toBeDisabled();
    expect(screen.getByText("Loading more targets…")).toBeInTheDocument();

    loadingSheet.unmount();
    renderSheet({ allTargets, allTargetsLoading: false });
    selectType(/^X of Y$/i);

    expect(screen.getByRole("button", { name: /Add Target/i })).toBeEnabled();
    expect(screen.queryByText("Loading more targets…")).not.toBeInTheDocument();
  });

  it("keeps the X of Y target picker gated when loading all targets fails", () => {
    const allTargets = [
      {
        targetId: "tgt_550e8400e29b41d4a716446655440044",
        type: "COMPLETION",
        code: "TASK_ONE",
        name: "Task One",
      },
    ] as unknown as NonNullable<TargetFormSheetProps["allTargets"]>;

    renderSheet({ allTargets, allTargetsError: true });
    selectType(/^X of Y$/i);

    expect(screen.getByRole("button", { name: /Add Target/i })).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Failed to load all targets — the list shown may be incomplete."
    );
    expect(screen.queryByText("Loading more targets…")).not.toBeInTheDocument();
  });

  it("omits targetValue + cappingTarget from a COUNTER payload when left at defaults", async () => {
    const { onSubmit } = renderSheet();
    fireEvent.change(screen.getByLabelText(/^Name/i, { selector: "input" }), {
      target: { value: "Bare Counter" },
    });
    addProgram();
    selectType(/^Counter$/i);
    fireEvent.change(document.querySelector("#target-counter-type-code") as HTMLInputElement, {
      target: { value: "VISITS" },
    });
    // Intentionally leave targetValue blank + cappingTarget unchecked.

    fireEvent.click(screen.getByRole("button", { name: /^Create Target$/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const payload = onSubmit.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload.type).toBe("COUNTER");
    // Conditional spreads at handleSubmit drop these keys entirely at defaults.
    expect(payload).not.toHaveProperty("targetValue");
    expect(payload).not.toHaveProperty("cappingTarget");
  });

  it("blocks submission and surfaces an inline error when programIds is empty", async () => {
    const { onSubmit } = renderSheet();
    fireEvent.change(screen.getByLabelText(/^Name/i, { selector: "input" }), {
      target: { value: "No Programs" },
    });
    selectType(/^Completion$/i);

    fireEvent.click(screen.getByRole("button", { name: /^Create Target$/i }));

    // No mutation fires when validation blocks.
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText(/At least one program must be selected/i)).toBeInTheDocument();
  });

  it("blocks submission with an inline error when the variant type code is missing", async () => {
    const { onSubmit } = renderSheet();
    fireEvent.change(screen.getByLabelText(/^Name/i, { selector: "input" }), {
      target: { value: "Missing Type Code" },
    });
    addProgram();
    selectType(/^Completion$/i);
    // Leave completionTargetTypeCode blank.

    fireEvent.click(screen.getByRole("button", { name: /^Create Target$/i }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText(/Completion target type is required/i)).toBeInTheDocument();
  });

  it("surfaces the error prop in the FormSheet alert region", () => {
    renderSheet({ error: "Server returned 422 — code already exists" });
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toMatch(/Server returned 422/);
  });

  it("renders 'Save Changes' button label in edit mode and prefills initialData", () => {
    renderSheet({ mode: "edit", initialData: counterInitial });
    expect(screen.getByRole("button", { name: /^Save Changes$/i })).toBeInTheDocument();
    expect((screen.getByLabelText(/^Name/i, { selector: "input" }) as HTMLInputElement).value).toBe(
      "Spend 100"
    );
    expect((document.querySelector("#counter-target-value") as HTMLInputElement).value).toBe("100");
  });
});

// ─────────────────────────────────────────────────────────────────────────
// L3 — auto-create suggested metadata before parent onSubmit. Pins the
// silent-error fallthrough contract: a createMetadata 4xx must not abort
// the target POST (parent's onSubmit catch is the single error surface).
// ─────────────────────────────────────────────────────────────────────────

describe("[audit] L3 — TARGET auto-create suggested metadata", () => {
  it.each([
    [/^Completion$/i, "COMPLETION_TARGET_TYPE"],
    [/^Counter$/i, "COUNTER_TARGET_TYPE"],
    [/^Milestone$/i, "MILESTONE_TARGET_TYPE"],
    [/^X of Y$/i, "X_OF_Y_TARGET_TYPE"],
  ])("uses the correct metadata type code for %s", (targetTypeLabel, metadataTypeCode) => {
    renderSheet();
    selectType(targetTypeLabel);

    expect(metadataFieldMock.useMetadataField).toHaveBeenLastCalledWith(metadataTypeCode);
  });

  it("fires createMetadata for a suggested completion type on submit", async () => {
    metadataFieldMock.fireAsSuggested = true;
    metadataFieldMock.hookReturn = {
      category: "DATA_TYPE",
      isTypeNotFound: false,
      // The real useMetadataField's findOption also matches the client-side suggestedOptions
      // list (so the UI can label a not-yet-created selection) — a suggested value's own code
      // is always "found" this way. Mirror that here rather than returning undefined, which
      // would assert a shape the real hook never produces.
      findOption: (code: string) => ({ code, name: code, description: undefined }),
      createMetadata: vi.fn<(data: unknown) => Promise<void>>().mockResolvedValue(undefined),
    };

    const { onSubmit } = renderSheet();
    fireEvent.change(screen.getByLabelText(/^Name/i, { selector: "input" }), {
      target: { value: "Suggested Completion" },
    });
    addProgram();
    selectType(/^Completion$/i);
    fireEvent.change(document.querySelector("#target-completion-type-code") as HTMLInputElement, {
      target: { value: "NEW_TYPE" },
    });

    fireEvent.click(screen.getByRole("button", { name: /^Create Target$/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(metadataFieldMock.hookReturn.createMetadata).toHaveBeenCalledWith({
      code: "NEW_TYPE",
      name: "NEW_TYPE",
      description: undefined,
    });
  });

  it("wraps a non-empty suggested-option description in the { en } locale shape", async () => {
    metadataFieldMock.fireAsSuggested = true;
    metadataFieldMock.hookReturn = {
      category: "DATA_TYPE",
      isTypeNotFound: false,
      findOption: (code: string) => ({ code, name: code, description: "A helpful description" }),
      createMetadata: vi.fn<(data: unknown) => Promise<void>>().mockResolvedValue(undefined),
    };

    const { onSubmit } = renderSheet();
    fireEvent.change(screen.getByLabelText(/^Name/i, { selector: "input" }), {
      target: { value: "Suggested Completion With Description" },
    });
    addProgram();
    selectType(/^Completion$/i);
    fireEvent.change(document.querySelector("#target-completion-type-code") as HTMLInputElement, {
      target: { value: "NEW_TYPE_WITH_DESC" },
    });

    fireEvent.click(screen.getByRole("button", { name: /^Create Target$/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(metadataFieldMock.hookReturn.createMetadata).toHaveBeenCalledWith({
      code: "NEW_TYPE_WITH_DESC",
      name: "NEW_TYPE_WITH_DESC",
      description: { en: "A helpful description" },
    });
  });

  it("does not call createMetadata when the picked completion type is not suggested", async () => {
    // Default fireAsSuggested=false (beforeEach) — the MetadataField stub
    // fires onValueChange(value, false) so completionTypeIsSuggested stays false.
    const { onSubmit } = renderSheet();
    fireEvent.change(screen.getByLabelText(/^Name/i, { selector: "input" }), {
      target: { value: "Existing Completion" },
    });
    addProgram();
    selectType(/^Completion$/i);
    fireEvent.change(document.querySelector("#target-completion-type-code") as HTMLInputElement, {
      target: { value: "EXISTING" },
    });

    fireEvent.click(screen.getByRole("button", { name: /^Create Target$/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(metadataFieldMock.hookReturn.createMetadata).not.toHaveBeenCalled();
  });
});
