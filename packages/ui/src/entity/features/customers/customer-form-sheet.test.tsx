/**
 * CustomerFormSheet audit suite (L1 widget mapping + L3 behavior).
 *
 * CUSTOMER's polymorphism is STRUCTURAL, not a tagged `type` field: a
 * ToggleGroup (`identityType`: individual | corporate) chooses which identity
 * block renders, and the submit payload carries EITHER `identity` OR
 * `corporateIdentity`. `identityType` is never sent and is disabled in edit
 * mode. Direction C pins this discriminator-gated rendering.
 *
 * `MetadataField` + `useMetadataField` are mocked because they pull the SDK +
 * react-query at import time (status, fraud status, enrollment, gender all
 * mount). The mock forwards the caller-provided `id` so `<Label htmlFor>`
 * binding stays honest for the WCAG 1.3.1 assertions. `CodeInput`, `Input`,
 * `Label`, and `ToggleGroup` are pure and mount for real.
 *
 * L2 (audit-side Zod schema) lives in customer-form-sheet.schema.test.ts.
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Hoisted mutable state so individual tests can flip the isSuggested flag fired
// by MetadataField's onValueChange + override the useMetadataField return shape.
// vi.mock factories are hoisted; use vi.hoisted to share state with them.
const metadataFieldMock = vi.hoisted(() => ({
  fireAsSuggested: false as boolean,
  hookReturn: {
    category: undefined as string | undefined,
    isTypeNotFound: false as boolean,
    findOption: ((_code: string) => undefined) as (code: string) => unknown,
    createMetadata: vi.fn<(data: unknown) => Promise<void>>().mockResolvedValue(undefined),
  },
}));

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
  useMetadataField: () => metadataFieldMock.hookReturn,
}));

beforeEach(() => {
  metadataFieldMock.fireAsSuggested = false;
  metadataFieldMock.hookReturn = {
    category: undefined,
    isTypeNotFound: false,
    findOption: () => undefined,
    createMetadata: vi.fn<(data: unknown) => Promise<void>>().mockResolvedValue(undefined),
  };
});

import { CustomerFormSheet } from "./customer-form-sheet.js";
import type { CustomerFormSheetProps } from "./types.js";

function renderSheet(overrides: Partial<CustomerFormSheetProps> = {}) {
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  const onOpenChange = vi.fn();
  const result = render(
    <CustomerFormSheet
      open
      onOpenChange={onOpenChange}
      mode="create"
      onSubmit={onSubmit}
      {...overrides}
    />
  );
  return { ...result, onSubmit, onOpenChange };
}

/** ToggleGroupItem renders as role="radio" inside the single-select group. */
function toggleIdentity(name: RegExp) {
  fireEvent.click(screen.getByRole("radio", { name }));
}

// ─────────────────────────────────────────────────────────────────────────
// L1 — Direction A: every individual-block + always-rendered field renders
// the widget the form currently mounts. id + data-widget attrs resolved in
// this audit; the 3 status MetadataFields now bind via <Label htmlFor>.
// ─────────────────────────────────────────────────────────────────────────

