/**
 * AudienceFormSheet audit suite (L1 widget mapping + L3 behavior).
 *
 * CUSTOMER_AUDIENCE is polymorphic — the base manifest discriminates on
 * `type` (CUSTOMER_LIST | CUSTOMER_SEGMENT), and the FE adds an `engine`
 * sub-discriminator (CLICKHOUSE | THREADS) surfaced as a 3-way Audience Type
 * selector (Customer List | Customer Segment | THREADS Segment). Direction C
 * pins the discriminator-gated branches.
 *
 * The form sheet is fully presentational (no SDK / react-query imports — the
 * segment builder arrives via the `renderSegmentBuilder` render-slot), so this
 * suite needs no module mocks.
 *
 * L2 (audit-side Zod schema) lives in audience-form-sheet.schema.test.ts.
 */

import type { UIEntitySchema } from "@loom-loyalty/schema";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useEffect, useState, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { AudienceFormSheet } from "./audience-form-sheet.js";
import type { AudienceFormSheetProps, CustomerAudience } from "./types.js";
import { AUDIENCE_STANDARD_FIELDS } from "./types.js";

// Minimal UI schema exposing one tenant-extension text field. ExtendedFieldsSection
// only reads schema.fields[name], so a focused cast keeps the fixture small.
// showInCreate/showInEdit mark it an INPUT field — ExtendedFieldsSection now
// excludes output-only fields from the write (edit) side.
const SCHEMA_WITH_EXTENSION = {
  fields: {
    loyaltyTier: {
      name: "loyaltyTier",
      label: "Loyalty Tier",
      widget: "text",
      showInCreate: true,
      showInEdit: true,
    },
  },
} as unknown as UIEntitySchema;

function renderSheet(overrides: Partial<AudienceFormSheetProps> = {}) {
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  const onOpenChange = vi.fn();
  const result = render(
    <AudienceFormSheet
      open
      onOpenChange={onOpenChange}
      mode="create"
      onSubmit={onSubmit}
      renderSegmentBuilder={({ onChange }) => (
        <button
          type="button"
          data-testid="segment-builder-stub"
          onClick={() => onChange({ kind: "group", operator: "AND", conditions: [] } as never)}
        >
          Build segment
        </button>
      )}
      {...overrides}
    />
  );
  return { ...result, onSubmit, onOpenChange };
}

/** Open the Audience Type Radix Select and pick an option by visible label. */
function selectType(label: RegExp) {
  fireEvent.click(screen.getByLabelText(/Audience Type/i));
  fireEvent.click(within(document.body).getByRole("option", { name: label }));
}

// ─────────────────────────────────────────────────────────────────────────
// L1 — Direction A: every base manifest field renders the widget the form
// currently mounts. data-widget + id attrs resolved in this audit.
// ─────────────────────────────────────────────────────────────────────────

