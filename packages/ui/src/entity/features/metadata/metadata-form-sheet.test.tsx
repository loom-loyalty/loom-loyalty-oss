/**
 * MetadataFormSheet audit suite (L1 widget mapping + L3 behavior).
 *
 * L1 asserts canonical compound widgets — MetadataTypeField (C1) and
 * MetadataField (C2). Cross-entity consumer probe stays DESCOPED —
 * covered by C6 follow-up; L1 stays ★★ until that lands.
 *
 * L2 (audit-side Zod schema) lives in metadata-form-sheet.schema.test.ts.
 */

import type { UIEntitySchema } from "@loom-loyalty/schema";
import type * as LoomSdk from "@loom-loyalty/sdk";
import type { DataType, Item, Location, MetadataTypeCategory } from "@loom-loyalty/sdk";
import { fireEvent, render as rtlRender, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, describe, expect, expectTypeOf, it, vi } from "vitest";

// Per-type categories the SDK's by-code lookup answers with. Anything not
// listed is a plain METADATA type, which is what the base suite assumes.
const typeCategories = vi.hoisted(() => new Map<string, string>());

// Type codes the by-code lookup answers with a 404, for the "type is gone"
// branch. A code in here never resolves a category.
const missingTypes = vi.hoisted(() => new Set<string>());

// The sheet resolves a type's category through the SDK and loads the option
// lists the sub-type branches select from. Stub those three reads so the
// suite stays hermetic.
vi.mock("@loom-loyalty/sdk", async () => {
  const actual = await vi.importActual<typeof LoomSdk>("@loom-loyalty/sdk");
  return {
    ...actual,
    useMetadataManagementGetMetadataTypeByCode: (code: string) => {
      if (code && missingTypes.has(code)) {
        return { data: undefined, isLoading: false, error: { status: 404 } };
      }
      return {
        data: code
          ? { data: { code, category: typeCategories.get(code) ?? "METADATA" } }
          : undefined,
        isLoading: false,
        error: null,
      };
    },
    // PROGRAM_TYPE's entries may sit under a TIER_TYPE entry.
    metadataManagementListMetadataTypeParentsByCode: async (code: string) => ({
      status: 200,
      data: {
        content: code === "PROGRAM_TYPE" ? [{ code: "TIER_TYPE", name: "Tier Type" }] : [],
      },
    }),
    // Option lists are read page by page through the plain fetchers.
    dataModelManagementListDataModelTypes: async () => ({
      status: 200,
      data: { content: [{ code: "RECEIPT", name: "Receipt Model" }], totalPages: 1 },
    }),
    metadataManagementListMetadataByType: async () => ({
      status: 200,
      data: { content: [{ code: "US", name: "United States" }], totalPages: 1 },
    }),
  };
});

afterEach(() => {
  typeCategories.clear();
  missingTypes.clear();
});

// Mock the canonical compound widgets to keep the audit suite isolated from
// SDK hooks. Each stub renders an <input> with the production id + the
// production data-* attrs so id-based selectors and orphan-detection
// continue to work unchanged.
vi.mock("../../../forms/metadata-type-field/metadata-type-field", () => ({
  MetadataTypeField: ({
    value,
    onValueChange,
    ...rest
  }: {
    value: string;
    onValueChange: (v: string) => void;
    [key: string]: unknown;
  }): ReactNode => (
    <input
      {...(rest as Record<string, unknown>)}
      data-widget="metadata-type-combobox"
      data-entity="METADATA_TYPE"
      data-metadata-category="DATA_TYPE"
      value={value}
      onChange={(e) => onValueChange(e.target.value)}
    />
  ),
}));

vi.mock("../../../forms/metadata-field/metadata-field", () => ({
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
    typeLabel: string;
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
}));

import { createQueryWrapper } from "../../../test/query-client-wrapper";
import { MetadataFormSheet } from "./metadata-form-sheet.js";
import type { MetadataFormSheetProps, MetadataSubmitData } from "./types.js";
import { METADATA_STANDARD_FIELDS } from "./types.js";

// The parent-type pickers read a shared react-query entry, so every render
// (and its rerenders) gets a fresh QueryClient.
function render(ui: React.ReactElement) {
  const { Wrapper } = createQueryWrapper();
  return rtlRender(ui, { wrapper: Wrapper });
}

