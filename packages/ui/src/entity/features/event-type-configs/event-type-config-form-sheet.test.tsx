import type { EventTypeConfiguration } from "@loom-loyalty/sdk";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// Stub MetadataField so this suite never hits the real SDK/react-query. The
// mock forwards `disabled` as both a real `disabled` attribute (so
// `.disabled` assertions work) and `data-disabled` (a debuggable escape
// hatch), and forwards `value`/`data-metadata-type` so the seeded event type
// code and field identity can be asserted directly.
vi.mock("../../../forms/metadata-field/index.js", () => ({
  MetadataField: ({
    typeCode,
    value,
    onValueChange,
    disabled,
    placeholder,
  }: {
    typeCode: string;
    value: string;
    onValueChange: (v: string, isSuggested: boolean) => void;
    disabled?: boolean;
    placeholder?: string;
  }) => (
    <input
      data-widget="metadata-select"
      data-metadata-type={typeCode}
      data-disabled={disabled ? "true" : "false"}
      value={value}
      disabled={disabled}
      placeholder={placeholder}
      onChange={(e) => onValueChange(e.target.value, false)}
    />
  ),
  useMetadataField: () => ({
    createMetadata: vi.fn().mockResolvedValue(undefined),
    findOption: () => undefined,
    isTypeNotFound: false,
  }),
}));

import { EventTypeConfigFormSheet, getInitialEventTypeCode } from "./event-type-config-form-sheet";
import type { EventTypeConfigFormSheetProps } from "./types";

function makeConfig(overrides: Partial<EventTypeConfiguration>): EventTypeConfiguration {
  return {
    eventTypeConfigurationId: "etcfg_00000000000000000000000000000001",
    code: "PURCHASE_CFG",
    name: "Purchase Config",
    eventTypeCode: "",
    ...overrides,
  } as EventTypeConfiguration;
}

function renderSheet(overrides: Partial<EventTypeConfigFormSheetProps> = {}) {
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  const onOpenChange = vi.fn();
  const result = render(
    <EventTypeConfigFormSheet
      open
      onOpenChange={onOpenChange}
      mode="create"
      onSubmit={onSubmit}
      {...overrides}
    />
  );
  return { ...result, onSubmit, onOpenChange };
}

function getEventTypeField(): HTMLInputElement {
  return screen.getByPlaceholderText(/Select event type/i) as HTMLInputElement;
}

describe("getInitialEventTypeCode", () => {
  it("prefers populated eventTypeCode when present", () => {
    const cfg = makeConfig({
      eventTypeCode: "PURCHASE",
      eventType: { code: "OTHER" } as EventTypeConfiguration["eventType"],
    });
    expect(getInitialEventTypeCode(cfg)).toBe("PURCHASE");
  });

  it("falls back to eventType.code when eventTypeCode is empty (regression for blank edit form)", () => {
    const cfg = makeConfig({
      eventTypeCode: "",
      eventType: { code: "PURCHASE" } as EventTypeConfiguration["eventType"],
    });
    expect(getInitialEventTypeCode(cfg)).toBe("PURCHASE");
  });

  it("returns empty string when no initialData", () => {
    expect(getInitialEventTypeCode(undefined)).toBe("");
  });

  it("returns empty string when both fields are missing", () => {
    expect(getInitialEventTypeCode(makeConfig({}))).toBe("");
  });
});

// ─────────────────────────────────────────────────────────────────────────
// R7 / KTD4 — `lockEventType` pre-binds and disables the Event Type field on
// the create form so a caller opening "+ Add Configuration" from an anchor
// can seed `initialData.eventTypeCode` without the user being able to change
// it away from the anchor they opened it from.
// ─────────────────────────────────────────────────────────────────────────

describe("EventTypeConfigFormSheet — lockEventType", () => {
  it("disables the Event Type field and shows the seeded value when lockEventType is true in create mode", () => {
    renderSheet({
      mode: "create",
      lockEventType: true,
      initialData: makeConfig({ eventTypeCode: "PURCHASE" }),
    });
    const field = getEventTypeField();
    expect(field.disabled).toBe(true);
    expect(field.getAttribute("data-disabled")).toBe("true");
    expect(field.value).toBe("PURCHASE");
  });

  it("leaves the Event Type field freely editable when lockEventType is omitted (today's behavior)", () => {
    renderSheet({ mode: "create" });
    const field = getEventTypeField();
    expect(field.disabled).toBe(false);
    expect(field.getAttribute("data-disabled")).toBe("false");
  });

  it("leaves the Event Type field freely editable when lockEventType is explicitly false", () => {
    renderSheet({
      mode: "create",
      lockEventType: false,
      initialData: makeConfig({ eventTypeCode: "PURCHASE" }),
    });
    const field = getEventTypeField();
    expect(field.disabled).toBe(false);
  });

  it("does not lock the Event Type field in edit mode even when lockEventType is true (create-only per KTD4)", () => {
    renderSheet({
      mode: "edit",
      lockEventType: true,
      initialData: makeConfig({ eventTypeCode: "PURCHASE" }),
    });
    const field = getEventTypeField();
    expect(field.disabled).toBe(false);
  });
});