describe("[audit] L1 Direction A — AudienceFormSheet base field widgets", () => {
  it("renders name as Input[type=text] with data-widget='text-input' and id='audience-name'", () => {
    renderSheet();
    const input = screen.getByLabelText(/^Name/i, { selector: "input" });
    expect(input.id).toBe("audience-name");
    expect(input.tagName).toBe("INPUT");
    expect(input.getAttribute("type")).toBe("text");
    expect(input.getAttribute("data-widget")).toBe("text-input");
  });

  it("renders code as a CodeInput with id='audience-code'", () => {
    renderSheet();
    const input = screen.getByLabelText(/^Code/i, { selector: "input" }) as HTMLInputElement;
    expect(input.id).toBe("audience-code");
    expect(input.tagName).toBe("INPUT");
  });

  it("auto-generates code in kebab-case when name is typed", () => {
    renderSheet();
    const nameInput = screen.getByLabelText(/^Name/i, { selector: "input" });
    const codeInput = screen.getByLabelText(/^Code/i, { selector: "input" }) as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: "VIP Shoppers" } });
    expect(codeInput.value).toBe("vip-shoppers");
  });

  it("renders type as a Radix Select with data-widget='select' and data-discriminator='true'", () => {
    renderSheet();
    const trigger = screen.getByLabelText(/Audience Type/i);
    expect(trigger.id).toBe("audience-type");
    expect(trigger.getAttribute("role")).toBe("combobox");
    expect(trigger.getAttribute("data-widget")).toBe("select");
    expect(trigger.getAttribute("data-discriminator")).toBe("true");
  });

  it("renders description via LocalizedStringInput with associated label (WCAG 1.3.1)", () => {
    renderSheet();
    // getByLabelText resolves only when <Label htmlFor> binds to the
    // forwarded id on the active locale input.
    const description = screen.getByLabelText(/^Description$/i);
    expect(description.id).toBe("audience-description");
  });

  it("does not render system fields (customerAudienceId, createdDateTime, modifiedDateTime)", () => {
    renderSheet();
    expect(document.querySelector("#audience-customerAudienceId")).toBeNull();
    expect(document.querySelector("#audience-createdDateTime")).toBeNull();
    expect(document.querySelector("#audience-modifiedDateTime")).toBeNull();
  });

  it("locks code input in edit mode", () => {
    const initial: CustomerAudience = {
      customerAudienceId: "aud_00000000000000000000000000000001",
      customerListId: "lst_00000000000000000000000000000001",
      code: "vip",
      name: "VIP",
      type: "CUSTOMER_LIST",
    };
    renderSheet({ mode: "edit", initialData: initial });
    const codeInput = screen.getByLabelText(/^Code/i, { selector: "input" }) as HTMLInputElement;
    expect(codeInput.disabled).toBe(true);
  });

  it("locks type selector in edit mode (discriminator cannot change)", () => {
    const initial: CustomerAudience = {
      customerAudienceId: "aud_00000000000000000000000000000002",
      customerListId: "lst_00000000000000000000000000000002",
      code: "vip",
      name: "VIP",
      type: "CUSTOMER_LIST",
    };
    renderSheet({ mode: "edit", initialData: initial });
    const trigger = screen.getByLabelText(/Audience Type/i);
    expect(trigger.getAttribute("data-disabled")).not.toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────
// L1 — Direction B: every audience-prefixed editable field maps to a known
// field. Enumerated by id-prefix + set-equality. Default type = CUSTOMER_LIST.
// ─────────────────────────────────────────────────────────────────────────

const AUDIENCE_EDITABLE_IDS_CUSTOMER_LIST = new Set([
  "audience-type",
  "audience-name",
  "audience-code",
  "audience-description",
  "audience-trigger-on-enter",
  "audience-trigger-on-exit",
] as const);

const EDITABLE_TAGS = new Set(["INPUT", "SELECT", "TEXTAREA", "BUTTON"]);
function isEditableEl(el: Element): boolean {
  return EDITABLE_TAGS.has(el.tagName);
}

function audiencePrefixedIds(): string[] {
  return Array.from(document.querySelectorAll("[id^='audience-']"))
    .filter(isEditableEl)
    .map((el) => el.getAttribute("id") ?? "")
    .filter((id) => id.startsWith("audience-"));
}

describe("[audit] L1 Direction B — AudienceFormSheet orphan detection", () => {
  it("every rendered audience- prefixed element is in the known set (default type=CUSTOMER_LIST)", () => {
    renderSheet();
    const ids = audiencePrefixedIds();
    expect(ids.length).toBeGreaterThan(0);
    const known: ReadonlySet<string> = AUDIENCE_EDITABLE_IDS_CUSTOMER_LIST;
    for (const id of ids) {
      expect(known.has(id as never), `unexpected audience-prefixed id '${id}'`).toBe(true);
    }
  });

  it("renders every expected base field — no missing widgets when type=CUSTOMER_LIST", () => {
    renderSheet();
    const ids = new Set(audiencePrefixedIds());
    for (const expected of AUDIENCE_EDITABLE_IDS_CUSTOMER_LIST) {
      expect(ids.has(expected), `expected audience-prefixed id '${expected}' is missing`).toBe(
        true
      );
    }
  });

  it("AUDIENCE_STANDARD_FIELDS covers the base manifest field set", () => {
    const known: readonly string[] = AUDIENCE_STANDARD_FIELDS;
    for (const field of [
      "name",
      "code",
      "type",
      "description",
      "customerAudienceId",
      "triggerOnEnter",
      "triggerOnExit",
    ]) {
      expect(known.includes(field), `'${field}' missing from AUDIENCE_STANDARD_FIELDS`).toBe(true);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────
// L1 — Direction C: discriminator-gated rendering. The defining audit
// assertion for polymorphic entities. THREADS-only + EXPRESSION-only fields
// render under their branch and disappear when the type changes.
// ─────────────────────────────────────────────────────────────────────────

describe("[audit] L1 Direction C — discriminator-gated field rendering", () => {
  it("CUSTOMER_LIST: renders neither the segment builder nor THREADS config fields", () => {
    renderSheet();
    expect(document.querySelector("#segment-expression-builder")).toBeNull();
    expect(document.querySelector("#audience-behaviors")).toBeNull();
    expect(document.querySelector("#audience-target-size")).toBeNull();
  });

  it("EXPRESSION: renders the segment expression builder slot", () => {
    renderSheet();
    selectType(/^Customer Segment$/i);
    expect(document.querySelector("#segment-expression-builder")).not.toBeNull();
    expect(document.querySelector("#audience-behaviors")).toBeNull();
  });

  it("THREADS: renders seedBehaviors + targetSizeHint config fields", () => {
    renderSheet();
    selectType(/^THREADS Segment$/i);
    const behaviors = document.querySelector("#audience-behaviors");
    const targetSize = document.querySelector("#audience-target-size");
    expect(behaviors?.getAttribute("data-widget")).toBe("text-input");
    expect(targetSize?.getAttribute("data-widget")).toBe("text-input");
    expect(document.querySelector("#segment-expression-builder")).toBeNull();
  });

  it("toggling the type selector swaps the gated branch (THREADS → CUSTOMER_LIST)", () => {
    renderSheet();
    selectType(/^THREADS Segment$/i);
    expect(document.querySelector("#audience-behaviors")).not.toBeNull();

    selectType(/^Customer List$/i);
    expect(document.querySelector("#audience-behaviors")).toBeNull();
    expect(document.querySelector("#audience-target-size")).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────
// L3 — Behavior. Form submit per type branch, description handling, error
// surfacing, edit-mode prefill.
// ─────────────────────────────────────────────────────────────────────────

describe("[audit] L3 — AudienceFormSheet behavior", () => {
  it("renders trigger switches unchecked by default and submits their selected values", async () => {
    const { onSubmit } = renderSheet();
    fireEvent.change(screen.getByLabelText(/^Name/i, { selector: "input" }), {
      target: { value: "VIP Shoppers" },
    });

    const triggerOnEnter = screen.getByLabelText(/^Trigger On Enter$/i);
    const triggerOnExit = screen.getByLabelText(/^Trigger On Exit$/i);
    expect(triggerOnEnter).toHaveAttribute("data-state", "unchecked");
    expect(triggerOnExit).toHaveAttribute("data-state", "unchecked");

    fireEvent.click(triggerOnEnter);
    fireEvent.click(screen.getByRole("button", { name: /^Create Audience$/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));

    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({
      triggerOnEnter: true,
      triggerOnExit: false,
    });
  });

  it("submits a CUSTOMER_LIST payload with required fields", async () => {
    const { onSubmit } = renderSheet();
    fireEvent.change(screen.getByLabelText(/^Name/i, { selector: "input" }), {
      target: { value: "VIP Shoppers" },
    });

    fireEvent.click(screen.getByRole("button", { name: /^Create Audience$/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));

    const payload = onSubmit.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload).toMatchObject({
      name: "VIP Shoppers",
      code: "vip-shoppers",
      type: "CUSTOMER_LIST",
    });
    expect(payload.engine).toBeUndefined();
  });

  it("submits a CUSTOMER_SEGMENT/CLICKHOUSE payload for the EXPRESSION branch", async () => {
    const { onSubmit } = renderSheet();
    fireEvent.change(screen.getByLabelText(/^Name/i, { selector: "input" }), {
      target: { value: "Big Spenders" },
    });
    selectType(/^Customer Segment$/i);
    // Drive the render-slot builder so a segment expression is captured.
    fireEvent.click(screen.getByTestId("segment-builder-stub"));

    fireEvent.click(screen.getByRole("button", { name: /^Create Audience$/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));

    const payload = onSubmit.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload).toMatchObject({
      name: "Big Spenders",
      type: "CUSTOMER_SEGMENT",
      engine: "CLICKHOUSE",
    });
    expect(payload).toHaveProperty("segmentExpression");
    expect(payload.segmentExpression).not.toBeNull();
  });

  it("submits a CUSTOMER_SEGMENT/THREADS payload with parsed engineConfig", async () => {
    const { onSubmit } = renderSheet();
    fireEvent.change(screen.getByLabelText(/^Name/i, { selector: "input" }), {
      target: { value: "AI Cluster" },
    });
    selectType(/^THREADS Segment$/i);
    fireEvent.change(document.querySelector("#audience-behaviors") as HTMLInputElement, {
      target: { value: "purchase, browse , wishlist" },
    });
    fireEvent.change(document.querySelector("#audience-target-size") as HTMLInputElement, {
      target: { value: "2500" },
    });

    fireEvent.click(screen.getByRole("button", { name: /^Create Audience$/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));

    const payload = onSubmit.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload).toMatchObject({ type: "CUSTOMER_SEGMENT", engine: "THREADS" });
    expect(payload.engineConfig).toEqual({
      seedBehaviors: ["purchase", "browse", "wishlist"],
      targetSizeHint: 2500,
    });
  });

  it("includes description when filled", async () => {
    const { onSubmit } = renderSheet();
    fireEvent.change(screen.getByLabelText(/^Name/i, { selector: "input" }), {
      target: { value: "Documented" },
    });
    fireEvent.change(screen.getByLabelText(/^Description$/i), {
      target: { value: "High-value repeat buyers" },
    });

    fireEvent.click(screen.getByRole("button", { name: /^Create Audience$/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));

    const payload = onSubmit.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload.description).toEqual({ en: "High-value repeat buyers" });
  });

  it("surfaces the error prop in the FormSheet alert region", () => {
    renderSheet({ error: "Server returned 422 — code already exists" });
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toMatch(/Server returned 422/);
  });

  it("renders 'Save Changes' label and prefills name in edit mode", () => {
    const initial: CustomerAudience = {
      customerAudienceId: "aud_00000000000000000000000000000003",
      customerListId: "lst_00000000000000000000000000000003",
      code: "vip",
      name: "VIP Members",
      type: "CUSTOMER_LIST",
    };
    renderSheet({ mode: "edit", initialData: initial });
    expect(screen.getByRole("button", { name: /^Save Changes$/i })).toBeInTheDocument();
    expect((screen.getByLabelText(/^Name/i, { selector: "input" }) as HTMLInputElement).value).toBe(
      "VIP Members"
    );
  });
});

describe("[audit] tenant extension fields (L1 Direction B non-orphan + L3 dispatch)", () => {
  it("does not render an ExtendedFieldsSection without schema + extendedFields props", () => {
    renderSheet();
    expect(document.querySelector("[data-extended-section]")).toBeNull();
  });

  it("does not render the section when extendedFields is empty even if schema is present", () => {
    renderSheet({ schema: SCHEMA_WITH_EXTENSION, extendedFields: [] });
    expect(document.querySelector("[data-extended-section]")).toBeNull();
  });

  it("renders the ExtendedFieldsSection when schema + extendedFields are provided", () => {
    renderSheet({ schema: SCHEMA_WITH_EXTENSION, extendedFields: ["loyaltyTier"] });
    expect(document.querySelector("[data-extended-section]")).not.toBeNull();
    expect(document.querySelector("#field-loyaltyTier")).not.toBeNull();
  });

  it("threads an edited extension field value into the submit payload", async () => {
    const { onSubmit } = renderSheet({
      schema: SCHEMA_WITH_EXTENSION,
      extendedFields: ["loyaltyTier"],
    });
    fireEvent.change(screen.getByLabelText(/^Name/i, { selector: "input" }), {
      target: { value: "VIP Shoppers" },
    });
    fireEvent.change(document.querySelector("#field-loyaltyTier") as HTMLInputElement, {
      target: { value: "gold" },
    });

    fireEvent.click(screen.getByRole("button", { name: /^Create Audience$/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));

    const payload = onSubmit.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload).toMatchObject({
      name: "VIP Shoppers",
      type: "CUSTOMER_LIST",
      loyaltyTier: "gold",
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────
// L3 — Unit 2 (R2a/R2b): the outer Save button must reflect the segment
// builder's OWN validity at all times, not only its nested modal's internal
// Save — closes the gap where touching only an unrelated field (e.g. Trigger
// On Enter) could submit an audience carrying an already-invalid persisted
// expression. Stands in for the real SegmentExpressionPanel's
// onValidityChange wiring (tested for real in segment-expression-panel.test.tsx).
// ─────────────────────────────────────────────────────────────────────────

/**
 * Reports `initialValid` the moment it mounts (mirroring SegmentExpressionPanel's
 * mount-time effect) and flips to valid when clicked — standing in for "the user
 * opened the nested modal, fixed the expression, and clicked its own Save".
 */
function ValidityReportingStub({
  initialValid,
  onValidityChange,
}: {
  initialValid: boolean;
  onValidityChange?: (isValid: boolean) => void;
}): ReactNode {
  const [valid, setValid] = useState(initialValid);
  useEffect(() => {
    onValidityChange?.(valid);
  }, [valid, onValidityChange]);
  return (
    <button type="button" data-testid="segment-builder-stub" onClick={() => setValid(true)}>
      {valid ? "Segment valid" : "Segment invalid"}
    </button>
  );
}

function renderSheetWithValidityStub(initialValid: boolean) {
  return renderSheet({
    renderSegmentBuilder: ({ onValidityChange }) => (
      <ValidityReportingStub initialValid={initialValid} onValidityChange={onValidityChange} />
    ),
  });
}

describe("[audit] L3 — Unit 2: outer Save gate reflects segment validity", () => {
  it("keeps Save enabled for the default happy-path valid expression", () => {
    renderSheetWithValidityStub(true);
    fireEvent.change(screen.getByLabelText(/^Name/i, { selector: "input" }), {
      target: { value: "Big Spenders" },
    });
    selectType(/^Customer Segment$/i);

    expect(screen.getByRole("button", { name: /^Create Audience$/i })).not.toBeDisabled();
  });

  it("disables Save immediately when opened with an already-invalid persisted expression, before any interaction", () => {
    renderSheetWithValidityStub(false);
    selectType(/^Customer Segment$/i);

    expect(screen.getByRole("button", { name: /^Create Audience$/i })).toBeDisabled();
  });

  it("keeps Save disabled after touching only an unrelated field — the direct regression test for the original bug", () => {
    renderSheetWithValidityStub(false);
    selectType(/^Customer Segment$/i);

    fireEvent.click(screen.getByLabelText(/^Trigger On Enter$/i));

    expect(screen.getByRole("button", { name: /^Create Audience$/i })).toBeDisabled();
  });

  it("re-enables Save once the segment builder reports the expression fixed", () => {
    renderSheetWithValidityStub(false);
    selectType(/^Customer Segment$/i);
    expect(screen.getByRole("button", { name: /^Create Audience$/i })).toBeDisabled();

    fireEvent.click(screen.getByTestId("segment-builder-stub"));

    expect(screen.getByRole("button", { name: /^Create Audience$/i })).not.toBeDisabled();
  });

  it("re-enables Save after switching the type away from Customer Segment, even though the segment builder never reported a fix (code review finding)", () => {
    renderSheetWithValidityStub(false);
    selectType(/^Customer Segment$/i);
    expect(screen.getByRole("button", { name: /^Create Audience$/i })).toBeDisabled();

    selectType(/^Customer List$/i);

    expect(screen.getByRole("button", { name: /^Create Audience$/i })).not.toBeDisabled();
  });
});
