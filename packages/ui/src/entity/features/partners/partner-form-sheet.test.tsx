// PartnerFormSheet audit suite (L1 widget mapping + L3 behavior).

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

// Mock the MetadataField + its hook to keep the audit suite isolated from
// SDK hooks. The stub renders an <input> with a data-widget attr so L1 and
// orphan-detection assertions work unchanged.
vi.mock("../../../forms/metadata-field/index.js", () => ({
  MetadataField: ({
    id,
    value,
    onValueChange,
    typeCode: _typeCode,
    typeLabel: _typeLabel,
    ...rest
  }: {
    id?: string;
    value: string;
    onValueChange: (v: string, isSuggested: boolean) => void;
    typeCode: string;
    typeLabel?: string;
    [key: string]: unknown;
  }): ReactNode => (
    <input
      {...(rest as Record<string, unknown>)}
      id={id}
      data-widget="metadata-select"
      data-metadata-type="PARTNER_TYPE"
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

import { PartnerFormSheet } from "./partner-form-sheet.js";
import { PARTNER_EDITABLE_FIELDS, PARTNER_STANDARD_FIELDS } from "./types.js";

function renderSheet(overrides: Partial<React.ComponentProps<typeof PartnerFormSheet>> = {}) {
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  const onOpenChange = vi.fn();
  const result = render(
    <PartnerFormSheet
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
// PartnerFormSheet currently mounts. Divergence vs. playbook §11.6 is
// documented in TODOS Phase G and asserted here as current-state.
// ─────────────────────────────────────────────────────────────────────────

describe("[audit] L1 Direction A — PartnerFormSheet base field widgets (current state)", () => {
  it("renders name as a plain Input[type=text] with id='partner-name'", () => {
    renderSheet();
    const input = screen.getByLabelText(/Name/i, { selector: "input" });
    expect(input.id).toBe("partner-name");
    expect(input.tagName).toBe("INPUT");
    expect(input.getAttribute("type")).toBe("text");
  });

  it("renders code as a CodeInput with id='partner-code'", () => {
    renderSheet();
    const input = screen.getByLabelText(/^Code/i, {
      selector: "input",
    }) as HTMLInputElement;
    expect(input.id).toBe("partner-code");
    expect(input.tagName).toBe("INPUT");
  });

  it("auto-generates code in kebab-case when name is typed (CodeInput pipeline)", () => {
    renderSheet();
    const nameInput = screen.getByLabelText(/Name/i, { selector: "input" });
    const codeInput = screen.getByLabelText(/^Code/i, {
      selector: "input",
    }) as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: "Acme Partners Corp" } });
    expect(codeInput.value).toBe("acme-partners-corp");
  });

  it("renders typeCode as MetadataField with id='partner-type-code' and data-metadata-type='PARTNER_TYPE' (G1 resolved)", () => {
    renderSheet();
    const widget = document.querySelector('[data-widget="metadata-select"]');
    expect(widget).not.toBeNull();
    expect(widget?.getAttribute("data-metadata-type")).toBe("PARTNER_TYPE");
    expect(widget?.getAttribute("id")).toBe("partner-type-code");
  });

  it("renders description as LocalizedStringInput bound to id='partner-description' (G2 resolved)", () => {
    renderSheet();
    const labeled = screen.getByLabelText(/^Description$/i);
    expect(labeled.id).toBe("partner-description");
  });

  it("does not render system fields (partnerId, enabledInEnvironments)", () => {
    renderSheet();
    expect(document.querySelector("#partner-partnerId")).toBeNull();
    expect(document.querySelector("#partner-enabledInEnvironments")).toBeNull();
  });

  it("locks code input in edit mode (mode='edit' disables the field)", () => {
    renderSheet({
      mode: "edit",
      initialData: {
        partnerId: "prtn_00000000000000000000000000000001",
        code: "acme-corp",
        name: "Acme Corp",
        type: {
          metadataId: "meta_00000000000000000000000000000001",
          code: "RETAIL",
          name: "Retail",
          typeCode: "PARTNER_TYPE",
          dataTypeId: "dtyp_00000000000000000000000000000001",
        },
      },
    });
    const codeInput = screen.getByLabelText(/^Code/i, {
      selector: "input",
    }) as HTMLInputElement;
    expect(codeInput.disabled).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// L1 — Direction B: every rendered form input maps to a manifest base
// field. Orphan detection via id prefix.
// ─────────────────────────────────────────────────────────────────────────

const EDITABLE_FIELD_IDS = new Set([
  "partner-name",
  "partner-code",
  "partner-type-code",
  "partner-description",
] as const);

describe("[audit] L1 Direction B — PartnerFormSheet orphan detection", () => {
  it("every rendered partner- prefixed element maps to a known field", () => {
    renderSheet();
    // Hint-paragraph ids (aria-describedby targets) are presentational, not editable fields.
    const els = Array.from(document.querySelectorAll("[id^='partner-']")).filter(
      (el) => !(el.getAttribute("id") ?? "").endsWith("-hint")
    );
    for (const el of els) {
      const id = el.getAttribute("id") ?? "";
      expect(
        EDITABLE_FIELD_IDS.has(id as typeof EDITABLE_FIELD_IDS extends Set<infer T> ? T : never),
        `rendered element '${id}' is not in PARTNER_EDITABLE_FIELDS`
      ).toBe(true);
    }
  });

  it("renders exactly the partner- prefixed elements for name, code, typeCode, description (G1/G2 resolved)", () => {
    renderSheet();
    const ids = Array.from(document.querySelectorAll("[id^='partner-']"))
      .map((el) => el.getAttribute("id") ?? "")
      .filter((id) => !id.endsWith("-hint"));
    expect(new Set(ids)).toEqual(EDITABLE_FIELD_IDS);
  });

  it("PARTNER_EDITABLE_FIELDS entries are a subset of PARTNER_STANDARD_FIELDS", () => {
    const standard: readonly string[] = PARTNER_STANDARD_FIELDS;
    for (const f of PARTNER_EDITABLE_FIELDS) {
      expect(standard.includes(f), `'${f}' must be in PARTNER_STANDARD_FIELDS`).toBe(true);
    }
  });

  it("does not render extended-field markup when schema prop is absent", () => {
    renderSheet();
    expect(document.querySelector("[data-extended-section]")).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────
// L3 — Behavior. Form submit, mode-driven edits, error surfacing.
// ─────────────────────────────────────────────────────────────────────────

describe("[audit] L3 — PartnerFormSheet behavior", () => {
  it("submits CreatePartner payload with required fields", async () => {
    const { onSubmit } = renderSheet();
    fireEvent.change(screen.getByLabelText(/Name/i, { selector: "input" }), {
      target: { value: "Acme Corp" },
    });
    const typeWidget = document.querySelector(
      '[data-widget="metadata-select"]'
    ) as HTMLInputElement;
    fireEvent.change(typeWidget, { target: { value: "RETAIL" } });

    fireEvent.click(screen.getByRole("button", { name: /Create Partner/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const payload = onSubmit.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload.name).toBe("Acme Corp");
    expect(payload.code).toBe("acme-corp");
    expect(payload.typeCode).toBe("RETAIL");
  });

  it("omits description from payload when blank", async () => {
    const { onSubmit } = renderSheet();
    fireEvent.change(screen.getByLabelText(/Name/i, { selector: "input" }), {
      target: { value: "Blank Desc Test" },
    });
    const typeWidget = document.querySelector(
      '[data-widget="metadata-select"]'
    ) as HTMLInputElement;
    fireEvent.change(typeWidget, { target: { value: "RETAIL" } });

    fireEvent.click(screen.getByRole("button", { name: /Create Partner/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const payload = onSubmit.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload).not.toHaveProperty("description");
  });

  it("includes description in payload when filled", async () => {
    const { onSubmit } = renderSheet();
    fireEvent.change(screen.getByLabelText(/Name/i, { selector: "input" }), {
      target: { value: "Desc Test" },
    });
    const typeWidget = document.querySelector(
      '[data-widget="metadata-select"]'
    ) as HTMLInputElement;
    fireEvent.change(typeWidget, { target: { value: "RETAIL" } });
    const textarea = document.querySelector("textarea") as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "A partner description" } });

    fireEvent.click(screen.getByRole("button", { name: /Create Partner/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const payload = onSubmit.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload).toHaveProperty("description");
  });

  it("surfaces error prop in the FormSheet alert region", () => {
    renderSheet({ error: "Server returned 422 — code already exists" });
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toMatch(/Server returned 422/);
  });

  it("prefills name, code, typeCode from initialData in edit mode", () => {
    renderSheet({
      mode: "edit",
      initialData: {
        partnerId: "prtn_00000000000000000000000000000001",
        code: "acme-corp",
        name: "Acme Corp",
        type: {
          metadataId: "meta_00000000000000000000000000000001",
          code: "RETAIL",
          name: "Retail",
          typeCode: "PARTNER_TYPE",
          dataTypeId: "dtyp_00000000000000000000000000000001",
        },
      },
    });
    expect((screen.getByLabelText(/Name/i, { selector: "input" }) as HTMLInputElement).value).toBe(
      "Acme Corp"
    );
    expect((screen.getByLabelText(/^Code/i, { selector: "input" }) as HTMLInputElement).value).toBe(
      "acme-corp"
    );
    const typeWidget = document.querySelector(
      '[data-widget="metadata-select"]'
    ) as HTMLInputElement;
    expect(typeWidget.value).toBe("RETAIL");
  });

  it("renders 'Save Changes' button label in edit mode", () => {
    renderSheet({
      mode: "edit",
      initialData: {
        partnerId: "prtn_00000000000000000000000000000001",
        code: "acme-corp",
        name: "Acme Corp",
        type: {
          metadataId: "meta_00000000000000000000000000000001",
          code: "RETAIL",
          name: "Retail",
          typeCode: "PARTNER_TYPE",
          dataTypeId: "dtyp_00000000000000000000000000000001",
        },
      },
    });
    expect(screen.getByRole("button", { name: /Save Changes/i })).toBeInTheDocument();
  });

  it("preserves multi-locale description in edit mode roundtrip", async () => {
    const { onSubmit } = renderSheet({
      mode: "edit",
      initialData: {
        partnerId: "prtn_00000000000000000000000000000002",
        code: "multi-locale-partner",
        name: "Multi Locale Partner",
        type: {
          metadataId: "meta_00000000000000000000000000000001",
          code: "RETAIL",
          name: "Retail",
          typeCode: "PARTNER_TYPE",
          dataTypeId: "dtyp_00000000000000000000000000000001",
        },
        description: { en: "english copy", es: "copia en español" },
      },
    });

    fireEvent.click(screen.getByRole("button", { name: /Save Changes/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const payload = onSubmit.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload.description).toEqual({ en: "english copy", es: "copia en español" });
  });
});
