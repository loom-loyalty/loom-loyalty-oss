/**
 * OfferFormSheet audit suite (L1 widget mapping + L3 behavior).
 *
 * L1 asserts current-state widget rendering. The form is polymorphic — `type`
 * drives whether COUPON-only fields (`maxDiscountValue`) render. Direction C
 * pins the discriminator-gated branch.
 *
 * `ProgramMultiField` is mocked because it pulls the SDK + react-query at
 * import time. `DurationPeriodBuilder` is mocked because its `date-picker`
 * dependency chains through `@loom-loyalty/core`; mocking keeps the test
 * hermetic regardless of build state. Other compound widgets (`CodeInput`,
 * `LocalizedStringInput`) are pure presentation and mount for real.
 *
 * L2 (audit-side Zod schema) lives in offer-form-sheet.schema.test.ts.
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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

vi.mock("../../../forms/customer-audience-field/index.js", () => ({
  CustomerAudienceField: ({
    id,
    value,
    onValueChange,
    disabled,
  }: {
    id?: string;
    value: string;
    onValueChange: (id: string) => void;
    disabled?: boolean;
  }) => (
    <div data-mock="customer-audience-field">
      <input id={id} type="text" readOnly value={value} />
      <button
        type="button"
        data-testid="customer-audience-field-set"
        disabled={disabled}
        onClick={() => onValueChange("aud_550e8400e29b41d4a716446655440099")}
      >
        Set Audience
      </button>
    </div>
  ),
}));

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

vi.mock("../../../forms/duration-period-builder.js", () => ({
  DurationPeriodBuilder: ({ label }: { label?: string }) => (
    <div data-mock="duration-period-builder">{label}</div>
  ),
}));

import { OfferFormSheet } from "./offer-form-sheet.js";
import type { OfferFormSheetProps } from "./types.js";

function renderSheet(overrides: Partial<OfferFormSheetProps> = {}) {
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  const onOpenChange = vi.fn();
  const result = render(
    <OfferFormSheet
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

// The "Coupon Code Source" discriminator's GENERATED option carries a
// description (unlike offer-type's COUPON/EXTERNAL options), so its
// accessible name is "<label> <description>" concatenated — match a
// substring, not an anchored `^...$` pattern.
function selectGeneratedCouponSource() {
  fireEvent.click(screen.getByRole("radio", { name: /Auto-generate a batch of codes/i }));
}

// ─────────────────────────────────────────────────────────────────────────
// L1 — Direction A: every base manifest field renders the widget that
// OfferFormSheet currently mounts. Divergence vs. playbook §11.6 is
// documented in TODOS Phase D and asserted here as current-state.
// ─────────────────────────────────────────────────────────────────────────

describe("[audit] L1 Direction A — OfferFormSheet base field widgets (current state)", () => {
  it("renders name as Input[type=text] with data-widget='text-input' and id='offer-name' (D6 resolved)", () => {
    renderSheet();
    const input = screen.getByLabelText(/^Name/i, { selector: "input" });
    expect(input.id).toBe("offer-name");
    expect(input.tagName).toBe("INPUT");
    expect(input.getAttribute("type")).toBe("text");
    expect(input.getAttribute("data-widget")).toBe("text-input");
  });

  it("renders code as a CodeInput with kebab-case auto-generation", () => {
    renderSheet();
    const input = screen.getByLabelText(/^Code/i, { selector: "input" }) as HTMLInputElement;
    expect(input.id).toBe("offer-code");
    expect(input.tagName).toBe("INPUT");
  });

  it("auto-generates code in kebab-case when name is typed", () => {
    renderSheet();
    const nameInput = screen.getByLabelText(/^Name/i, { selector: "input" });
    const codeInput = screen.getByLabelText(/^Code/i, { selector: "input" }) as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: "Summer Sale 20" } });
    expect(codeInput.value).toBe("summer-sale-20");
  });

  it("renders type as a Radix RadioGroup with COUPON/EXTERNAL options and discriminator data attributes", () => {
    renderSheet();
    const trigger = screen.getByLabelText(/^Type/i);
    expect(trigger.id).toBe("offer-type");
    expect(trigger.getAttribute("role")).toBe("radiogroup");
    expect(trigger.getAttribute("data-widget")).toBe("radio-group");
    expect(trigger.getAttribute("data-discriminator")).toBe("true");
  });

  it("renders programIds via the ProgramMultiField compound with associated label (WCAG 1.3.1)", () => {
    renderSheet();
    // getByLabelText resolves only when the <Label htmlFor> binds to a DOM
    // node — catches a regression where someone drops `htmlFor` on the
    // Programs Label or `id` on ProgramMultiField.
    const labeled = screen.getByLabelText(/Programs/i);
    expect(labeled.id).toBe("offer-programs");
    const probe = document.querySelector("[data-mock='program-multi-field']");
    expect(probe).not.toBeNull();
  });

  it("renders description via LocalizedStringInput with associated label (WCAG 1.3.1)", () => {
    renderSheet();
    // LocalizedStringInput forwards the id to its active locale input. A
    // missing `htmlFor` on the Description Label would break this lookup.
    const description = screen.getByLabelText(/^Description$/i);
    expect(description.id).toBe("offer-description");
  });

  it("renders durationPeriod via the DurationPeriodBuilder compound (mocked)", () => {
    renderSheet();
    // The mock forwards the `label` prop into a stable wrapper — this
    // asserts the form mounts the compound and passes the canonical label.
    const probe = document.querySelector("[data-mock='duration-period-builder']");
    expect(probe).not.toBeNull();
    expect(probe?.textContent).toMatch(/Duration Period/i);
  });

  it("renders maxOfferUses as Input[type=number] with data-widget='text-input' (D6 resolved)", () => {
    renderSheet();
    const input = screen.getByLabelText(/Max Offer Uses/i) as HTMLInputElement;
    expect(input.id).toBe("offer-max-uses");
    expect(input.getAttribute("type")).toBe("number");
    expect(input.getAttribute("data-widget")).toBe("text-input");
  });

  it("renders maxOfferRedemptions as Input[type=number] with data-widget='text-input' (D6 resolved)", () => {
    renderSheet();
    const input = screen.getByLabelText(/Max Offer Redemptions/i) as HTMLInputElement;
    expect(input.id).toBe("offer-max-redemptions");
    expect(input.getAttribute("type")).toBe("number");
    expect(input.getAttribute("data-widget")).toBe("text-input");
  });

  it("renders setDateTimePeriodOnIssue as a Switch with data-widget='switch' (D6 resolved)", () => {
    renderSheet();
    const switchEl = document.querySelector("#offer-set-datetime");
    expect(switchEl).not.toBeNull();
    expect(switchEl?.getAttribute("role")).toBe("switch");
    expect(switchEl?.getAttribute("data-widget")).toBe("switch");
  });

  it("does not render system fields (offerId, enabledInEnvironments, createdDateTime, modifiedDateTime)", () => {
    renderSheet();
    expect(document.querySelector("#offer-offerId")).toBeNull();
    expect(document.querySelector("#offer-enabledInEnvironments")).toBeNull();
    expect(document.querySelector("#offer-createdDateTime")).toBeNull();
    expect(document.querySelector("#offer-modifiedDateTime")).toBeNull();
  });

  it("D5 (resolved): renders customerAudience via the CustomerAudienceField compound with associated label (WCAG 1.3.1)", () => {
    renderSheet();
    // CustomerAudienceField forwards the id to its trigger — a missing
    // <Label htmlFor> would break this lookup.
    const labeled = screen.getByLabelText(/Customer Audience/i);
    expect(labeled.id).toBe("offer-customer-audience");
    const probe = document.querySelector("[data-mock='customer-audience-field']");
    expect(probe).not.toBeNull();
  });

  it("locks code input in edit mode (mode='edit' disables the field)", () => {
    renderSheet({
      mode: "edit",
      initialData: {
        offerId: "ofr_550e8400e29b41d4a716446655440010",
        code: "summer-sale",
        name: "Summer Sale",
        type: "COUPON",
        programIds: ["prog_550e8400e29b41d4a716446655440000"],
      },
    });
    const codeInput = screen.getByLabelText(/^Code/i, { selector: "input" }) as HTMLInputElement;
    expect(codeInput.disabled).toBe(true);
  });

  it("locks type selector in edit mode (discriminator cannot change)", () => {
    renderSheet({
      mode: "edit",
      initialData: {
        offerId: "ofr_550e8400e29b41d4a716446655440011",
        code: "partner-reward",
        name: "Partner Reward",
        type: "EXTERNAL",
        programIds: ["prog_550e8400e29b41d4a716446655440000"],
      },
    });
    const trigger = screen.getByLabelText(/^Type/i);
    expect(trigger.getAttribute("data-disabled")).not.toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────
// L1 — Direction B: every offer-prefixed editable field maps to a base
// manifest field. With D6 unresolved (no `data-widget` attrs), we
// enumerate by id-prefix and assert set-equality.
// ─────────────────────────────────────────────────────────────────────────

const OFFER_EDITABLE_FIELDS_DEFAULT_COUPON = new Set([
  "offer-name",
  "offer-code",
  "offer-type",
  "offer-type-COUPON",
  "offer-type-EXTERNAL",
  "offer-programs",
  "offer-customer-audience",
  "offer-description",
  "offer-max-uses",
  "offer-max-redemptions",
  "offer-max-discount-value",
  "offer-set-datetime",
  // D2 — 6 COUPON sub-type fields
  "offer-coupon-discount-type",
  "offer-discount-currency-type",
  "offer-coupon-type",
  "offer-coupon-code-group",
  // "offer-coupon-code-information" intentionally absent: CodeGenInformationInput
  // (#872) is a composite of several unprefixed widgets (Prefix/Suffix/Algorithm/
  // Length/Check Digit selects+inputs), not a single offer-prefixed element —
  // see the dedicated "renders Coupon Code Generation as structured..." test below.
  // "Coupon Code Source" discriminator (create mode) — the group container
  // plus its 2 individual radio buttons, same shape as offer-type/
  // offer-type-COUPON/offer-type-EXTERNAL above.
  "offer-coupon-code-source",
  "offer-coupon-code-source-GENERATED",
  "offer-coupon-code-source-PROVIDED",
  "offer-coupon-code-batch-size",
] as const);

// Filter out aria-describedby description nodes — they share the offer-
// prefix but aren't editable widgets. The orphan-detection test cares
// about widget mounts, not their associated descriptions.
const EDITABLE_TAGS = new Set(["INPUT", "SELECT", "TEXTAREA", "BUTTON"]);
function isEditableEl(el: Element): boolean {
  return EDITABLE_TAGS.has(el.tagName) || el.getAttribute("role") === "radiogroup";
}

describe("[audit] L1 Direction B — OfferFormSheet orphan detection", () => {
  it("every rendered offer- prefixed element is in the known editable set (default type=COUPON)", () => {
    renderSheet();
    const ids = Array.from(document.querySelectorAll("[id^='offer-']"))
      .filter(isEditableEl)
      .map((el) => el.getAttribute("id") ?? "")
      .filter((id) => id.startsWith("offer-"));
    expect(ids.length).toBeGreaterThan(0);
    const known: ReadonlySet<string> = OFFER_EDITABLE_FIELDS_DEFAULT_COUPON;
    for (const id of ids) {
      expect(known.has(id as never), `unexpected offer-prefixed id '${id}'`).toBe(true);
    }
  });

  it("renders every expected editable field — no missing widgets when type=COUPON", () => {
    renderSheet();
    // offer-coupon-code-batch-size only renders once "Auto-generate a batch
    // of codes" is chosen for the Coupon Code Source discriminator.
    selectGeneratedCouponSource();
    const ids = new Set(
      Array.from(document.querySelectorAll("[id^='offer-']"))
        .filter(isEditableEl)
        .map((el) => el.getAttribute("id") ?? "")
    );
    for (const expected of OFFER_EDITABLE_FIELDS_DEFAULT_COUPON) {
      expect(ids.has(expected), `expected offer-prefixed id '${expected}' is missing`).toBe(true);
    }
  });

  it("does not render an ExtendedFieldsSection without schema + extendedFields props", () => {
    renderSheet();
    expect(document.querySelector("[data-extended-section]")).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────
// L1 — Direction C: discriminator-gated rendering. The defining audit
// assertion for polymorphic entities. COUPON-only field present when
// type=COUPON, absent when type=EXTERNAL.
// ─────────────────────────────────────────────────────────────────────────

describe("[audit] L1 Direction C — discriminator-gated field rendering", () => {
  it("renders maxDiscountValue when type=COUPON with data-widget='text-input' (D6 resolved)", () => {
    renderSheet();
    const input = screen.getByLabelText(/Max Discount Value/i) as HTMLInputElement;
    expect(input.id).toBe("offer-max-discount-value");
    expect(input.getAttribute("type")).toBe("number");
    expect(input.getAttribute("data-widget")).toBe("text-input");
    // step="0.01" — a type="number" input with no step defaults to whole
    // integers only, silently blocking a fractional cap like "9.99" from
    // ever submitting (the form has no noValidate, so native HTML5
    // constraint validation blocks the submit event before JS sees it).
    // Capped at 2 decimals (not step="any") to match the value's cents-level
    // persistence precision, rather than accepting precision that would
    // silently differ from what gets saved.
    expect(input.getAttribute("step")).toBe("0.01");
  });

  it("hides maxDiscountValue when initialData.type=EXTERNAL", () => {
    renderSheet({
      mode: "edit",
      initialData: {
        offerId: "ofr_550e8400e29b41d4a716446655440011",
        code: "partner-reward",
        name: "Partner Reward",
        type: "EXTERNAL",
        programIds: ["prog_550e8400e29b41d4a716446655440000"],
      },
    });
    expect(document.querySelector("#offer-max-discount-value")).toBeNull();
  });

  it("toggles maxDiscountValue rendering when the type selector changes", () => {
    renderSheet();
    expect(document.querySelector("#offer-max-discount-value")).not.toBeNull();

    fireEvent.click(screen.getByRole("radio", { name: /^External$/i }));

    expect(document.querySelector("#offer-max-discount-value")).toBeNull();
  });

  // D2 RESOLVED: 6 COUPON sub-type fields render under the COUPON-gated
  // block. They mount when type=COUPON, hide when type=EXTERNAL, and disappear
  // on COUPON → EXTERNAL toggle.
  it("D2 (resolved): renders all 6 COUPON sub-type fields when type=COUPON", () => {
    renderSheet();
    expect(document.querySelector("#offer-coupon-discount-type")).not.toBeNull();
    expect(document.querySelector("#offer-discount-currency-type")).not.toBeNull();
    expect(document.querySelector("#offer-coupon-type")).not.toBeNull();
    expect(document.querySelector("#offer-coupon-code-group")).not.toBeNull();
    expect(document.querySelector("#offer-coupon-code-source")).not.toBeNull();
    // Coupon Code Generation + its batch size only render once a source is
    // chosen -- select "Auto-generate a batch of codes" to reveal them.
    selectGeneratedCouponSource();
    expect(screen.getByText("Coupon Code Generation")).toBeInTheDocument();
    expect(document.querySelector("#offer-coupon-code-batch-size")).not.toBeNull();
  });

  it("renders Coupon Code Generation as structured CodeGenInformation inputs", () => {
    renderSheet({
      mode: "edit",
      initialData: {
        offerId: "ofr_550e8400e29b41d4a716446655440012",
        code: "generated-coupon",
        name: "Generated Coupon",
        type: "COUPON",
        programIds: ["prog_550e8400e29b41d4a716446655440000"],
        couponCodeInformation: {
          type: "GENERATED",
          part1Algorithm: "ALPHANUMERIC",
          part1Length: 8,
          part2Algorithm: "NUMERIC",
          part2Length: 4,
          checkDigitAlgorithm: "MOD_10",
        },
      } as OfferFormSheetProps["initialData"],
    });

    expect(screen.queryByRole("textbox", { name: /Coupon Code Generation/i })).toBeNull();
    expect(screen.getByLabelText("Prefix")).toBeInTheDocument();
    expect(screen.getByLabelText("Suffix")).toBeInTheDocument();
    expect(screen.getByText("Part 1 Algorithm")).toBeInTheDocument();
    expect(screen.getByLabelText("Part 1 Length")).toBeInTheDocument();
    expect(screen.getByText("Part 2 Algorithm")).toBeInTheDocument();
    expect(screen.getByLabelText("Part 2 Length")).toBeInTheDocument();
    expect(screen.getByText("Check Digit Algorithm")).toBeInTheDocument();
  });

  it("D2 (resolved): hides all 6 COUPON sub-type fields when type=EXTERNAL", () => {
    renderSheet({
      mode: "edit",
      initialData: {
        offerId: "ofr_550e8400e29b41d4a716446655440011",
        code: "partner-reward",
        name: "Partner Reward",
        type: "EXTERNAL",
        programIds: ["prog_550e8400e29b41d4a716446655440000"],
      },
    });
    expect(document.querySelector("#offer-coupon-discount-type")).toBeNull();
    expect(document.querySelector("#offer-discount-currency-type")).toBeNull();
    expect(document.querySelector("#offer-coupon-type")).toBeNull();
    expect(document.querySelector("#offer-coupon-code-group")).toBeNull();
    expect(screen.queryByText("Coupon Code Generation")).toBeNull();
    expect(document.querySelector("#offer-coupon-code-batch-size")).toBeNull();
  });

  it("D2 (resolved): toggles all 6 COUPON sub-type fields off when discriminator flips to EXTERNAL", () => {
    renderSheet();
    expect(document.querySelector("#offer-coupon-discount-type")).not.toBeNull();

    fireEvent.click(screen.getByRole("radio", { name: /^External$/i }));

    expect(document.querySelector("#offer-coupon-discount-type")).toBeNull();
    expect(document.querySelector("#offer-coupon-code-batch-size")).toBeNull();
  });

  // D3 RESOLVED: the type Select at offer-form-sheet.tsx:245 now clears
  // sub-type-specific state when discriminator changes away from COUPON.
  // This test pins the post-fix behavior — a future regression to a pure
  // setter (the original broken shape) would fail this assertion loudly.
  it("D3 (resolved): maxDiscountValue state is cleared on COUPON → EXTERNAL → COUPON toggle", () => {
    renderSheet();
    const initial = screen.getByLabelText(/Max Discount Value/i) as HTMLInputElement;
    fireEvent.change(initial, { target: { value: "75" } });
    expect(initial.value).toBe("75");

    fireEvent.click(screen.getByRole("radio", { name: /^External$/i }));
    expect(document.querySelector("#offer-max-discount-value")).toBeNull();

    fireEvent.click(screen.getByRole("radio", { name: /^Coupon$/i }));
    const restored = screen.getByLabelText(/Max Discount Value/i) as HTMLInputElement;
    // D3 fix: setType's onValueChange callback clears maxDiscountValue
    // when the new type isn't COUPON. The re-mounted input renders empty.
    expect(restored.value).toBe("");
  });
});

// ─────────────────────────────────────────────────────────────────────────
// #891 — "Coupon Code Source" required discriminator replaces the old
// disconnected pairing of CodeGenInformationInput's own "Code Type" select +
// a separate, optional couponCodeBatchSize field. The backend's
// CouponOfferCreatedEventListener only populates a coupon pool off the
// offer's CREATE event, so this is create-only and, once made, permanent (no
// regenerate/backfill endpoint) — edit mode renders a read-only summary
// instead of the interactive choice.
// ─────────────────────────────────────────────────────────────────────────

describe("[audit] L1 Direction D — Coupon Code Source discriminator (#891)", () => {
  it("renders the GENERATED and PROVIDED options with no default selection", () => {
    renderSheet();
    const generated = screen.getByRole("radio", { name: /Auto-generate a batch of codes/i });
    const provided = screen.getByRole("radio", { name: /Provide codes manually/i });
    expect(generated).not.toBeChecked();
    expect(provided).not.toBeChecked();
  });

  it("reveals CodeGenInformationInput's algorithm sub-fields + a required batch size once GENERATED is chosen", () => {
    renderSheet();
    expect(screen.queryByText("Coupon Code Generation")).toBeNull();
    expect(document.querySelector("#offer-coupon-code-batch-size")).toBeNull();
    // hideTypeSelector removes CodeGenInformationInput's own "Code Type"
    // select entirely -- the Coupon Code Source group above is now the only
    // control for `type`.
    expect(document.querySelector("#codeGenType")).toBeNull();

    selectGeneratedCouponSource();

    expect(screen.getByText("Coupon Code Generation")).toBeInTheDocument();
    expect(document.querySelector("#codeGenType")).toBeNull();
    const batchSize = screen.getByLabelText(/Coupon Code Batch Size/i);
    expect(batchSize).toBeInTheDocument();
    expect(document.querySelector("#offer-coupon-code-batch-size-error")).toBeNull();
  });

  it("hides the algorithm sub-fields and batch size when PROVIDED is chosen", () => {
    renderSheet();
    fireEvent.click(screen.getByRole("radio", { name: /Provide codes manually/i }));

    expect(screen.queryByText("Coupon Code Generation")).toBeNull();
    expect(document.querySelector("#offer-coupon-code-batch-size")).toBeNull();
  });

  it("never renders the interactive discriminator in edit mode; shows a read-only summary instead", () => {
    renderSheet({
      mode: "edit",
      initialData: {
        offerId: "ofr_550e8400e29b41d4a716446655440023",
        code: "legacy-coupon",
        name: "Legacy Coupon",
        type: "COUPON",
        programIds: ["prog_550e8400e29b41d4a716446655440000"],
        couponCodeInformation: { type: "GENERATED" },
      } as OfferFormSheetProps["initialData"],
    });
    expect(screen.queryByRole("radio", { name: /Auto-generate a batch of codes/i })).toBeNull();
    expect(screen.queryByRole("radio", { name: /Provide codes manually/i })).toBeNull();
    expect(document.querySelector("#offer-coupon-code-source")?.textContent).toMatch(
      /Auto-generated batch of codes/i
    );
  });

  it("summarizes legacy pre-fix enum values (EXTERNAL/EXTERNAL_IF_NOT_PROVIDED/GENERATED_IF_NOT_PROVIDED) generically in edit mode", () => {
    renderSheet({
      mode: "edit",
      initialData: {
        offerId: "ofr_550e8400e29b41d4a716446655440024",
        code: "legacy-external",
        name: "Legacy External",
        type: "COUPON",
        programIds: ["prog_550e8400e29b41d4a716446655440000"],
        couponCodeInformation: { type: "EXTERNAL" },
      } as OfferFormSheetProps["initialData"],
    });
    expect(document.querySelector("#offer-coupon-code-source")?.textContent).toMatch(
      /Custom code-generation configuration \(EXTERNAL\)/i
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────
// L3 — Behavior. Form submit per sub-type, programIds validation,
// reset-on-close, edit-mode prefill.
// ─────────────────────────────────────────────────────────────────────────

describe("[audit] L3 — OfferFormSheet behavior", () => {
  it("submits structured Coupon Code Generation data as a typed object", async () => {
    const couponCodeInformation = {
      type: "GENERATED" as const,
      prefix: "COUP-",
      suffix: "-2026",
      part1Algorithm: "ALPHANUMERIC" as const,
      part1Length: 8,
      part2Algorithm: "NUMERIC" as const,
      part2Length: 4,
      checkDigitAlgorithm: "MOD_10" as const,
    };
    const { onSubmit } = renderSheet({
      mode: "edit",
      initialData: {
        offerId: "ofr_550e8400e29b41d4a716446655440013",
        code: "generated-coupon",
        name: "Generated Coupon",
        type: "COUPON",
        programIds: ["prog_550e8400e29b41d4a716446655440000"],
        couponCodeInformation,
      } as OfferFormSheetProps["initialData"],
    });

    fireEvent.change(screen.getByLabelText("Prefix"), { target: { value: "SUMMER-" } });
    fireEvent.click(screen.getByRole("button", { name: /^Save Changes$/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const payload = onSubmit.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload.couponCodeInformation).toEqual({
      ...couponCodeInformation,
      prefix: "SUMMER-",
    });
  });

  it("submits a COUPON CreateOffer payload with the gated maxDiscountValue", async () => {
    const { onSubmit } = renderSheet();
    fireEvent.change(screen.getByLabelText(/^Name/i, { selector: "input" }), {
      target: { value: "Summer Sale 20" },
    });
    addProgram();
    fireEvent.change(screen.getByLabelText(/Max Discount Value/i), {
      target: { value: "50" },
    });
    // A source must be chosen + a batch size set so this test's own focus
    // isn't gated behind the Coupon Code Source validation (covered
    // separately below).
    selectGeneratedCouponSource();
    fireEvent.change(screen.getByLabelText(/Coupon Code Batch Size/i), {
      target: { value: "500" },
    });

    fireEvent.click(screen.getByRole("button", { name: /^Create Offer$/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const payload = onSubmit.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload).toMatchObject({
      name: "Summer Sale 20",
      code: "summer-sale-20",
      type: "COUPON",
      programIds: ["prog_550e8400e29b41d4a716446655440000"],
      maxDiscountValue: 50,
    });
  });

  // D13 RESOLVED: the `required` attr is gone; `?? 0` (treating 0 as "no
  // discount cap") is now reachable from the UI. Blank-submit lets the
  // fallback fire and 0 reaches the wire payload. Documents the resolved
  // semantic — 0 means no cap.
  it("D13 (resolved): blank maxDiscountValue on COUPON submits as 0 (no-cap semantic)", async () => {
    const { onSubmit } = renderSheet();
    fireEvent.change(screen.getByLabelText(/^Name/i, { selector: "input" }), {
      target: { value: "Blank Discount" },
    });
    addProgram();
    selectGeneratedCouponSource();
    fireEvent.change(screen.getByLabelText(/Coupon Code Batch Size/i), {
      target: { value: "500" },
    });
    // Intentionally leave maxDiscountValue blank. The Submit handler should
    // run and the `?? 0` fallback should produce maxDiscountValue=0.
    fireEvent.click(screen.getByRole("button", { name: /^Create Offer$/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const payload = onSubmit.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload.maxDiscountValue).toBe(0);
  });

  it("D13 (resolved): Max Discount Value input no longer carries HTML `required`", () => {
    renderSheet();
    const input = screen.getByLabelText(/Max Discount Value/i) as HTMLInputElement;
    expect(input.required).toBe(false);
  });

  it("strips maxDiscountValue from the wire payload when type=EXTERNAL (submit-time guard)", async () => {
    const { onSubmit } = renderSheet();
    fireEvent.change(screen.getByLabelText(/^Name/i, { selector: "input" }), {
      target: { value: "Partner Reward" },
    });
    addProgram();
    // Set a stale maxDiscountValue then flip to EXTERNAL — the submit guard
    // at offer-form-sheet.tsx:173 must replace it with undefined.
    fireEvent.change(screen.getByLabelText(/Max Discount Value/i), {
      target: { value: "75" },
    });
    fireEvent.click(screen.getByRole("radio", { name: /^External$/i }));

    fireEvent.click(screen.getByRole("button", { name: /^Create Offer$/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const payload = onSubmit.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload).toMatchObject({
      name: "Partner Reward",
      type: "EXTERNAL",
    });
    expect(payload.maxDiscountValue).toBeUndefined();
  });

  it("blocks submission and surfaces an inline error when programIds is empty", async () => {
    const { onSubmit } = renderSheet();
    fireEvent.change(screen.getByLabelText(/^Name/i, { selector: "input" }), {
      target: { value: "No Programs" },
    });
    fireEvent.change(screen.getByLabelText(/Max Discount Value/i), {
      target: { value: "10" },
    });

    fireEvent.click(screen.getByRole("button", { name: /^Create Offer$/i }));

    // No mutation fires when validation blocks.
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText(/At least one program is required/i)).toBeInTheDocument();
  });

  it("clears the programIds error once a program is added", async () => {
    renderSheet();
    fireEvent.change(screen.getByLabelText(/^Name/i, { selector: "input" }), {
      target: { value: "Will Fix" },
    });
    fireEvent.change(screen.getByLabelText(/Max Discount Value/i), {
      target: { value: "10" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^Create Offer$/i }));
    expect(screen.getByText(/At least one program is required/i)).toBeInTheDocument();

    addProgram();
    expect(screen.queryByText(/At least one program is required/i)).toBeNull();
  });

  it("surfaces the error prop in the FormSheet alert region", () => {
    renderSheet({ error: "Server returned 422 — code already exists" });
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toMatch(/Server returned 422/);
  });

  it("renders 'Save Changes' button label in edit mode and prefills initialData", () => {
    renderSheet({
      mode: "edit",
      initialData: {
        offerId: "ofr_550e8400e29b41d4a716446655440010",
        code: "summer-sale",
        name: "Summer Sale",
        type: "COUPON",
        programIds: ["prog_550e8400e29b41d4a716446655440000"],
        maxDiscountValue: 50,
      },
    });
    expect(screen.getByRole("button", { name: /^Save Changes$/i })).toBeInTheDocument();
    expect((screen.getByLabelText(/^Name/i, { selector: "input" }) as HTMLInputElement).value).toBe(
      "Summer Sale"
    );
    expect((screen.getByLabelText(/Max Discount Value/i) as HTMLInputElement).value).toBe("50");
  });

  // D11 PROOF: the truthy-check at offer-form-sheet.tsx:318 uses the STRING
  // `val`, not the parsed number. `"0"` is a truthy string, so explicit 0 IS
  // transmitted as 0. This test pins the correct behavior so a future
  // regression that changes the check to `parseInt(val, 10) || undefined`
  // (which WOULD drop 0) surfaces immediately. D11 in TODOS.md was a
  // false-positive from both reviewers and is closed in this commit.
  it("transmits maxOfferUses=0 as 0 (truthy string check is correct, D11 disproven)", async () => {
    const { onSubmit } = renderSheet();
    fireEvent.change(screen.getByLabelText(/^Name/i, { selector: "input" }), {
      target: { value: "Zero Uses" },
    });
    addProgram();
    fireEvent.change(screen.getByLabelText(/Max Discount Value/i), {
      target: { value: "10" },
    });
    fireEvent.change(screen.getByLabelText(/Max Offer Uses/i), {
      target: { value: "0" },
    });
    selectGeneratedCouponSource();
    fireEvent.change(screen.getByLabelText(/Coupon Code Batch Size/i), {
      target: { value: "500" },
    });

    fireEvent.click(screen.getByRole("button", { name: /^Create Offer$/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const payload = onSubmit.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload.maxOfferUses).toBe(0);
  });

  // D10 RESOLVED: the `|| undefined` coercion is dropped; explicit `false`
  // now flows through to the wire payload. Required when BE default is
  // `true` and the user wants to suppress that.
  it("D10 (resolved): setDateTimePeriodOnIssue=false transmits as false on submit", async () => {
    const { onSubmit } = renderSheet();
    fireEvent.change(screen.getByLabelText(/^Name/i, { selector: "input" }), {
      target: { value: "Default Switch Probe" },
    });
    addProgram();
    fireEvent.change(screen.getByLabelText(/Max Discount Value/i), {
      target: { value: "10" },
    });
    selectGeneratedCouponSource();
    fireEvent.change(screen.getByLabelText(/Coupon Code Batch Size/i), {
      target: { value: "500" },
    });
    // Switch defaults to false — submit without flipping it.

    fireEvent.click(screen.getByRole("button", { name: /^Create Offer$/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const payload = onSubmit.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload.setDateTimePeriodOnIssue).toBe(false);
  });

  it("D10 (resolved): setDateTimePeriodOnIssue=true still transmits as true on submit", async () => {
    const { onSubmit } = renderSheet();
    fireEvent.change(screen.getByLabelText(/^Name/i, { selector: "input" }), {
      target: { value: "Flipped Switch" },
    });
    addProgram();
    fireEvent.change(screen.getByLabelText(/Max Discount Value/i), {
      target: { value: "10" },
    });
    selectGeneratedCouponSource();
    fireEvent.change(screen.getByLabelText(/Coupon Code Batch Size/i), {
      target: { value: "500" },
    });
    // Flip the switch on.
    const switchEl = document.querySelector("#offer-set-datetime") as HTMLElement;
    fireEvent.click(switchEl);

    fireEvent.click(screen.getByRole("button", { name: /^Create Offer$/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const payload = onSubmit.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload.setDateTimePeriodOnIssue).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// #891 — Coupon Code Source is a required, create-only discriminator. A
// COUPON create must not reach parent onSubmit until a source is chosen,
// and GENERATED additionally requires a batch size — both block inline,
// before any network call, the same way the programIds check does.
// ─────────────────────────────────────────────────────────────────────────

describe("[audit] L3 — Coupon Code Source required-choice validation on submit (#891)", () => {
  it("blocks submit with an inline error when no source is chosen", () => {
    const { onSubmit } = renderSheet();
    fireEvent.change(screen.getByLabelText(/^Name/i, { selector: "input" }), {
      target: { value: "No Source Offer" },
    });
    addProgram();

    fireEvent.click(screen.getByRole("button", { name: /^Create Offer$/i }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(
      screen.getByText(/Choose how this offer's coupon codes will be sourced/i)
    ).toBeInTheDocument();
  });

  it("clears the source error once a source is chosen", () => {
    renderSheet();
    fireEvent.change(screen.getByLabelText(/^Name/i, { selector: "input" }), {
      target: { value: "Will Choose" },
    });
    addProgram();
    fireEvent.click(screen.getByRole("button", { name: /^Create Offer$/i }));
    expect(
      screen.getByText(/Choose how this offer's coupon codes will be sourced/i)
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("radio", { name: /Provide codes manually/i }));

    expect(screen.queryByText(/Choose how this offer's coupon codes will be sourced/i)).toBeNull();
  });

  it("blocks submit with an inline error when GENERATED is chosen but no batch size is set", () => {
    const { onSubmit } = renderSheet();
    fireEvent.change(screen.getByLabelText(/^Name/i, { selector: "input" }), {
      target: { value: "No Batch Size Offer" },
    });
    addProgram();
    selectGeneratedCouponSource();

    fireEvent.click(screen.getByRole("button", { name: /^Create Offer$/i }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(
      screen.getByText(/A batch size is required to auto-generate coupon codes/i)
    ).toBeInTheDocument();
  });

  it("submits with couponCodeInformation.type=GENERATED and the entered batch size when GENERATED is chosen", async () => {
    const { onSubmit } = renderSheet();
    fireEvent.change(screen.getByLabelText(/^Name/i, { selector: "input" }), {
      target: { value: "Pooled Offer" },
    });
    addProgram();
    selectGeneratedCouponSource();
    fireEvent.change(screen.getByLabelText(/Coupon Code Batch Size/i), {
      target: { value: "1000" },
    });

    fireEvent.click(screen.getByRole("button", { name: /^Create Offer$/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const payload = onSubmit.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload.couponCodeInformation).toMatchObject({ type: "GENERATED" });
    expect(payload.couponCodeBatchSize).toBe(1000);
  });

  it("submits with couponCodeInformation.type=PROVIDED and no batch size when PROVIDED is chosen", async () => {
    const { onSubmit } = renderSheet();
    fireEvent.change(screen.getByLabelText(/^Name/i, { selector: "input" }), {
      target: { value: "Manual Codes Offer" },
    });
    addProgram();
    fireEvent.click(screen.getByRole("radio", { name: /Provide codes manually/i }));

    fireEvent.click(screen.getByRole("button", { name: /^Create Offer$/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const payload = onSubmit.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload.couponCodeInformation).toEqual({ type: "PROVIDED" });
    expect(payload.couponCodeBatchSize).toBeUndefined();
  });

  it("re-validates programIds before the coupon-code-source gate (empty programIds blocks first)", () => {
    const { onSubmit } = renderSheet();
    fireEvent.change(screen.getByLabelText(/^Name/i, { selector: "input" }), {
      target: { value: "No Programs No Source" },
    });
    // Leave programIds empty and no source chosen — programIds must win.

    fireEvent.click(screen.getByRole("button", { name: /^Create Offer$/i }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText(/At least one program is required/i)).toBeInTheDocument();
    expect(screen.queryByText(/Choose how this offer's coupon codes will be sourced/i)).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────
// L3 — auto-create suggested metadata before parent onSubmit. Pins the
// silent-error fallthrough contract: a createMetadata 4xx must not abort
// the offer POST (parent's onSubmit catch is the single error surface).
// ─────────────────────────────────────────────────────────────────────────

describe("[audit] L3 — OFFER auto-create suggested metadata", () => {
  it("fires createMetadata for a suggested coupon-type on submit", async () => {
    metadataFieldMock.fireAsSuggested = true;
    const suggestedOption = {
      code: "standard",
      name: "Standard",
      description: "General-purpose coupon",
      isSuggested: true,
      dataModelCode: "COUPON",
    };
    metadataFieldMock.hookReturn = {
      category: "DATA_TYPE",
      isTypeNotFound: false,
      findOption: (code: string) => (code === "standard" ? suggestedOption : undefined),
      createMetadata: vi.fn<(data: unknown) => Promise<void>>().mockResolvedValue(undefined),
    };

    const { onSubmit } = renderSheet();
    fireEvent.change(screen.getByLabelText(/^Name/i, { selector: "input" }), {
      target: { value: "Suggested Coupon" },
    });
    addProgram();
    fireEvent.change(screen.getByLabelText(/Max Discount Value/i), {
      target: { value: "10" },
    });
    // Pick the suggested coupon type via the MetadataField stub — the stub's
    // onChange fires onValueChange(value, fireAsSuggested=true).
    const couponTypeInput = document.querySelector("#offer-coupon-type") as HTMLInputElement;
    fireEvent.change(couponTypeInput, { target: { value: "standard" } });
    selectGeneratedCouponSource();
    fireEvent.change(screen.getByLabelText(/Coupon Code Batch Size/i), {
      target: { value: "500" },
    });

    fireEvent.click(screen.getByRole("button", { name: /^Create Offer$/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(metadataFieldMock.hookReturn.createMetadata).toHaveBeenCalledWith({
      code: "standard",
      name: "Standard",
      description: { en: "General-purpose coupon" },
      dataModelCode: "COUPON",
    });
  });

  it("swallows createMetadata failure and still calls parent onSubmit", async () => {
    metadataFieldMock.fireAsSuggested = true;
    const suggestedOption = {
      code: "premium",
      name: "Premium",
      isSuggested: true,
      dataModelCode: "COUPON",
    };
    const createMetadataSpy = vi
      .fn<(data: unknown) => Promise<void>>()
      .mockRejectedValue(new Error("BE 400"));
    metadataFieldMock.hookReturn = {
      category: "DATA_TYPE",
      isTypeNotFound: false,
      findOption: (code: string) => (code === "premium" ? suggestedOption : undefined),
      createMetadata: createMetadataSpy,
    };

    const { onSubmit } = renderSheet();
    fireEvent.change(screen.getByLabelText(/^Name/i, { selector: "input" }), {
      target: { value: "Premium Coupon" },
    });
    addProgram();
    fireEvent.change(screen.getByLabelText(/Max Discount Value/i), {
      target: { value: "20" },
    });
    const couponTypeInput = document.querySelector("#offer-coupon-type") as HTMLInputElement;
    fireEvent.change(couponTypeInput, { target: { value: "premium" } });
    selectGeneratedCouponSource();
    fireEvent.change(screen.getByLabelText(/Coupon Code Batch Size/i), {
      target: { value: "500" },
    });

    fireEvent.click(screen.getByRole("button", { name: /^Create Offer$/i }));

    // createMetadata threw, but onSubmit must still run — the try/catch
    // swallow is what lets the BE surface a clearer "type not found" error.
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(createMetadataSpy).toHaveBeenCalledTimes(1);
  });

  it("does not call createMetadata when the picked option is not suggested", async () => {
    // Default fireAsSuggested=false (beforeEach) — the MetadataField stub
    // fires onValueChange(value, false) so couponTypeIsSuggested stays false.
    metadataFieldMock.hookReturn = {
      category: "DATA_TYPE",
      isTypeNotFound: false,
      findOption: () => ({ code: "existing", name: "Existing" }),
      createMetadata: vi.fn<(data: unknown) => Promise<void>>().mockResolvedValue(undefined),
    };

    const { onSubmit } = renderSheet();
    fireEvent.change(screen.getByLabelText(/^Name/i, { selector: "input" }), {
      target: { value: "Real Existing Coupon" },
    });
    addProgram();
    fireEvent.change(screen.getByLabelText(/Max Discount Value/i), {
      target: { value: "5" },
    });
    const couponTypeInput = document.querySelector("#offer-coupon-type") as HTMLInputElement;
    fireEvent.change(couponTypeInput, { target: { value: "existing" } });
    selectGeneratedCouponSource();
    fireEvent.change(screen.getByLabelText(/Coupon Code Batch Size/i), {
      target: { value: "500" },
    });

    fireEvent.click(screen.getByRole("button", { name: /^Create Offer$/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(metadataFieldMock.hookReturn.createMetadata).not.toHaveBeenCalled();
  });
});
