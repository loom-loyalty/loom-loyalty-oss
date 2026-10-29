/**
 * METADATA cross-entity consumer probes (C6).
 *
 * Verifies that the canonical MetadataField compound is reused correctly by
 * the two highest-traffic consumers — OfferFormSheet (METADATA-typeReference
 * extension fields via EntityField dispatch) and CurrencyFormSheet
 * (currencyTypeCode mount with typeCode="CURRENCY_TYPE"). Closes the L1
 * ★★→★★★ gap left by the METADATA pilot.
 */

import type { UIEntitySchema } from "@loom-loyalty/schema";
import type * as LoomSdk from "@loom-loyalty/sdk";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

function withQueryClient(ui: ReactNode): ReactNode {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{ui}</QueryClientProvider>;
}

vi.mock("../../../forms/metadata-field/index.js", () => ({
  MetadataField: ({
    id,
    typeCode,
    value,
    onValueChange,
    typeLabel: _typeLabel,
    showCreateNew: _showCreateNew,
    showDescriptions: _showDescriptions,
    onOptionChange: _onOptionChange,
    ...rest
  }: {
    id?: string;
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
      <input id={id} type="text" readOnly value={value.join(",")} />
      <button
        type="button"
        disabled={disabled}
        onClick={() => onValueChange([...value, "prog_550e8400e29b41d4a716446655440000"])}
      >
        Add Program
      </button>
    </div>
  ),
  useProgramField: () => ({
    createProgram: vi.fn(),
    isCreating: false,
  }),
}));

vi.mock("../../../forms/duration-period-builder.js", () => ({
  DurationPeriodBuilder: ({ label }: { label?: string }) => (
    <div data-mock="duration-period-builder">{label}</div>
  ),
}));

// CurrencyFormSheet's pending/expiry rule dropdowns read two SDK list
// fetchers. Stub them to a stable empty page so the component mounts hermetically.
vi.mock("@loom-loyalty/sdk", async () => {
  const actual = await vi.importActual<typeof LoomSdk>("@loom-loyalty/sdk");
  const emptyPage = () =>
    Promise.resolve({ data: { content: [], pageNumber: 0, totalPages: 1 }, status: 200 });
  return {
    ...actual,
    programBankManagementListPendingRules: emptyPage,
    programBankManagementListExpiryRules: emptyPage,
  };
});

import { MetadataCreateSheet } from "../../../forms/metadata-create-sheet.js";
import { CurrencyFormSheet } from "../currencies/currency-form-sheet.js";
import { OfferFormSheet } from "../offers/offer-form-sheet.js";

// Minimal UIEntitySchema with one METADATA-typeReference extension field.
// The ExtendedFieldsSection delegates to EntityField, which dispatches
// widget="metadata-select" to the MetadataField compound.
function makeOfferSchemaWithMetadataExtension(): UIEntitySchema {
  return {
    entityCode: "OFFER",
    singularName: "Offer",
    pluralName: "Offers",
    fields: {
      riskCategory: {
        name: "riskCategory",
        label: "Risk Category",
        widget: "metadata-select",
        displayFormat: "text",
        showInList: false,
        showInDetail: true,
        showInCreate: true,
        showInEdit: true,
        metadataType: "OFFER_RISK_CATEGORY",
      },
    },
    list: { columns: [] },
    detail: { groups: [] },
    create: { groups: [] },
    edit: { groups: [] },
    canCreate: true,
    canEdit: true,
    canDelete: true,
  };
}

describe("[audit] L1 Direction A — METADATA cross-entity consumer probes (C6)", () => {
  it("OfferFormSheet mounts MetadataField for a METADATA-typeReference extension field", () => {
    const schema = makeOfferSchemaWithMetadataExtension();
    render(
      withQueryClient(
        <OfferFormSheet
          open
          onOpenChange={vi.fn()}
          mode="create"
          onSubmit={vi.fn().mockResolvedValue(undefined)}
          schema={schema}
          extendedFields={["riskCategory"]}
        />
      )
    );

    // FormSheet portals contents to document.body via Radix Dialog. The
    // extension field's MetadataField mount carries data-metadata-type
    // matching the schema typeReference; assert the OFFER_RISK_CATEGORY
    // mount specifically so we don't depend on which other MetadataField
    // mounts the form has (OfferFormSheet's COUPON-gated discountCurrencyType
    // also uses MetadataField).
    const widget = document.body.querySelector(
      '[data-widget="metadata-select"][data-metadata-type="OFFER_RISK_CATEGORY"]'
    );
    expect(widget).not.toBeNull();
    // Resolving by accessible label proves the ExtendedFieldsSection →
    // EntityField → MetadataField dispatch chain wires the <Label htmlFor>
    // → <input id> binding (WCAG 1.3.1) and avoids depending on
    // EntityField's internal id-naming scheme.
    expect(screen.getByLabelText(/Risk Category/i)).toBe(widget);
  });

  it("CurrencyFormSheet mounts MetadataField with typeCode='CURRENCY_TYPE' for currencyTypeCode", () => {
    render(
      withQueryClient(
        <CurrencyFormSheet
          open
          onOpenChange={vi.fn()}
          mode="create"
          onSubmit={vi.fn().mockResolvedValue(undefined)}
        />
      )
    );

    const widget = document.body.querySelector('[data-widget="metadata-select"]');
    expect(widget).not.toBeNull();
    expect(widget?.getAttribute("data-metadata-type")).toBe("CURRENCY_TYPE");
  });
});

// ─────────────────────────────────────────────────────────────────────────
// U7 — the embedded picker's create sheet after the sub-type field lift.
// MetadataCreateSheet now renders the shared MetadataSubTypeFields instead
// of its own category branches; these probes pin that its behavior is
// unchanged for every category it already supported.
// ─────────────────────────────────────────────────────────────────────────

describe("[audit] U7 — MetadataCreateSheet still drives the shared sub-type fields", () => {
  it("renders the LOCATION branch and submits its address fields", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(
      <MetadataCreateSheet
        open
        onOpenChange={vi.fn()}
        typeCode="STORE_LOCATION"
        typeLabel="Store Location"
        category="LOCATION"
        countryOptions={[{ code: "US", name: "United States" }]}
        onSubmit={onSubmit}
      />
    );

    fireEvent.change(screen.getByLabelText(/^Name \*$/), { target: { value: "Cafe HQ" } });
    fireEvent.change(screen.getByLabelText(/^Address \*$/), {
      target: { value: "500 Mission St" },
    });
    await user.click(screen.getByRole("combobox", { name: /Country/i }));
    await user.click(screen.getByRole("option", { name: "United States" }));

    fireEvent.click(screen.getByRole("button", { name: /Add Store Location/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({
      typeCode: "STORE_LOCATION",
      code: "cafe-hq",
      name: "Cafe HQ",
      addressLine1: "500 Mission St",
      countryCode: "US",
    });
  });

  it("blocks an ITEM submission missing its required variant id", async () => {
    const onSubmit = vi.fn();
    render(
      <MetadataCreateSheet
        open
        onOpenChange={vi.fn()}
        typeCode="PRODUCT"
        typeLabel="Product"
        category="ITEM"
        onSubmit={onSubmit}
      />
    );

    fireEvent.change(screen.getByLabelText(/^Name \*$/), { target: { value: "Latte" } });
    fireEvent.click(screen.getByRole("button", { name: /Add Product/i }));

    await waitFor(() =>
      expect(screen.getByText("Item variant ID is required")).toBeInTheDocument()
    );
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("renders no sub-type fields for the default METADATA category", () => {
    render(
      <MetadataCreateSheet
        open
        onOpenChange={vi.fn()}
        typeCode="PROGRAM_TYPE"
        typeLabel="Program Type"
        onSubmit={vi.fn()}
      />
    );

    expect(document.querySelector("#metadata-address1")).toBeNull();
    expect(document.querySelector("#metadata-variant")).toBeNull();
    expect(document.querySelector("#metadata-datamodel")).toBeNull();
  });
});

describe("[audit] U7 — MetadataSubTypeFields explains an unselectable required field", () => {
  it("says why the country select is empty instead of leaving a dead dropdown", () => {
    render(
      <MetadataCreateSheet
        open
        onOpenChange={vi.fn()}
        typeCode="STORE_LOCATION"
        typeLabel="Store Location"
        category="LOCATION"
        countryOptions={[]}
        onSubmit={vi.fn()}
      />
    );

    expect(
      screen.getByText("No countries are configured. Add COUNTRY metadata values first.")
    ).toBeInTheDocument();
  });
});