function renderSheet(overrides: Partial<React.ComponentProps<typeof MetadataFormSheet>> = {}) {
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  const onOpenChange = vi.fn();
  const result = render(
    <MetadataFormSheet
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
// MetadataFormSheet currently mounts. Divergence vs. playbook §11.6 is
// documented in TODOS C1–C3 and asserted here as current-state to gate
// regressions.
// ─────────────────────────────────────────────────────────────────────────

describe("[audit] L1 Direction A — MetadataFormSheet base field widgets (current state)", () => {
  it("renders name as an Input[type=text] with data-widget='text-input' and id='metadata-name' (C5 resolved)", () => {
    renderSheet();
    const input = screen.getByLabelText(/Name/i, { selector: "input" });
    expect(input.id).toBe("metadata-name");
    expect(input.tagName).toBe("INPUT");
    expect(input.getAttribute("type")).toBe("text");
    expect(input.getAttribute("data-widget")).toBe("text-input");
  });

  it("renders code as a CodeInput with kebab-case auto-generation", () => {
    renderSheet();
    const input = screen.getByLabelText(/^Code/i, { selector: "input" }) as HTMLInputElement;
    expect(input.id).toBe("metadata-code");
    // CodeInput renders an <input>; kebab-case format is wired via the source value
    // pipeline. We verify auto-gen by typing into the name field below.
    expect(input.tagName).toBe("INPUT");
  });

  it("auto-generates code in kebab-case when name is typed (CodeInput pipeline)", () => {
    renderSheet();
    const nameInput = screen.getByLabelText(/Name/i, { selector: "input" });
    const codeInput = screen.getByLabelText(/^Code/i, { selector: "input" }) as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: "Standard Gold Tier" } });
    expect(codeInput.value).toBe("standard-gold-tier");
  });

  it("renders typeCode as MetadataTypeField with data-widget='metadata-type-combobox' (C1 resolved)", () => {
    renderSheet();
    const trigger = document.querySelector('[data-widget="metadata-type-combobox"]');
    expect(trigger).not.toBeNull();
    expect(trigger?.getAttribute("id")).toBe("metadata-type-code");
  });

  it("forwards aria-required to MetadataTypeField (WCAG 4.1.2 — required state announced)", () => {
    renderSheet();
    const trigger = document.querySelector('[data-widget="metadata-type-combobox"]');
    expect(trigger?.getAttribute("aria-required")).toBe("true");
  });

  it("offers one parent picker per parent type of the chosen type (create mode)", async () => {
    renderSheet();
    expect(document.querySelector('[data-widget="metadata-select"]')).toBeNull();
    fireEvent.change(screen.getByLabelText(/Type Code/i, { selector: "input" }), {
      target: { value: "PROGRAM_TYPE" },
    });
    const trigger = await waitFor(() => {
      const el = document.querySelector('[data-widget="metadata-select"]');
      expect(el).not.toBeNull();
      return el;
    });
    expect(trigger?.getAttribute("id")).toBe("metadata-parent-TIER_TYPE");
    expect(trigger?.getAttribute("data-metadata-type")).toBe("TIER_TYPE");
  });

  it("points to Relationships for parents in edit mode", () => {
    const initial: DataType = {
      metadataId: "meta_00000000000000000000000000000001",
      code: "standard-gold",
      name: "Standard Gold",
      typeCode: "PROGRAM_TYPE",
      dataTypeId: "dtyp_00000000000000000000000000000001",
    };
    renderSheet({ mode: "edit", initialData: initial });
    expect(screen.getByText(/under Relationships in its details/)).not.toBeNull();
    expect(document.querySelector('[data-widget="metadata-select"]')).toBeNull();
  });

  it("renders description as a LocalizedStringInput with associated label (C3 resolved, WCAG 1.3.1)", () => {
    renderSheet();
    // LocalizedStringInput forwards the id to its active locale input.
    // getByLabelText resolves the Label htmlFor → input id binding.
    const labeled = screen.getByLabelText(/^Description$/i);
    expect(labeled.id).toBe("metadata-description");
  });

  it("does not render system fields (metadataId, dateTimePeriod, createdDateTime, modifiedDateTime)", () => {
    renderSheet();
    expect(document.querySelector("#metadata-metadataId")).toBeNull();
    expect(document.querySelector("#metadata-dateTimePeriod")).toBeNull();
    expect(document.querySelector("#metadata-createdDateTime")).toBeNull();
    expect(document.querySelector("#metadata-modifiedDateTime")).toBeNull();
  });

  it("locks code input in edit mode (mode='edit' disables the field)", () => {
    const initial: DataType = {
      metadataId: "meta_00000000000000000000000000000001",
      code: "standard-gold",
      name: "Standard Gold",
      typeCode: "PROGRAM_TYPE",
      dataTypeId: "dtyp_00000000000000000000000000000001",
    };
    renderSheet({ mode: "edit", initialData: initial });
    const codeInput = screen.getByLabelText(/^Code/i, { selector: "input" }) as HTMLInputElement;
    expect(codeInput.disabled).toBe(true);
  });

  it("locks typeCode input in edit mode", () => {
    const initial: DataType = {
      metadataId: "meta_00000000000000000000000000000001",
      code: "standard-gold",
      name: "Standard Gold",
      typeCode: "PROGRAM_TYPE",
      dataTypeId: "dtyp_00000000000000000000000000000001",
    };
    renderSheet({ mode: "edit", initialData: initial });
    const typeCodeInput = screen.getByLabelText(/Type Code/i, {
      selector: "input",
    }) as HTMLInputElement;
    expect(typeCodeInput.disabled).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// L1 — Direction B: every editable field rendered in the sheet maps to a
// manifest base field. With C5 unresolved (no `data-widget` attrs), we
// enumerate by element type and assert id-prefix invariant.
// ─────────────────────────────────────────────────────────────────────────

// User-editable base fields (METADATA_STANDARD_FIELDS minus output-only
// system fields createdDateTime + modifiedDateTime). Both directions of
// the orphan check assert against this exact set, not a subset.
// Parent pickers are per parent type of the chosen type, so none render here.
const METADATA_EDITABLE_FIELDS = new Set(["name", "code", "typeCode", "description"] as const);

describe("[audit] L1 Direction B — MetadataFormSheet orphan detection", () => {
  it("every rendered input/textarea has a metadata- prefixed id (no naming-convention orphans)", () => {
    // FormSheet renders inside a Radix Dialog portal, so query document.body.
    renderSheet();
    // Orphan fields without an id would still surface in this set with id="",
    // forcing the assertion below to fail with a clear message.
    const editable = Array.from(document.querySelectorAll("input,textarea"));
    expect(editable.length).toBeGreaterThan(0);
    for (const el of editable) {
      const id = el.getAttribute("id") ?? "";
      expect(
        id,
        `editable element ${el.outerHTML.slice(0, 120)} must have a metadata- prefixed id`
      ).toMatch(/^metadata-/);
    }
  });

  it("renders exactly the user-editable base fields — no orphans, no missing", () => {
    // Set-equality (not subset). Catches BOTH future regressions where a
    // base field is dropped AND additions of unmapped fields.
    renderSheet();
    const ids = Array.from(document.querySelectorAll("[id^='metadata-']"))
      .map((el) => el.getAttribute("id") ?? "")
      .filter((id) => id.startsWith("metadata-"));
    const fieldKeys = ids
      .map((id) => id.replace(/^metadata-/, ""))
      .map((slug) => slug.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase()));

    // Every rendered field must be a user-editable base field…
    const editable: ReadonlySet<string> = METADATA_EDITABLE_FIELDS;
    const known: readonly string[] = METADATA_STANDARD_FIELDS;
    for (const key of fieldKeys) {
      expect(
        editable.has(key) || known.includes(key),
        `rendered field '${key}' is not in METADATA_STANDARD_FIELDS`
      ).toBe(true);
    }
    // …and every user-editable base field must be rendered.
    expect(new Set(fieldKeys)).toEqual(METADATA_EDITABLE_FIELDS);
  });

  it("does not render an ExtendedFieldsSection without schema + extendedFields props", () => {
    renderSheet();
    expect(document.querySelector("[data-extended-section]")).toBeNull();
  });

  it("C4 resolved: accepts schema + extendedFields props and renders the ExtendedFieldsSection", () => {
    // C4 fix: MetadataFormSheetProps now accepts schema + extendedFields;
    // passing them mounts an ExtendedFieldsSection (carries data-extended-section).
    const schema: UIEntitySchema = {
      entityCode: "metadata",
      singularName: "Metadata",
      pluralName: "Metadata",
      displayField: "name",
      canCreate: true,
      canEdit: true,
      canDelete: true,
      fields: {
        customField1: {
          name: "customField1",
          label: "Custom Field 1",
          widget: "text",
          displayFormat: "text",
          showInList: false,
          showInDetail: true,
          showInCreate: true,
          showInEdit: true,
        },
      },
      list: { columns: [], searchable: false, pageSizes: [25] },
      detail: { groups: [], showTimestamps: false },
      create: { groups: [], showCancel: true, showReset: false },
      edit: { groups: [], showCancel: true, showReset: false },
    };
    renderSheet({ schema, extendedFields: ["customField1"] });
    expect(document.querySelector("[data-extended-section]")).not.toBeNull();
  });
});

describe("MetadataFormSheet — a type's own data model", () => {
  const orderSchema: UIEntitySchema = {
    entityCode: "onboarding-quest",
    singularName: "Onboarding Quest",
    pluralName: "Onboarding Quests",
    displayField: "name",
    canCreate: true,
    canEdit: true,
    canDelete: true,
    fields: {
      order: {
        name: "order",
        label: "Order",
        widget: "text",
        displayFormat: "text",
        showInList: false,
        showInDetail: true,
        showInCreate: true,
        showInEdit: true,
      },
    },
    list: { columns: [], searchable: false, pageSizes: [25] },
    detail: { groups: [], showTimestamps: false },
    create: { groups: [], showCancel: true, showReset: false },
    edit: { groups: [], showCancel: true, showReset: false },
  };

  it("tells the caller which type was picked", () => {
    const onTypeCodeChange = vi.fn();
    renderSheet({ onTypeCodeChange });
    fireEvent.change(screen.getByLabelText(/Type Code/i, { selector: "input" }), {
      target: { value: "onboarding-quest" },
    });
    expect(onTypeCodeChange).toHaveBeenCalledWith("onboarding-quest");
  });

  it("fills fields that arrive after open from the stored value", () => {
    const initialData = {
      metadataId: "meta_00000000000000000000000000000001",
      code: "create-program",
      name: "Create a program",
      typeCode: "onboarding-quest",
      order: "1",
    } as unknown as MetadataFormSheetProps["initialData"];
    const { rerender, onSubmit, onOpenChange } = renderSheet({ mode: "edit", initialData });

    // The type's model loads after the sheet opened.
    rerender(
      <MetadataFormSheet
        open
        onOpenChange={onOpenChange}
        mode="edit"
        initialData={initialData}
        onSubmit={onSubmit}
        schema={orderSchema}
        extendedFields={["order"]}
      />
    );

    expect((screen.getByLabelText(/^Order/) as HTMLInputElement).value).toBe("1");
  });

  it("leaves out values typed for a type picked earlier", async () => {
    const { rerender, onSubmit, onOpenChange } = renderSheet({
      schema: orderSchema,
      extendedFields: ["order"],
    });
    fireEvent.change(screen.getByLabelText(/Name/i, { selector: "input" }), {
      target: { value: "Region one" },
    });
    fireEvent.change(screen.getByLabelText(/^Order/), { target: { value: "3" } });

    // Picking a type on the shared model drops the field list.
    rerender(
      <MetadataFormSheet open onOpenChange={onOpenChange} mode="create" onSubmit={onSubmit} />
    );
    fireEvent.change(screen.getByLabelText(/Type Code/i, { selector: "input" }), {
      target: { value: "REGION" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Create Metadata/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0]?.[0]).not.toHaveProperty("order");
  });

  it("blocks saving while the type's own model is unavailable", async () => {
    const initialData = {
      metadataId: "meta_00000000000000000000000000000001",
      code: "create-program",
      name: "Create a program",
      typeCode: "onboarding-quest",
      order: "1",
    } as unknown as MetadataFormSheetProps["initialData"];
    const { onSubmit } = renderSheet({
      mode: "edit",
      initialData,
      schemaUnavailableMessage: "Still loading this metadata type — try again in a moment.",
    });

    fireEvent.click(screen.getByRole("button", { name: /Save Changes/i }));

    expect(await screen.findByText(/Still loading this metadata type/)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────
// L3 — Behavior. Form submit, mode-driven edits, error surfacing.
// ─────────────────────────────────────────────────────────────────────────

describe("[audit] L3 — MetadataFormSheet behavior", () => {
  it("clears the chosen parents when typeCode changes", async () => {
    const { onSubmit } = renderSheet();
    fireEvent.change(screen.getByLabelText(/Name/i, { selector: "input" }), {
      target: { value: "Premium" },
    });
    const typeInput = screen.getByLabelText(/Type Code/i, { selector: "input" });
    fireEvent.change(typeInput, { target: { value: "PROGRAM_TYPE" } });
    fireEvent.change(await screen.findByLabelText("Tier Type", { selector: "input" }), {
      target: { value: "gold" },
    });
    fireEvent.change(typeInput, { target: { value: "BADGE_TYPE" } });
    fireEvent.change(typeInput, { target: { value: "PROGRAM_TYPE" } });
    expect(
      ((await screen.findByLabelText("Tier Type", { selector: "input" })) as HTMLInputElement).value
    ).toBe("");
    fireEvent.click(screen.getByRole("button", { name: /Create Metadata/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0]?.[2]).toEqual({});
  });

  it("submits CreateMetadata payload with required fields (no parentCode/description)", async () => {
    const { onSubmit } = renderSheet();
    const nameInput = screen.getByLabelText(/Name/i, { selector: "input" });
    const typeCodeInput = screen.getByLabelText(/Type Code/i, { selector: "input" });

    fireEvent.change(nameInput, { target: { value: "Standard Gold" } });
    fireEvent.change(typeCodeInput, { target: { value: "PROGRAM_TYPE" } });

    const submitButton = screen.getByRole("button", { name: /Create Metadata/i });
    fireEvent.click(submitButton);

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith(
      {
        name: "Standard Gold",
        code: "standard-gold",
        typeCode: "PROGRAM_TYPE",
      },
      "METADATA",
      {}
    );
  });

  it("passes chosen parents separately from the payload, with { en: description }", async () => {
    const { onSubmit } = renderSheet();
    fireEvent.change(screen.getByLabelText(/Name/i, { selector: "input" }), {
      target: { value: "Premium" },
    });
    fireEvent.change(screen.getByLabelText(/Type Code/i, { selector: "input" }), {
      target: { value: "PROGRAM_TYPE" },
    });
    fireEvent.change(await screen.findByLabelText("Tier Type", { selector: "input" }), {
      target: { value: "standard-gold" },
    });
    fireEvent.change(screen.getByLabelText(/Description/i, { selector: "textarea" }), {
      target: { value: "Top tier" },
    });

    fireEvent.click(screen.getByRole("button", { name: /Create Metadata/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith(
      {
        name: "Premium",
        code: "premium",
        typeCode: "PROGRAM_TYPE",
        description: { en: "Top tier" },
      },
      "METADATA",
      { TIER_TYPE: "standard-gold" }
    );
  });

  it("strips a whitespace-only description from the payload", async () => {
    const { onSubmit } = renderSheet();
    fireEvent.change(screen.getByLabelText(/Name/i, { selector: "input" }), {
      target: { value: "Trim Test" },
    });
    fireEvent.change(screen.getByLabelText(/Type Code/i, { selector: "input" }), {
      target: { value: "PROGRAM_TYPE" },
    });
    fireEvent.change(screen.getByLabelText(/Description/i, { selector: "textarea" }), {
      target: { value: "  \t " },
    });

    fireEvent.click(screen.getByRole("button", { name: /Create Metadata/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const payload = onSubmit.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload).not.toHaveProperty("description");
  });

  it("surfaces error prop in the FormSheet alert region", () => {
    renderSheet({ error: "Server returned 422 — code already exists" });
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toMatch(/Server returned 422/);
  });

  it("preserves all locales on multi-locale description load (C3 resolved)", async () => {
    const initial: DataType = {
      metadataId: "meta_00000000000000000000000000000001",
      code: "standard-gold",
      name: "Standard Gold",
      typeCode: "PROGRAM_TYPE",
      dataTypeId: "dtyp_00000000000000000000000000000001",
      description: { en: "english copy", es: "copia en español", fr: "copie française" },
    };
    const { onSubmit } = renderSheet({ mode: "edit", initialData: initial });
    const textarea = screen.getByLabelText(/^Description$/i) as HTMLTextAreaElement;
    // en is the default-active locale; LocalizedStringInput surfaces it first.
    expect(textarea.value).toBe("english copy");

    // Submit without touching anything — the full multi-locale object must
    // round-trip to the wire, proving C3 (silent es/fr drop) is resolved.
    fireEvent.click(screen.getByRole("button", { name: /Save Changes/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const payload = onSubmit.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload.description).toEqual({
      en: "english copy",
      es: "copia en español",
      fr: "copie française",
    });
  });

  it("prefills name + code + typeCode from initialData in edit mode", () => {
    const initial: DataType = {
      metadataId: "meta_00000000000000000000000000000002",
      code: "premium",
      name: "Premium",
      typeCode: "PROGRAM_TYPE",
      dataTypeId: "dtyp_00000000000000000000000000000002",
      description: { en: "" },
    };
    renderSheet({ mode: "edit", initialData: initial });
    expect((screen.getByLabelText(/Name/i, { selector: "input" }) as HTMLInputElement).value).toBe(
      "Premium"
    );
    expect((screen.getByLabelText(/^Code/i, { selector: "input" }) as HTMLInputElement).value).toBe(
      "premium"
    );
    expect(
      (screen.getByLabelText(/Type Code/i, { selector: "input" }) as HTMLInputElement).value
    ).toBe("PROGRAM_TYPE");
  });

  it("renders 'Save Changes' button label in edit mode", () => {
    const initial: DataType = {
      metadataId: "meta_00000000000000000000000000000001",
      code: "standard-gold",
      name: "Standard Gold",
      typeCode: "PROGRAM_TYPE",
      dataTypeId: "dtyp_00000000000000000000000000000001",
    };
    renderSheet({ mode: "edit", initialData: initial });
    expect(screen.getByRole("button", { name: /Save Changes/i })).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────
// L3 — Lifecycle edge cases (C10). Cancel/escape close, async-error
// stays-open, double-submit current behavior. Pins what the form sheet
// does today so future regressions surface.
// ─────────────────────────────────────────────────────────────────────────

describe("[audit] L3 lifecycle — MetadataFormSheet edge cases (C10)", () => {
  it("closes the sheet and clears form state when Cancel is clicked", () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const onOpenChange = vi.fn();
    const { rerender } = render(
      <MetadataFormSheet open onOpenChange={onOpenChange} mode="create" onSubmit={onSubmit} />
    );

    // Dirty the form so the post-close reset is observable.
    fireEvent.change(screen.getByLabelText(/Name/i, { selector: "input" }), {
      target: { value: "Dirty Value" },
    });
    expect((screen.getByLabelText(/Name/i, { selector: "input" }) as HTMLInputElement).value).toBe(
      "Dirty Value"
    );

    fireEvent.click(screen.getByRole("button", { name: /^Cancel$/i }));
    expect(onOpenChange).toHaveBeenCalledWith(false);

    // Re-open: form state must have been reset by handleOpenChange's
    // resetForm() side-effect. Parent flips `open` back to true to simulate
    // a fresh Create click.
    rerender(
      <MetadataFormSheet open onOpenChange={onOpenChange} mode="create" onSubmit={onSubmit} />
    );
    expect((screen.getByLabelText(/Name/i, { selector: "input" }) as HTMLInputElement).value).toBe(
      ""
    );
  });

  it("clears form state on reopen when the parent closed it after a submit", () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const onOpenChange = vi.fn();
    const sheet = (open: boolean) => (
      <MetadataFormSheet
        open={open}
        onOpenChange={onOpenChange}
        mode="create"
        onSubmit={onSubmit}
      />
    );
    const { rerender } = render(sheet(true));
    const nameInput = () =>
      screen.getByLabelText(/Name/i, { selector: "input" }) as HTMLInputElement;

    fireEvent.change(nameInput(), { target: { value: "North" } });
    // The page closes the sheet itself on success, never calling onOpenChange.
    rerender(sheet(false));
    rerender(sheet(true));

    expect(nameInput().value).toBe("");
    expect((screen.getByLabelText(/^Code/i, { selector: "input" }) as HTMLInputElement).value).toBe(
      ""
    );
  });

  it("closes the sheet when Escape is pressed", () => {
    const onOpenChange = vi.fn();
    render(
      <MetadataFormSheet
        open
        onOpenChange={onOpenChange}
        mode="create"
        onSubmit={vi.fn().mockResolvedValue(undefined)}
      />
    );

    // Radix Dialog listens for Escape on the document and fires
    // onOpenChange(false) — MetadataFormSheet's handleOpenChange forwards.
    fireEvent.keyDown(document.body, { key: "Escape", code: "Escape" });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("keeps the sheet open and surfaces the error when async submit rejects", async () => {
    // onSubmit must actually reject so the form sheet has a real chance
    // to mishandle the rejection. Production-side, the parent owns the
    // try/catch — but the form sheet must not auto-close regardless.
    // The synchronous form-submit event handler awaits this in detached
    // promise context, so the rejection arrives as an unhandled-rejection
    // at the Node process level. We swallow it for the duration of the
    // test and assert it was the expected error — proving the rejection
    // actually propagated.
    const captured: unknown[] = [];
    const onUnhandled = (reason: unknown) => {
      captured.push(reason);
    };
    process.on("unhandledRejection", onUnhandled);

    try {
      const onOpenChange = vi.fn();
      const onSubmit = vi.fn().mockRejectedValue(new Error("network down"));
      const { rerender } = render(
        <MetadataFormSheet open onOpenChange={onOpenChange} mode="create" onSubmit={onSubmit} />
      );

      fireEvent.change(screen.getByLabelText(/Name/i, { selector: "input" }), {
        target: { value: "Crash" },
      });
      fireEvent.change(screen.getByLabelText(/Type Code/i, { selector: "input" }), {
        target: { value: "PROGRAM_TYPE" },
      });
      fireEvent.click(screen.getByRole("button", { name: /Create Metadata/i }));

      await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));

      // Sheet must NOT have closed on its own — close requires the parent
      // to explicitly flip `open` after a successful submit.
      expect(onOpenChange).not.toHaveBeenCalledWith(false);

      // Parent then surfaces the error string. Re-render with the error
      // prop set to mirror the production flow.
      rerender(
        <MetadataFormSheet
          open
          onOpenChange={onOpenChange}
          mode="create"
          onSubmit={onSubmit}
          error="network down"
        />
      );
      const alert = screen.getByRole("alert");
      expect(alert.textContent).toMatch(/network down/);

      // Wait for the detached rejection to surface, then confirm it was
      // ours — guards against a future code path that swallows the
      // rejection inside the form sheet (silent failure mode).
      await waitFor(() => expect(captured).toHaveLength(1));
      expect((captured[0] as Error).message).toBe("network down");
    } finally {
      process.off("unhandledRejection", onUnhandled);
    }
  });

  it("does not double-fire onSubmit when isSubmitting flips between clicks (parent gates re-entry)", async () => {
    // The form sheet has NO internal in-flight guard — it relies on the
    // parent flipping `isSubmitting` to true before the second click can
    // hit FormSheet's gated submit. This pins the current contract:
    // when the parent honors that contract, the handler fires exactly
    // once. A future regression (e.g., removing the isSubmitting gate
    // from FormSheet) would surface here.
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const { rerender } = render(
      <MetadataFormSheet
        open
        onOpenChange={vi.fn()}
        mode="create"
        onSubmit={onSubmit}
        isSubmitting={false}
      />
    );
    fireEvent.change(screen.getByLabelText(/Name/i, { selector: "input" }), {
      target: { value: "Race" },
    });
    fireEvent.change(screen.getByLabelText(/Type Code/i, { selector: "input" }), {
      target: { value: "PROGRAM_TYPE" },
    });

    const submitButton = screen.getByRole("button", { name: /Create Metadata/i });
    fireEvent.click(submitButton);

    // Parent flips isSubmitting to true synchronously (mirror useMutation).
    rerender(
      <MetadataFormSheet
        open
        onOpenChange={vi.fn()}
        mode="create"
        onSubmit={onSubmit}
        isSubmitting
      />
    );

    // Second click — FormSheet's handleFormSubmit gates on isSubmitting
    // and short-circuits before re-invoking the parent handler. Button is
    // also disabled (defense in depth).
    const gatedButton = screen.getByRole("button", { name: /Create Metadata/i });
    expect((gatedButton as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(gatedButton);

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
  });
});

// ─────────────────────────────────────────────────────────────────────────
// U7 / R10 — sub-type create. A Location, Item, or Data Type entry carries
// fields the base metadata shape has no room for, and they only reach the
// API if the category travels with the payload.
// ─────────────────────────────────────────────────────────────────────────

function setType(code: string, category: MetadataTypeCategory) {
  typeCategories.set(code, category);
}

function chooseType(code: string) {
  fireEvent.change(screen.getByLabelText(/Type Code/i, { selector: "input" }), {
    target: { value: code },
  });
}

function fillName(value: string) {
  fireEvent.change(screen.getByLabelText(/Name/i, { selector: "input" }), {
    target: { value },
  });
}

function submit() {
  fireEvent.click(screen.getByRole("button", { name: /Create Metadata/i }));
}

describe("[audit] L3 — MetadataFormSheet sub-type create (U7/R10)", () => {
  it("presents address and coordinate fields for a LOCATION type and submits them", async () => {
    setType("STORE_LOCATION", "LOCATION");
    const user = userEvent.setup();
    const { onSubmit } = renderSheet();
    chooseType("STORE_LOCATION");

    expect(screen.getByLabelText(/^Address \*$/, { selector: "input" })).toBeInTheDocument();
    expect(screen.getByLabelText(/Latitude/i, { selector: "input" })).toBeInTheDocument();
    expect(screen.getByLabelText(/Longitude/i, { selector: "input" })).toBeInTheDocument();

    fillName("Cafe HQ");
    fireEvent.change(screen.getByLabelText(/^Address \*$/, { selector: "input" }), {
      target: { value: "500 Mission St" },
    });
    fireEvent.change(screen.getByLabelText(/^City$/i, { selector: "input" }), {
      target: { value: "San Francisco" },
    });
    fireEvent.change(screen.getByLabelText(/Latitude/i, { selector: "input" }), {
      target: { value: "37.7887" },
    });
    fireEvent.change(screen.getByLabelText(/Longitude/i, { selector: "input" }), {
      target: { value: "-122.3969" },
    });
    await user.click(await screen.findByRole("combobox", { name: /Country/i }));
    await user.click(screen.getByRole("option", { name: "United States" }));

    submit();

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({
      code: "cafe-hq",
      typeCode: "STORE_LOCATION",
      addressLine1: "500 Mission St",
      cityLocality: "San Francisco",
      countryCode: "US",
      coordinates: { latitude: 37.7887, longitude: -122.3969 },
    });
    expect(onSubmit.mock.calls[0]?.[1]).toBe("LOCATION");
  });

  it("presents SKU and UPC fields for an ITEM type and submits them", async () => {
    setType("PRODUCT", "ITEM");
    const { onSubmit } = renderSheet();
    chooseType("PRODUCT");

    fillName("Latte");
    fireEvent.change(screen.getByLabelText(/Item Variant ID/i, { selector: "input" }), {
      target: { value: "SKU-001-12OZ" },
    });
    fireEvent.change(screen.getByLabelText(/^SKU$/i, { selector: "input" }), {
      target: { value: "SKU-001" },
    });
    fireEvent.change(screen.getByLabelText(/^UPC$/i, { selector: "input" }), {
      target: { value: "012345678905" },
    });

    submit();

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({
      itemVariantId: "SKU-001-12OZ",
      sku: "SKU-001",
      upc: "012345678905",
    });
    expect(onSubmit.mock.calls[0]?.[1]).toBe("ITEM");
  });

  it("presents the data-model field for a DATA_TYPE type and submits it", async () => {
    setType("RECEIPT_TYPE", "DATA_TYPE");
    const user = userEvent.setup();
    const { onSubmit } = renderSheet();
    chooseType("RECEIPT_TYPE");

    fillName("Receipt");
    await user.click(await screen.findByRole("combobox", { name: /Data Model Type/i }));
    await user.click(screen.getByRole("option", { name: /Receipt Model/i }));

    submit();

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({ dataModelCode: "RECEIPT" });
    expect(onSubmit.mock.calls[0]?.[1]).toBe("DATA_TYPE");
  });

  it("presents no sub-type fields for a plain METADATA type", () => {
    setType("PROGRAM_TYPE", "METADATA");
    renderSheet();
    chooseType("PROGRAM_TYPE");

    expect(document.querySelector("#metadata-address1")).toBeNull();
    expect(document.querySelector("#metadata-variant")).toBeNull();
    expect(document.querySelector("#metadata-datamodel")).toBeNull();
  });

  it("rejects a LOCATION submission missing its required address", async () => {
    setType("STORE_LOCATION", "LOCATION");
    const { onSubmit } = renderSheet();
    chooseType("STORE_LOCATION");
    fillName("No Address");

    submit();

    await waitFor(() => expect(screen.getByText("Address is required")).toBeInTheDocument());
    expect(screen.getByText("Country is required")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("rejects a half-filled coordinate pair rather than dropping it silently", async () => {
    setType("STORE_LOCATION", "LOCATION");
    const user = userEvent.setup();
    const { onSubmit } = renderSheet();
    chooseType("STORE_LOCATION");
    fillName("Half Coordinates");
    fireEvent.change(screen.getByLabelText(/^Address \*$/, { selector: "input" }), {
      target: { value: "500 Mission St" },
    });
    await user.click(await screen.findByRole("combobox", { name: /Country/i }));
    await user.click(screen.getByRole("option", { name: "United States" }));
    fireEvent.change(screen.getByLabelText(/Latitude/i, { selector: "input" }), {
      target: { value: "37.7887" },
    });

    submit();

    await waitFor(() =>
      expect(screen.getByText("Longitude is required when latitude is set")).toBeInTheDocument()
    );
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits a description typed as text as a localized map alongside sub-type fields", async () => {
    setType("PRODUCT", "ITEM");
    const { onSubmit } = renderSheet();
    chooseType("PRODUCT");
    fillName("Latte");
    fireEvent.change(screen.getByLabelText(/Item Variant ID/i, { selector: "input" }), {
      target: { value: "SKU-001-12OZ" },
    });
    fireEvent.change(screen.getByLabelText(/^Description$/i, { selector: "textarea" }), {
      target: { value: "House latte" },
    });

    submit();

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const payload = onSubmit.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload.description).toEqual({ en: "House latte" });
  });

  it("clears sub-type values when the type changes to another category", async () => {
    setType("STORE_LOCATION", "LOCATION");
    setType("PRODUCT", "ITEM");
    const { onSubmit } = renderSheet();
    chooseType("STORE_LOCATION");
    fireEvent.change(screen.getByLabelText(/^Address \*$/, { selector: "input" }), {
      target: { value: "500 Mission St" },
    });

    chooseType("PRODUCT");
    fillName("Latte");
    fireEvent.change(screen.getByLabelText(/Item Variant ID/i, { selector: "input" }), {
      target: { value: "SKU-001-12OZ" },
    });

    submit();

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0]?.[0]).not.toHaveProperty("addressLine1");
  });

  it("refuses to submit while no metadata type is chosen, rather than guessing METADATA", async () => {
    const { onSubmit } = renderSheet();
    fillName("Orphan");

    submit();

    await waitFor(() =>
      expect(screen.getByText("Select a metadata type before saving.")).toBeInTheDocument()
    );
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────
// U8 / R11 — sub-type edit. An existing Location, Item, or Data Type entry
// opens with its own stored fields, and a change to them reaches the submit
// handler. KTD16 (which id the write is addressed by) is the consumer's
// half and is asserted in the Hub dispatch suite.
// ─────────────────────────────────────────────────────────────────────────

const STORED_LOCATION: Location = {
  metadataId: "meta_0000000000000000000000000000a001",
  locationId: "loca_0000000000000000000000000000b001",
  code: "cafe-hq",
  name: "Café HQ",
  typeCode: "STORE_LOCATION",
  addressLine1: "500 Mission St",
  addressLine2: "Suite 200",
  cityLocality: "San Francisco",
  stateProvinceRegion: "CA",
  postalCode: "94105",
  country: {
    metadataId: "meta_0000000000000000000000000000c001",
    code: "US",
    name: "United States",
    typeCode: "COUNTRY",
    alpha3Code: "USA",
  },
  coordinates: { latitude: 37.7887, longitude: -122.3969 },
};

const STORED_ITEM: Item = {
  metadataId: "meta_0000000000000000000000000000a002",
  itemId: "item_0000000000000000000000000000b002",
  code: "latte",
  name: "Latte",
  typeCode: "PRODUCT",
  itemVariantId: "SKU-001-12OZ",
  sku: "SKU-001",
  upc: "012345678905",
};

function saveChanges() {
  fireEvent.click(screen.getByRole("button", { name: /Save Changes/i }));
}

function addressInput() {
  return screen.getByLabelText(/^Address \*$/, { selector: "input" }) as HTMLInputElement;
}

describe("[audit] L3 — MetadataFormSheet sub-type edit (U8/R11)", () => {
  it("opens a Location entry with its stored address and coordinates and saves a change", async () => {
    setType("STORE_LOCATION", "LOCATION");
    const { onSubmit } = renderSheet({ mode: "edit", initialData: STORED_LOCATION });

    expect(addressInput().value).toBe("500 Mission St");
    expect(
      (screen.getByLabelText(/^Address Line 2$/i, { selector: "input" }) as HTMLInputElement).value
    ).toBe("Suite 200");
    expect(
      (screen.getByLabelText(/^City$/i, { selector: "input" }) as HTMLInputElement).value
    ).toBe("San Francisco");
    expect(
      (screen.getByLabelText(/Latitude/i, { selector: "input" }) as HTMLInputElement).value
    ).toBe("37.7887");
    expect(
      (screen.getByLabelText(/Longitude/i, { selector: "input" }) as HTMLInputElement).value
    ).toBe("-122.3969");

    fireEvent.change(addressInput(), { target: { value: "1 Market St" } });
    saveChanges();

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({
      code: "cafe-hq",
      typeCode: "STORE_LOCATION",
      addressLine1: "1 Market St",
      cityLocality: "San Francisco",
      postalCode: "94105",
      // Seeded from the entry's `country` object — the update body takes a code.
      countryCode: "US",
      coordinates: { latitude: 37.7887, longitude: -122.3969 },
    });
    expect(onSubmit.mock.calls[0]?.[1]).toBe("LOCATION");
  });

  it("opens an Item entry with its stored SKU and UPC and saves a change", async () => {
    setType("PRODUCT", "ITEM");
    const { onSubmit } = renderSheet({ mode: "edit", initialData: STORED_ITEM });

    const sku = screen.getByLabelText(/^SKU$/i, { selector: "input" }) as HTMLInputElement;
    expect(sku.value).toBe("SKU-001");
    expect((screen.getByLabelText(/^UPC$/i, { selector: "input" }) as HTMLInputElement).value).toBe(
      "012345678905"
    );
    expect(
      (screen.getByLabelText(/Item Variant ID/i, { selector: "input" }) as HTMLInputElement).value
    ).toBe("SKU-001-12OZ");

    fireEvent.change(sku, { target: { value: "SKU-002" } });
    saveChanges();

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({
      code: "latte",
      itemVariantId: "SKU-001-12OZ",
      sku: "SKU-002",
      upc: "012345678905",
    });
    expect(onSubmit.mock.calls[0]?.[1]).toBe("ITEM");
  });

  it("keeps the code field locked while editing a sub-type entry", () => {
    setType("STORE_LOCATION", "LOCATION");
    renderSheet({ mode: "edit", initialData: STORED_LOCATION });

    const code = screen.getByLabelText(/^Code/i, { selector: "input" }) as HTMLInputElement;
    expect(code.value).toBe("cafe-hq");
    expect(code.disabled).toBe(true);
  });

  it("submits a cleared optional sub-type field as cleared, not as its stored value", async () => {
    setType("PRODUCT", "ITEM");
    const { onSubmit } = renderSheet({ mode: "edit", initialData: STORED_ITEM });

    fireEvent.change(screen.getByLabelText(/^UPC$/i, { selector: "input" }), {
      target: { value: "" },
    });
    saveChanges();

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const payload = onSubmit.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload.upc).toBeUndefined();
    expect(payload.sku).toBe("SKU-001");
  });

  it("keeps entered sub-type values when the update fails", async () => {
    // The rejection reaches the detached promise the submit handler awaits,
    // so Node sees an unhandled rejection. Capture it for the test's duration
    // and assert it was ours — a swallowed rejection is a silent failure.
    const captured: unknown[] = [];
    const onUnhandled = (reason: unknown) => {
      captured.push(reason);
    };
    process.on("unhandledRejection", onUnhandled);

    try {
      setType("STORE_LOCATION", "LOCATION");
      const onSubmit = vi.fn().mockRejectedValue(new Error("update rejected"));
      const onOpenChange = vi.fn();
      const { rerender } = render(
        <MetadataFormSheet
          open
          onOpenChange={onOpenChange}
          mode="edit"
          initialData={STORED_LOCATION}
          onSubmit={onSubmit}
        />
      );

      fireEvent.change(addressInput(), { target: { value: "1 Market St" } });
      saveChanges();
      await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));

      expect(onOpenChange).not.toHaveBeenCalledWith(false);

      rerender(
        <MetadataFormSheet
          open
          onOpenChange={onOpenChange}
          mode="edit"
          initialData={STORED_LOCATION}
          onSubmit={onSubmit}
          error="update rejected"
        />
      );

      expect(screen.getByRole("alert").textContent).toMatch(/update rejected/);
      // The entered value must survive the failure — retyping the address is
      // the difference between a retry and re-entering the whole form.
      expect(addressInput().value).toBe("1 Market St");

      await waitFor(() => expect(captured).toHaveLength(1));
      expect((captured[0] as Error).message).toBe("update rejected");
    } finally {
      process.off("unhandledRejection", onUnhandled);
    }
  });

  it("leaves a plain metadata entry's edit behavior unchanged — no sub-type fields, no sub-type payload", async () => {
    setType("PROGRAM_TYPE", "METADATA");
    const initial: DataType = {
      metadataId: "meta_0000000000000000000000000000a003",
      dataTypeId: "dtyp_0000000000000000000000000000b003",
      code: "premium",
      name: "Premium",
      typeCode: "PROGRAM_TYPE",
    };
    const { onSubmit } = renderSheet({ mode: "edit", initialData: initial });

    expect(document.querySelector("#metadata-address1")).toBeNull();
    expect(document.querySelector("#metadata-variant")).toBeNull();
    expect(document.querySelector("#metadata-datamodel")).toBeNull();

    saveChanges();

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const payload = onSubmit.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload).toMatchObject({ code: "premium", name: "Premium", typeCode: "PROGRAM_TYPE" });
    expect(payload).not.toHaveProperty("addressLine1");
    expect(payload).not.toHaveProperty("sku");
    expect(payload).not.toHaveProperty("dataModelCode");
    expect(onSubmit.mock.calls[0]?.[1]).toBe("METADATA");
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Round-trip preservation. `PUT /locations/{id}` and its Item/Data Type
// siblings REPLACE the resource — a field the body omits is destroyed, not
// left alone. Several `Update*` fields have no input in this form
// (addressLine3/4, operatingHours, searchDescriptions, dateTimePeriod), so
// they have to survive an edit untouched.
// ─────────────────────────────────────────────────────────────────────────

const LOCATION_OPERATING_HOURS = {
  timeZone: "America/Los_Angeles",
  schedule: {
    MONDAY: { openTime: "07:00", closeTime: "19:00" },
    SATURDAY: { openTime: "08:00", closeTime: "14:00" },
  },
};

const VALIDITY_PERIOD = {
  startDateTime: "2026-01-01T00:00:00",
  endDateTime: "2026-12-31T23:59:59",
};

const STORED_LOCATION_FULL: Location = {
  ...STORED_LOCATION,
  addressLine3: "Building C",
  addressLine4: "Dock 7",
  operatingHours: LOCATION_OPERATING_HOURS,
  dateTimePeriod: VALIDITY_PERIOD,
};

const STORED_ITEM_FULL: Item = {
  ...STORED_ITEM,
  searchDescriptions: ["espresso", "hot drink"],
  dateTimePeriod: VALIDITY_PERIOD,
};

describe("[audit] L3 — MetadataFormSheet preserves fields it does not render", () => {
  it("keeps a Location's addressLine3/4, operating hours, and validity period when only the address changes", async () => {
    setType("STORE_LOCATION", "LOCATION");
    const { onSubmit } = renderSheet({ mode: "edit", initialData: STORED_LOCATION_FULL });

    fireEvent.change(addressInput(), { target: { value: "1 Market St" } });
    saveChanges();

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const payload = onSubmit.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload.addressLine1).toBe("1 Market St");
    expect(payload.addressLine3).toBe("Building C");
    expect(payload.addressLine4).toBe("Dock 7");
    expect(payload.operatingHours).toEqual(LOCATION_OPERATING_HOURS);
    expect(payload.dateTimePeriod).toEqual(VALIDITY_PERIOD);
  });

  it("keeps an Item's searchDescriptions and validity period when only the SKU changes", async () => {
    setType("PRODUCT", "ITEM");
    const { onSubmit } = renderSheet({ mode: "edit", initialData: STORED_ITEM_FULL });

    fireEvent.change(screen.getByLabelText(/^SKU$/i, { selector: "input" }), {
      target: { value: "SKU-002" },
    });
    saveChanges();

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const payload = onSubmit.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload.sku).toBe("SKU-002");
    expect(payload.searchDescriptions).toEqual(["espresso", "hot drink"]);
    expect(payload.dateTimePeriod).toEqual(VALIDITY_PERIOD);
  });

  it("keeps a stored legacy parentCode through an edit", async () => {
    setType("RECEIPT_TYPE", "DATA_TYPE");
    const stored: DataType = {
      metadataId: "meta_0000000000000000000000000000a005",
      dataTypeId: "dtyp_0000000000000000000000000000b005",
      code: "receipt",
      name: "Receipt",
      typeCode: "RECEIPT_TYPE",
      dataModelCode: "RECEIPT",
      parentCode: "LEGACY_PARENT",
    };
    const { onSubmit } = renderSheet({ mode: "edit", initialData: stored });

    fillName("Receipt v2");
    saveChanges();

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const payload = onSubmit.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload.parentCode).toBe("LEGACY_PARENT");
  });

  it("keeps a Data Type entry's validity period through an edit", async () => {
    setType("RECEIPT_TYPE", "DATA_TYPE");
    const stored: DataType = {
      metadataId: "meta_0000000000000000000000000000a004",
      dataTypeId: "dtyp_0000000000000000000000000000b004",
      code: "receipt",
      name: "Receipt",
      typeCode: "RECEIPT_TYPE",
      dataModelCode: "RECEIPT",
      dateTimePeriod: VALIDITY_PERIOD,
    };
    const { onSubmit } = renderSheet({ mode: "edit", initialData: stored });

    fillName("Receipt v2");
    saveChanges();

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const payload = onSubmit.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload.name).toBe("Receipt v2");
    expect(payload.dataModelCode).toBe("RECEIPT");
    expect(payload.dateTimePeriod).toEqual(VALIDITY_PERIOD);
  });

  it("keeps a plain metadata entry's validity period through an edit", async () => {
    setType("PROGRAM_TYPE", "METADATA");
    const stored: DataType = {
      metadataId: "meta_0000000000000000000000000000a005",
      dataTypeId: "dtyp_0000000000000000000000000000b005",
      code: "premium",
      name: "Premium",
      typeCode: "PROGRAM_TYPE",
      dateTimePeriod: VALIDITY_PERIOD,
    };
    const { onSubmit } = renderSheet({ mode: "edit", initialData: stored });

    fillName("Premium Plus");
    saveChanges();

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const payload = onSubmit.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload.name).toBe("Premium Plus");
    expect(payload.dateTimePeriod).toEqual(VALIDITY_PERIOD);
  });

  it("emits no preserved keys when creating, where there is nothing to preserve", async () => {
    setType("STORE_LOCATION", "LOCATION");
    const user = userEvent.setup();
    const { onSubmit } = renderSheet();
    chooseType("STORE_LOCATION");
    fillName("New Store");

    fireEvent.change(addressInput(), { target: { value: "1 Market St" } });
    await user.click(await screen.findByRole("combobox", { name: /Country/i }));
    await user.click(screen.getByRole("option", { name: "United States" }));
    submit();

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const payload = onSubmit.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload).not.toHaveProperty("addressLine3");
    expect(payload).not.toHaveProperty("addressLine4");
    expect(payload).not.toHaveProperty("operatingHours");
    expect(payload).not.toHaveProperty("dateTimePeriod");
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Unresolvable type code. A 404'd type can never resolve a category, and the
// type field is disabled in edit mode — so "pick a type" would point the user
// at a control they cannot touch.
// ─────────────────────────────────────────────────────────────────────────

describe("[audit] L3 — MetadataFormSheet unresolvable metadata type", () => {
  it("says the type could not be found when its lookup 404s, not 'select a type'", async () => {
    missingTypes.add("DELETED_TYPE");
    const stored: DataType = {
      metadataId: "meta_0000000000000000000000000000a006",
      dataTypeId: "dtyp_0000000000000000000000000000b006",
      code: "orphan",
      name: "Orphan",
      typeCode: "DELETED_TYPE",
    };
    const { onSubmit } = renderSheet({ mode: "edit", initialData: stored });

    saveChanges();

    await waitFor(() =>
      expect(screen.getByText("This metadata type could not be found.")).toBeInTheDocument()
    );
    expect(screen.queryByText("Select a metadata type before saving.")).toBeNull();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Submit contract. MetadataFormSheet is a public @loom-loyalty/ui export, and
// `category` is what routes a LOCATION/ITEM/DATA_TYPE body to its own endpoint
// — the base /metadata endpoint accepts such a body and silently drops the
// sub-type fields. TypeScript's fewer-parameters rule means a handler that
// ignores `category` still compiles, so this pins the shape the sheet passes:
// if the second parameter is ever dropped or narrowed, `pnpm type-check` fails
// here instead of the loss surfacing as missing address fields in production.
// ─────────────────────────────────────────────────────────────────────────

describe("[audit] MetadataFormSheet submit callback type contract", () => {
  // Compile-time only — expectTypeOf is erased at runtime, so `type-check` is
  // the gate, not this suite's green run.
  it("onSubmit carries the category second and the chosen parents third", () => {
    expectTypeOf<MetadataFormSheetProps["onSubmit"]>().parameters.toEqualTypeOf<
      [MetadataSubmitData, MetadataTypeCategory, Record<string, string>]
    >();
  });

  it("onSubmit returns a Promise the sheet can await", () => {
    expectTypeOf<MetadataFormSheetProps["onSubmit"]>().returns.toEqualTypeOf<Promise<void>>();
  });
});
