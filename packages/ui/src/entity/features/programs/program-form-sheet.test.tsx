/**
 * ProgramFormSheet audit suite (L1 widget mapping + L3 behavior).
 *
 * L1 asserts canonical compound widgets — MetadataField (PROGRAM_TYPE),
 * PartnerField, LocalizedStringInput, CodeInput, Switch, CodeGenInformationInput.
 * Partners-field uses a renderCreateSheet prop that mounts PartnerFormSheet;
 * both are mocked to keep the suite SDK-free.
 *
 * L2 (audit-side Zod schema) lives in program-form-sheet.schema.test.ts.
 */

import type { Program } from "@loom-loyalty/sdk";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

// Mock MetadataField — uses useMetadataField (SDK + react-query) internally.
vi.mock("../../../forms/metadata-field/index.js", () => ({
  MetadataField: ({
    id,
    typeCode,
    value,
    onValueChange,
    ...rest
  }: {
    id?: string;
    typeCode: string;
    value: string;
    onValueChange: (v: string, isSuggested: boolean) => void;
    [key: string]: unknown;
  }): ReactNode => (
    <input
      {...(rest as Record<string, unknown>)}
      id={id}
      data-widget="metadata-select"
      data-metadata-type={typeCode}
      value={value}
      onChange={(e) => onValueChange(e.target.value, false)}
    />
  ),
  useMetadataField: () => ({
    createMetadata: vi.fn(),
    findOption: vi.fn(),
    isTypeNotFound: false,
  }),
}));

// Mock PartnerField — uses usePartnerField (SDK + react-query) internally.
vi.mock("../../../forms/partner-field/index.js", () => ({
  PartnerField: ({
    id,
    value,
    onValueChange,
    ...rest
  }: {
    id?: string;
    value: string;
    onValueChange: (v: string) => void;
    [key: string]: unknown;
  }): ReactNode => (
    <input
      {...(rest as Record<string, unknown>)}
      id={id}
      data-widget="entity-combobox"
      data-entity="PARTNER"
      value={value}
      onChange={(e) => onValueChange(e.target.value)}
    />
  ),
  usePartnerField: () => ({
    createPartner: vi.fn(),
  }),
}));

// Mock PartnerFormSheet to avoid hub-specific import chains.
vi.mock("../partners/partner-form-sheet.js", () => ({
  PartnerFormSheet: (): ReactNode => null,
}));

// Mock CodeGenInformationInput — sub-component has no id/name contract
// relevant to the program- prefix invariant. Stub to a sentinel div.
vi.mock("../../../forms/code-gen-information-input.js", () => ({
  CodeGenInformationInput: ({ title }: { title?: string }): ReactNode => (
    <div data-mock="code-gen-information-input">{title ?? "Account ID Generation"}</div>
  ),
}));

import { ProgramFormSheet } from "./program-form-sheet.js";
import { PROGRAM_STANDARD_FIELDS } from "./types.js";

const MINIMAL_PROGRAM: Program = {
  programId: "prog_550e8400e29b41d4a716446655440000",
  code: "test-program",
  name: "Test Program",
  type: {
    metadataId: "meta_00000000000000000000000000000001",
    code: "POINTS",
    name: "Points",
    typeCode: "PROGRAM_TYPE",
    dataTypeId: "dtyp_00000000000000000000000000000001",
  },
};