describe("[audit] L1 Direction A — CustomerFormSheet base field widgets (current state)", () => {
  it("renders firstName as Input[type=text] with data-widget='text-input' and id='customer-first-name'", () => {
    renderSheet();
    const input = screen.getByLabelText(/First Name/i, { selector: "input" });
    expect(input.id).toBe("customer-first-name");
    expect(input.tagName).toBe("INPUT");
    expect(input.getAttribute("type")).toBe("text");
    expect(input.getAttribute("data-widget")).toBe("text-input");
    expect((input as HTMLInputElement).required).toBe(true);
  });

  it("renders middleName as Input[type=text] with data-widget='text-input'", () => {
    renderSheet();
    const input = screen.getByLabelText(/Middle Name/i, { selector: "input" }) as HTMLInputElement;
    expect(input.id).toBe("customer-middle-name");
    expect(input.getAttribute("type")).toBe("text");
    expect(input.getAttribute("data-widget")).toBe("text-input");
  });

  it("renders lastName as Input[type=text] with data-widget='text-input'", () => {
    renderSheet();
    const input = screen.getByLabelText(/Last Name/i, { selector: "input" }) as HTMLInputElement;
    expect(input.id).toBe("customer-last-name");
    expect(input.getAttribute("type")).toBe("text");
    expect(input.getAttribute("data-widget")).toBe("text-input");
  });

  it("renders birthDate as Input[type=date] with data-widget='text-input'", () => {
    renderSheet();
    const input = screen.getByLabelText(/Birth Date/i, { selector: "input" }) as HTMLInputElement;
    expect(input.id).toBe("customer-birth-date");
    expect(input.getAttribute("type")).toBe("date");
    expect(input.getAttribute("data-widget")).toBe("text-input");
  });

  it("renders gender via the MetadataField compound with associated label (WCAG 1.3.1)", () => {
    renderSheet();
    // getByLabelText resolves only when <Label htmlFor> binds to the forwarded
    // id — catches a regression where someone drops htmlFor on the Gender Label.
    const gender = screen.getByLabelText(/^Gender$/i);
    expect(gender.id).toBe("customer-gender");
    expect(gender.getAttribute("data-metadata-type")).toBe("GENDER");
  });

  it("renders email as Input[type=email] with data-widget='text-input'", () => {
    renderSheet();
    const input = screen.getByLabelText(/^Email$/i, { selector: "input" }) as HTMLInputElement;
    expect(input.id).toBe("customer-email");
    expect(input.getAttribute("type")).toBe("email");
    expect(input.getAttribute("data-widget")).toBe("text-input");
  });

  it("renders phone as Input[type=tel] with data-widget='text-input'", () => {
    renderSheet();
    const input = screen.getByLabelText(/^Phone$/i, { selector: "input" }) as HTMLInputElement;
    expect(input.id).toBe("customer-phone");
    expect(input.getAttribute("type")).toBe("tel");
    expect(input.getAttribute("data-widget")).toBe("text-input");
  });

  it("renders externalId as Input[type=text] with data-widget='text-input'", () => {
    renderSheet();
    const input = screen.getByLabelText(/External ID/i, { selector: "input" }) as HTMLInputElement;
    expect(input.id).toBe("customer-external-id");
    expect(input.getAttribute("type")).toBe("text");
    expect(input.getAttribute("data-widget")).toBe("text-input");
  });

  it("resolves the 3 status MetadataFields via their bound labels (label binding works now)", () => {
    renderSheet();
    // Each now carries id + a matching <label for>. Assert the DOM-level
    // for/id binding directly — proves WCAG 1.3.1 without a regex that
    // ambiguously matches both "Status" and "Fraud Status".
    const expectLabeledMetadata = (id: string, typeCode: string) => {
      const field = document.querySelector(`#${id}`);
      expect(field, `#${id} should render`).not.toBeNull();
      expect(field?.getAttribute("data-metadata-type")).toBe(typeCode);
      const label = document.querySelector(`label[for="${id}"]`);
      expect(label, `a <label for="${id}"> should bind the field`).not.toBeNull();
    };
    expectLabeledMetadata("customer-status", "CUSTOMER_STATUS");
    expectLabeledMetadata("customer-fraud-status", "CUSTOMER_FRAUD_STATUS");
    expectLabeledMetadata("customer-enrollment", "ENROLLMENT_TYPE");
  });

  it("renders the identity-type ToggleGroup with id + data-discriminator='true'", () => {
    renderSheet();
    const toggle = document.querySelector("#customer-identity-type");
    expect(toggle).not.toBeNull();
    expect(toggle?.getAttribute("data-discriminator")).toBe("true");
    expect(toggle?.getAttribute("aria-label")).toBe("Identity type");
  });

  it("does not render system fields (customerId, createdDateTime, modifiedDateTime, enrollmentDateTime)", () => {
    renderSheet();
    expect(document.querySelector("#customer-customerId")).toBeNull();
    expect(document.querySelector("#customer-createdDateTime")).toBeNull();
    expect(document.querySelector("#customer-modifiedDateTime")).toBeNull();
    expect(document.querySelector("#customer-enrollmentDateTime")).toBeNull();
  });

  it("does not render the corporate companyCode CodeInput in the default (individual) branch", () => {
    renderSheet();
    expect(document.querySelector("#customer-company-code")).toBeNull();
  });

  it("locks the corporate companyCode CodeInput in edit mode (code lock applies to corporate only)", () => {
    renderSheet({
      mode: "edit",
      initialData: {
        customerId: "cust_550e8400e29b41d4a716446655440010",
        corporateIdentity: { companyName: "Acme Corp", companyCode: "acme-corp" },
      } as never,
    });
    const codeInput = screen.getByLabelText(/Company Code/i, { selector: "input" });
    expect((codeInput as HTMLInputElement).disabled).toBe(true);
  });

  it("disables the identity-type toggle in edit mode (discriminator cannot change)", () => {
    renderSheet({
      mode: "edit",
      initialData: {
        customerId: "cust_550e8400e29b41d4a716446655440011",
        identity: { firstName: "Jane" },
      } as never,
    });
    // Radix renders disabled ToggleGroupItems as radios with data-disabled.
    const individual = screen.getByRole("radio", { name: /Individual/i });
    expect(individual.getAttribute("data-disabled")).not.toBeNull();
  });

  it("does not render an ExtendedFieldsSection without schema + extendedFields props", () => {
    renderSheet();
    expect(document.querySelector("[data-extended-section]")).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────
// L1 — Direction B: every customer-prefixed editable widget maps to a known
// field. Enumerated by id-prefix + set-equality. Default = individual branch.
// MetadataField stubs render as <input id="customer-*"> so they're included.
// ─────────────────────────────────────────────────────────────────────────

// The identity-type ToggleGroup root renders as <div role="group"> (not an
// editable tag), so it's excluded here; Direction A asserts it separately.
const CUSTOMER_EDITABLE_IDS_INDIVIDUAL = new Set([
  "customer-first-name",
  "customer-middle-name",
  "customer-last-name",
  "customer-birth-date",
  "customer-gender",
  "customer-email",
  "customer-phone",
  "customer-status",
  "customer-fraud-status",
  "customer-enrollment",
  "customer-external-id",
] as const);

const EDITABLE_TAGS = new Set(["INPUT", "SELECT", "TEXTAREA", "BUTTON"]);
function isEditableEl(el: Element): boolean {
  return EDITABLE_TAGS.has(el.tagName);
}

function customerPrefixedIds(): string[] {
  return Array.from(document.querySelectorAll("[id^='customer-']"))
    .filter(isEditableEl)
    .map((el) => el.getAttribute("id") ?? "")
    .filter((id) => id.startsWith("customer-"));
}

describe("[audit] L1 Direction B — CustomerFormSheet orphan detection", () => {
  it("every rendered customer- prefixed widget is in the known set (default individual branch)", () => {
    renderSheet();
    const ids = customerPrefixedIds();
    expect(ids.length).toBeGreaterThan(0);
    const known: ReadonlySet<string> = CUSTOMER_EDITABLE_IDS_INDIVIDUAL;
    for (const id of ids) {
      expect(known.has(id as never), `unexpected customer-prefixed id '${id}'`).toBe(true);
    }
  });

  it("renders every expected editable field — no missing widgets in the individual branch", () => {
    renderSheet();
    const ids = new Set(customerPrefixedIds());
    for (const expected of CUSTOMER_EDITABLE_IDS_INDIVIDUAL) {
      expect(ids.has(expected), `expected customer-prefixed id '${expected}' is missing`).toBe(
        true
      );
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────
// L1 — Direction C: discriminator-gated rendering. The defining audit
// assertion for polymorphic entities. CUSTOMER's discriminator is STRUCTURAL
// (a ToggleGroup, not a `type` field): individual fields present when
// identityType=individual, corporate fields present when corporate, and they
// swap when the toggle flips.
// ─────────────────────────────────────────────────────────────────────────

describe("[audit] L1 Direction C — discriminator-gated identity rendering", () => {
  it("default identityType=individual renders firstName and NOT companyName", () => {
    renderSheet();
    expect(document.querySelector("#customer-first-name")).not.toBeNull();
    expect(document.querySelector("#customer-company-name")).toBeNull();
    expect(document.querySelector("#customer-company-code")).toBeNull();
  });

  it("switching the toggle to Corporate renders companyName + companyCode and NOT firstName", () => {
    renderSheet();
    toggleIdentity(/Corporate/i);
    expect(document.querySelector("#customer-company-name")).not.toBeNull();
    expect(document.querySelector("#customer-company-code")).not.toBeNull();
    expect(document.querySelector("#customer-first-name")).toBeNull();
    expect(document.querySelector("#customer-gender")).toBeNull();
  });

  it("toggling back to Individual restores firstName and hides the corporate fields", () => {
    renderSheet();
    toggleIdentity(/Corporate/i);
    expect(document.querySelector("#customer-company-name")).not.toBeNull();

    toggleIdentity(/Individual/i);
    expect(document.querySelector("#customer-first-name")).not.toBeNull();
    expect(document.querySelector("#customer-company-name")).toBeNull();
  });

  it("edit mode on a corporate customer renders the corporate branch and disables the toggle", () => {
    renderSheet({
      mode: "edit",
      initialData: {
        customerId: "cust_550e8400e29b41d4a716446655440012",
        corporateIdentity: { companyName: "Globex", companyCode: "globex" },
      } as never,
    });
    expect(document.querySelector("#customer-company-name")).not.toBeNull();
    expect(document.querySelector("#customer-first-name")).toBeNull();
    const corporate = screen.getByRole("radio", { name: /Corporate/i });
    expect(corporate.getAttribute("data-disabled")).not.toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────
// L3 — Behavior. Form submit per identity branch, contact-array shaping,
// error surfacing, edit-mode prefill + immutable discriminator.
// ─────────────────────────────────────────────────────────────────────────

describe("[audit] L3 — CustomerFormSheet behavior", () => {
  it("submits an individual payload nesting identity.* fields + statusCode", async () => {
    const { onSubmit } = renderSheet();
    fireEvent.change(screen.getByLabelText(/First Name/i, { selector: "input" }), {
      target: { value: "Jane" },
    });
    fireEvent.change(screen.getByLabelText(/Last Name/i, { selector: "input" }), {
      target: { value: "Doe" },
    });
    fireEvent.change(document.querySelector("#customer-status") as HTMLInputElement, {
      target: { value: "ACTIVE" },
    });

    fireEvent.click(screen.getByRole("button", { name: /^Create Customer$/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));

    const payload = onSubmit.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload.identity).toMatchObject({ firstName: "Jane", lastName: "Doe" });
    expect(payload.statusCode).toBe("ACTIVE");
    // Structural discriminator: corporateIdentity must be absent on this branch.
    expect(payload).not.toHaveProperty("corporateIdentity");
    // identityType is never sent on the wire.
    expect(payload).not.toHaveProperty("identityType");
  });

  it("submits a corporate payload nesting corporateIdentity.companyName when toggled", async () => {
    const { onSubmit } = renderSheet();
    toggleIdentity(/Corporate/i);
    fireEvent.change(screen.getByLabelText(/Company Name/i, { selector: "input" }), {
      target: { value: "Acme Corporation" },
    });

    fireEvent.click(screen.getByRole("button", { name: /^Create Customer$/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));

    const payload = onSubmit.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload.corporateIdentity).toMatchObject({ companyName: "Acme Corporation" });
    expect(payload).not.toHaveProperty("identity");
    expect(payload).not.toHaveProperty("identityType");
  });

  it("wraps a filled email into the emailAddresses[{typeCode,status,primary}] array", async () => {
    const { onSubmit } = renderSheet();
    fireEvent.change(screen.getByLabelText(/First Name/i, { selector: "input" }), {
      target: { value: "Jane" },
    });
    fireEvent.change(screen.getByLabelText(/^Email$/i, { selector: "input" }), {
      target: { value: "jane@example.com" },
    });

    fireEvent.click(screen.getByRole("button", { name: /^Create Customer$/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));

    const payload = onSubmit.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload.emailAddresses).toEqual([
      { emailAddress: "jane@example.com", typeCode: "OTHER", status: "ACTIVE", primary: true },
    ]);
  });

  it("wraps a filled phone into the phoneNumbers[{typeCode,status,primary}] array", async () => {
    const { onSubmit } = renderSheet();
    fireEvent.change(screen.getByLabelText(/First Name/i, { selector: "input" }), {
      target: { value: "Jane" },
    });
    fireEvent.change(screen.getByLabelText(/^Phone$/i, { selector: "input" }), {
      target: { value: "+15551234567" },
    });

    fireEvent.click(screen.getByRole("button", { name: /^Create Customer$/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));

    const payload = onSubmit.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload.phoneNumbers).toEqual([
      { number: "+15551234567", typeCode: "OTHER", status: "ACTIVE", primary: true },
    ]);
  });

  it("omits emailAddresses / phoneNumbers when both contact fields are blank", async () => {
    const { onSubmit } = renderSheet();
    fireEvent.change(screen.getByLabelText(/First Name/i, { selector: "input" }), {
      target: { value: "Jane" },
    });

    fireEvent.click(screen.getByRole("button", { name: /^Create Customer$/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));

    const payload = onSubmit.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload).not.toHaveProperty("emailAddresses");
    expect(payload).not.toHaveProperty("phoneNumbers");
  });

  it("CUST-3 (current behavior): firstName is sent unconditionally; optional name parts coerce to undefined", async () => {
    // handleSubmit nests `firstName` into identity WITHOUT a `|| undefined`
    // guard, but middleName/lastName/birthDate/genderCode all get one. So a
    // first name with empty optional parts ships `firstName` as a string while
    // the optional parts drop to undefined — an asymmetry the audit pins.
    // (An empty firstName isn't reachable via the UI: HTML5 `required` on
    // #customer-first-name blocks the submit before handleSubmit runs.)
    const { onSubmit } = renderSheet();
    fireEvent.change(screen.getByLabelText(/First Name/i, { selector: "input" }), {
      target: { value: "Solo" },
    });

    fireEvent.click(screen.getByRole("button", { name: /^Create Customer$/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));

    const payload = onSubmit.mock.calls[0]?.[0] as Record<string, unknown>;
    const identity = payload.identity as Record<string, unknown>;
    expect(identity.firstName).toBe("Solo");
    expect(identity.middleName).toBeUndefined();
    expect(identity.lastName).toBeUndefined();
    expect(identity.birthDate).toBeUndefined();
  });

  it("surfaces the error prop in the FormSheet alert region", () => {
    renderSheet({ error: "Server returned 422 — email already exists" });
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toMatch(/Server returned 422/);
  });

  it("renders 'Save Changes' label, prefills identity, and disables the toggle in edit mode", () => {
    renderSheet({
      mode: "edit",
      initialData: {
        customerId: "cust_550e8400e29b41d4a716446655440013",
        identity: { firstName: "Existing", lastName: "Member" },
        statusCode: "ACTIVE",
      } as never,
    });
    expect(screen.getByRole("button", { name: /^Save Changes$/i })).toBeInTheDocument();
    expect(
      (screen.getByLabelText(/First Name/i, { selector: "input" }) as HTMLInputElement).value
    ).toBe("Existing");
    const individual = screen.getByRole("radio", { name: /Individual/i });
    expect(individual.getAttribute("data-disabled")).not.toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────
// L3 — auto-create suggested metadata before parent onSubmit. Pins the
// metadata-creation contract: a suggested status code fires createMetadata
// before the customer POST; a createMetadata failure aborts with a localError
// and the parent onSubmit never runs (CUSTOMER guards differ from OFFER here).
// ─────────────────────────────────────────────────────────────────────────

describe("[audit] L3 — CUSTOMER auto-create suggested metadata", () => {
  it("fires createMetadata for a suggested status code on submit, then calls onSubmit", async () => {
    metadataFieldMock.fireAsSuggested = true;
    const createSpy = vi.fn<(data: unknown) => Promise<void>>().mockResolvedValue(undefined);
    metadataFieldMock.hookReturn = {
      category: "METADATA",
      isTypeNotFound: false,
      findOption: () => undefined,
      createMetadata: createSpy,
    };

    const { onSubmit } = renderSheet();
    fireEvent.change(screen.getByLabelText(/First Name/i, { selector: "input" }), {
      target: { value: "Jane" },
    });
    fireEvent.change(document.querySelector("#customer-status") as HTMLInputElement, {
      target: { value: "vip-status" },
    });

    fireEvent.click(screen.getByRole("button", { name: /^Create Customer$/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(createSpy).toHaveBeenCalledWith({ code: "vip-status", name: "vip-status" });
  });

  it("aborts and surfaces a localError when createMetadata rejects (parent onSubmit not called)", async () => {
    metadataFieldMock.fireAsSuggested = true;
    const createSpy = vi
      .fn<(data: unknown) => Promise<void>>()
      .mockRejectedValue(new Error("BE 400"));
    metadataFieldMock.hookReturn = {
      category: "METADATA",
      isTypeNotFound: false,
      findOption: () => undefined,
      createMetadata: createSpy,
    };

    const { onSubmit } = renderSheet();
    fireEvent.change(screen.getByLabelText(/First Name/i, { selector: "input" }), {
      target: { value: "Jane" },
    });
    fireEvent.change(document.querySelector("#customer-status") as HTMLInputElement, {
      target: { value: "bad-status" },
    });

    fireEvent.click(screen.getByRole("button", { name: /^Create Customer$/i }));

    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toMatch(/Metadata creation/i)
    );
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("drops a suggested status code from the payload when its metadata type does not exist", async () => {
    metadataFieldMock.fireAsSuggested = true;
    metadataFieldMock.hookReturn = {
      category: "METADATA",
      isTypeNotFound: true,
      findOption: () => undefined,
      createMetadata: vi.fn<(data: unknown) => Promise<void>>().mockResolvedValue(undefined),
    };

    const { onSubmit } = renderSheet();
    fireEvent.change(screen.getByLabelText(/First Name/i, { selector: "input" }), {
      target: { value: "Jane" },
    });
    fireEvent.change(document.querySelector("#customer-status") as HTMLInputElement, {
      target: { value: "ghost-status" },
    });

    fireEvent.click(screen.getByRole("button", { name: /^Create Customer$/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));

    const payload = onSubmit.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload.statusCode).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Server field errors (R25, AE3): each error shows under its own control,
// keyed by the request's dotted path; the rest go to the banner.
// ─────────────────────────────────────────────────────────────────────────

describe("CustomerFormSheet server field errors", () => {
  it("shows each server field error under its own field", () => {
    renderSheet({
      error: { message: "Some fields are invalid." },
      fieldErrors: [
        { field: "identity.firstName", message: "First name is required." },
        { field: "emailAddresses[0].emailAddress", message: "Email is not valid." },
      ],
    });

    const firstName = screen.getByLabelText(/^First Name/);
    expect(firstName).toHaveAttribute("aria-invalid", "true");
    expect(firstName).toHaveAccessibleDescription("First name is required.");
    expect(screen.getByLabelText("Email")).toHaveAccessibleDescription("Email is not valid.");
  });

  it("shows the support reference of a described error", () => {
    renderSheet({ error: { message: "Something went wrong.", requestId: "req-123" } });

    expect(screen.getByText("Something went wrong.")).toBeInTheDocument();
    expect(screen.getByText(/Reference:/)).toHaveTextContent("Reference: req-123");
  });

  it("puts an error for a field the sheet does not render in the banner", () => {
    renderSheet({
      fieldErrors: [{ field: "corporateIdentity.companyName", message: "Company is required." }],
    });

    // The individual identity is showing, so the company field is not rendered.
    expect(screen.queryByLabelText(/Company Name/)).not.toBeInTheDocument();
    expect(screen.getByText("Company is required.").closest('[role="alert"]')).not.toBeNull();
  });

  it("shows a code error inside the code input when the corporate identity is chosen", () => {
    renderSheet({
      fieldErrors: [{ field: "corporateIdentity.companyCode", message: "Code is taken." }],
    });
    toggleIdentity(/Corporate/);

    const code = screen.getByLabelText("Company Code");
    expect(code).toHaveAttribute("aria-invalid", "true");
    expect(code).toHaveAccessibleDescription("Code is taken.");
  });
});