function renderSheet(overrides: Partial<React.ComponentProps<typeof ProgramFormSheet>> = {}) {
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  const onOpenChange = vi.fn();
  const result = render(
    <ProgramFormSheet
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
// ProgramFormSheet currently mounts. Divergence vs. playbook §11.6 is
// documented in TODOS Phase H and asserted here as current-state to gate
// regressions.
// ─────────────────────────────────────────────────────────────────────────

describe("[audit] L1 Direction A — ProgramFormSheet base field widgets (current state)", () => {
  it("renders name as a plain Input[type=text] with id='program-name'", () => {
    renderSheet();
    const input = screen.getByLabelText(/Name/i, { selector: "input" }) as HTMLInputElement;
    expect(input.id).toBe("program-name");
    expect(input.tagName).toBe("INPUT");
    expect(input.getAttribute("type")).toBe("text");
  });

  it("renders code as a CodeInput with id='program-code'", () => {
    renderSheet();
    const input = screen.getByLabelText(/^Code/i, { selector: "input" }) as HTMLInputElement;
    expect(input.id).toBe("program-code");
    expect(input.tagName).toBe("INPUT");
  });

  it("auto-generates code in kebab-case when name is typed (CodeInput pipeline)", () => {
    renderSheet();
    const nameInput = screen.getByLabelText(/Name/i, { selector: "input" });
    const codeInput = screen.getByLabelText(/^Code/i, { selector: "input" }) as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: "My Loyalty Program" } });
    expect(codeInput.value).toBe("my-loyalty-program");
  });

  it("renders typeCode as MetadataField with id='program-type-code' and data-metadata-type='PROGRAM_TYPE' (H1 resolved)", () => {
    renderSheet();
    const trigger = document.querySelector('[data-widget="metadata-select"]');
    expect(trigger).not.toBeNull();
    expect(trigger?.getAttribute("data-metadata-type")).toBe("PROGRAM_TYPE");
    expect(trigger?.getAttribute("id")).toBe("program-type-code");
  });

  it("renders partnerId as PartnerField with id='program-partner-id' (H2 resolved)", () => {
    renderSheet();
    const trigger = document.querySelector(
      '[data-widget="entity-combobox"][data-entity="PARTNER"]'
    );
    expect(trigger).not.toBeNull();
    expect(trigger?.getAttribute("id")).toBe("program-partner-id");
  });

  it("renders description as a LocalizedStringInput bound to id='program-description' (H3 resolved)", () => {
    renderSheet();
    const labeled = screen.getByLabelText(/^Description$/i);
    expect(labeled.id).toBe("program-description");
  });

  it("renders createAccountOnCustomerCreation as a Switch with id='program-auto-create-accounts' (H4 resolved)", () => {
    renderSheet();
    const switchEl = document.querySelector("#program-auto-create-accounts");
    expect(switchEl).not.toBeNull();
  });

  it("renders programAccountIdInformation via CodeGenInformationInput sentinel", () => {
    renderSheet();
    const sentinel = document.querySelector('[data-mock="code-gen-information-input"]');
    expect(sentinel).not.toBeNull();
  });

  it("locks code input in edit mode", () => {
    renderSheet({ mode: "edit", initialData: MINIMAL_PROGRAM });
    const codeInput = screen.getByLabelText(/^Code/i, { selector: "input" }) as HTMLInputElement;
    expect(codeInput.disabled).toBe(true);
  });

  it("does not render system fields (programId, createdDateTime, modifiedDateTime)", () => {
    renderSheet();
    expect(document.querySelector("#program-programId")).toBeNull();
    expect(document.querySelector("#program-createdDateTime")).toBeNull();
    expect(document.querySelector("#program-modifiedDateTime")).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────
// L1 — Direction B: every editable field rendered maps to a manifest base
// field or known system field. Pins orphan-detection invariant.
// ─────────────────────────────────────────────────────────────────────────

// User-editable program fields that carry a program- prefixed id in the sheet.
const PROGRAM_EDITABLE_FIELDS = new Set([
  "name",
  "code",
  "typeCode",
  "partnerId",
  "description",
  "autoCreateAccounts",
] as const);

describe("[audit] L1 Direction B — ProgramFormSheet orphan detection", () => {
  it("every rendered input/textarea with a program- prefixed id maps to a standard field", () => {
    renderSheet();
    const ids = Array.from(document.querySelectorAll("[id^='program-']"))
      .map((el) => el.getAttribute("id") ?? "")
      // Hint-paragraph ids (aria-describedby targets) are presentational, not editable fields.
      .filter((id) => Boolean(id) && !id.endsWith("-hint"));
    const fieldKeys = ids.map((id) =>
      id.replace(/^program-/, "").replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())
    );
    const known: readonly string[] = PROGRAM_STANDARD_FIELDS;
    for (const key of fieldKeys) {
      expect(
        known.includes(key) || PROGRAM_EDITABLE_FIELDS.has(key as "name" | "code"),
        `rendered field '${key}' is not in PROGRAM_STANDARD_FIELDS`
      ).toBe(true);
    }
  });

  it("name and code carry program- prefixed ids (the two resolved fields)", () => {
    renderSheet();
    const ids = Array.from(document.querySelectorAll("[id^='program-']")).map(
      (el) => el.getAttribute("id") ?? ""
    );
    expect(ids).toContain("program-name");
    expect(ids).toContain("program-code");
  });

  it("auto-create-accounts Switch carries program- prefix (H4 resolved)", () => {
    renderSheet();
    const switchEl = document.querySelector("#program-auto-create-accounts");
    expect(switchEl).not.toBeNull();
  });

  it("does not accept a schema/extendedFields prop today in Direction B (extension fields via ExtendedFieldsSection)", () => {
    renderSheet();
    // ExtendedFieldsSection only renders when schema + extendedFields.length > 0.
    expect(document.querySelector("[data-extended-section]")).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────
// L3 — Behavior. Form submit, mode-driven edits, error surfacing.
// ─────────────────────────────────────────────────────────────────────────

describe("[audit] L3 — ProgramFormSheet behavior", () => {
  it("submits CreateProgram payload with required fields (name, code, typeCode)", async () => {
    const { onSubmit } = renderSheet();
    const nameInput = screen.getByLabelText(/Name/i, { selector: "input" });
    const typeCodeInput = document.querySelector(
      '[data-widget="metadata-select"]'
    ) as HTMLInputElement;

    fireEvent.change(nameInput, { target: { value: "Gold Program" } });
    fireEvent.change(typeCodeInput, { target: { value: "POINTS" } });

    const submitButton = screen.getByRole("button", { name: /Create Program/i });
    fireEvent.click(submitButton);

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const payload = onSubmit.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload.name).toBe("Gold Program");
    expect(payload.code).toBe("gold-program");
    expect(payload.typeCode).toBe("POINTS");
  });

  it("includes partnerId in payload when partner field is filled", async () => {
    const { onSubmit } = renderSheet();
    fireEvent.change(screen.getByLabelText(/Name/i, { selector: "input" }), {
      target: { value: "Brand Program" },
    });
    fireEvent.change(
      document.querySelector('[data-widget="metadata-select"]') as HTMLInputElement,
      { target: { value: "POINTS" } }
    );
    fireEvent.change(
      document.querySelector('[data-widget="entity-combobox"]') as HTMLInputElement,
      { target: { value: "part_550e8400e29b41d4a716446655440000" } }
    );

    fireEvent.click(screen.getByRole("button", { name: /Create Program/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const payload = onSubmit.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload.partnerId).toBe("part_550e8400e29b41d4a716446655440000");
  });

  it("omits partnerId from payload when partner field is empty", async () => {
    const { onSubmit } = renderSheet();
    fireEvent.change(screen.getByLabelText(/Name/i, { selector: "input" }), {
      target: { value: "No Partner Program" },
    });
    fireEvent.change(
      document.querySelector('[data-widget="metadata-select"]') as HTMLInputElement,
      { target: { value: "POINTS" } }
    );

    fireEvent.click(screen.getByRole("button", { name: /Create Program/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const payload = onSubmit.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload.partnerId).toBeUndefined();
  });

  it("omits description from payload when description is empty/whitespace-only", async () => {
    const { onSubmit } = renderSheet();
    fireEvent.change(screen.getByLabelText(/Name/i, { selector: "input" }), {
      target: { value: "Trim Test" },
    });
    fireEvent.change(
      document.querySelector('[data-widget="metadata-select"]') as HTMLInputElement,
      { target: { value: "POINTS" } }
    );
    const textarea = document.querySelector("textarea");
    if (textarea) {
      fireEvent.change(textarea, { target: { value: "  \t  " } });
    }

    fireEvent.click(screen.getByRole("button", { name: /Create Program/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const payload = onSubmit.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload.description).toBeUndefined();
  });

  it("includes description when filled", async () => {
    const { onSubmit } = renderSheet();
    fireEvent.change(screen.getByLabelText(/Name/i, { selector: "input" }), {
      target: { value: "Described Program" },
    });
    fireEvent.change(
      document.querySelector('[data-widget="metadata-select"]') as HTMLInputElement,
      { target: { value: "POINTS" } }
    );
    const textarea = document.querySelector("textarea");
    if (textarea) {
      fireEvent.change(textarea, { target: { value: "Earn points for every purchase" } });
    }

    fireEvent.click(screen.getByRole("button", { name: /Create Program/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const payload = onSubmit.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload.description).toBeTruthy();
  });

  it("surfaces error prop in the FormSheet alert region", () => {
    renderSheet({ error: "Server returned 422 — code already exists" });
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toMatch(/Server returned 422/);
  });

  it("prefills name + code + typeCode from initialData in edit mode", () => {
    renderSheet({ mode: "edit", initialData: MINIMAL_PROGRAM });
    expect((screen.getByLabelText(/Name/i, { selector: "input" }) as HTMLInputElement).value).toBe(
      "Test Program"
    );
    expect((screen.getByLabelText(/^Code/i, { selector: "input" }) as HTMLInputElement).value).toBe(
      "test-program"
    );
    const typeWidget = document.querySelector(
      '[data-widget="metadata-select"]'
    ) as HTMLInputElement;
    expect(typeWidget.value).toBe("POINTS");
  });

  it("prefills partnerId from initialData when partner is present", () => {
    const programWithPartner: Program = {
      ...MINIMAL_PROGRAM,
      partner: {
        partnerId: "part_550e8400e29b41d4a716446655440000",
        code: "acme",
        name: "Acme Corp",
        type: {
          metadataId: "meta_00000000000000000000000000000002",
          code: "RETAIL",
          name: "Retail",
          typeCode: "PARTNER_TYPE",
          dataTypeId: "dtyp_00000000000000000000000000000002",
        },
      },
    };
    renderSheet({ mode: "edit", initialData: programWithPartner });
    const partnerWidget = document.querySelector('[data-entity="PARTNER"]') as HTMLInputElement;
    expect(partnerWidget.value).toBe("part_550e8400e29b41d4a716446655440000");
  });

  it("renders 'Save Changes' button label in edit mode", () => {
    renderSheet({ mode: "edit", initialData: MINIMAL_PROGRAM });
    expect(screen.getByRole("button", { name: /Save Changes/i })).toBeInTheDocument();
  });

  it("preserves multi-locale description on submit in edit mode (H3 roundtrip gate)", async () => {
    const programWithDesc: Program = {
      ...MINIMAL_PROGRAM,
      description: { en: "english copy", es: "copia", fr: "copie française" },
    };
    const { onSubmit } = renderSheet({ mode: "edit", initialData: programWithDesc });
    const textarea = document.querySelector("textarea") as HTMLTextAreaElement;
    expect(textarea.value).toBe("english copy");

    fireEvent.click(screen.getByRole("button", { name: /Save Changes/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const payload = onSubmit.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload.description).toEqual({
      en: "english copy",
      es: "copia",
      fr: "copie française",
    });
  });

  it("createAccountOnCustomerCreation defaults to false in create mode", () => {
    renderSheet();
    const switchEl = document.querySelector("#program-auto-create-accounts") as HTMLButtonElement;
    expect(switchEl.getAttribute("data-state")).toBe("unchecked");
  });

  it("reflects createAccountOnCustomerCreation from initialData", () => {
    const programWithAutoCreate: Program = {
      ...MINIMAL_PROGRAM,
      createAccountOnCustomerCreation: true,
    };
    renderSheet({ mode: "edit", initialData: programWithAutoCreate });
    const switchEl = document.querySelector("#program-auto-create-accounts") as HTMLButtonElement;
    expect(switchEl.getAttribute("data-state")).toBe("checked");
  });
});
