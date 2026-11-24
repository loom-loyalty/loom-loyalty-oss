import type { EventTypeConfiguration } from "@loom-loyalty/sdk";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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

const sourceByEventType: Record<string, string | undefined> = {};
vi.mock("../../../forms/event-sub-type-field/use-event-type-sub-type-source.js", () => ({
  useEventTypeSubTypeSource: (eventTypeCode: string | undefined) => ({
    source: eventTypeCode ? sourceByEventType[eventTypeCode] : undefined,
    isLoading: false,
  }),
}));

vi.mock("../../../forms/event-sub-type-field/event-sub-type-field.js", () => ({
  EventSubTypeField: (props: {
    id?: string;
    source: string;
    value: string;
    onValueChange: (code: string) => void;
  }) => (
    <button
      type="button"
      id={props.id}
      data-testid="sub-type-source-picker"
      data-source={props.source}
      data-value={props.value}
      onClick={() => props.onValueChange("TG002")}
    >
      source picker
    </button>
  ),
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

describe("EventTypeConfigFormSheet — sub type from the event type's source", () => {
  it("shows a target picker for target.achieved and saves the picked target's code", async () => {
    sourceByEventType["target.achieved"] = "TARGET";
    const { onSubmit } = renderSheet({
      mode: "edit",
      initialData: makeConfig({
        eventTypeCode: "target.achieved",
        eventSubTypeIdentifier: "TG001",
      }),
    });
    expect(screen.getByText("Sub Type (target)")).toBeInTheDocument();
    const picker = screen.getByTestId("sub-type-source-picker");
    expect(picker.dataset.source).toBe("TARGET");
    expect(picker.dataset.value).toBe("TG001");
    expect(screen.queryByPlaceholderText(/sub type/i)).toBeNull();

    fireEvent.click(picker);
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({
      eventTypeCode: "target.achieved",
      eventSubTypeIdentifier: "TG002",
    });
    delete sourceByEventType["target.achieved"];
  });

  it("keeps the free-text box for a type without a source", () => {
    renderSheet({ mode: "edit", initialData: makeConfig({ eventTypeCode: "transaction" }) });
    expect(screen.getByText("Sub Type Identifier")).toBeInTheDocument();
    expect(screen.queryByTestId("sub-type-source-picker")).toBeNull();
  });

  it("clears the sub type when the event type changes, since it named the old type's record", async () => {
    sourceByEventType["target.achieved"] = "TARGET";
    renderSheet({
      mode: "create",
      initialData: makeConfig({ eventTypeCode: "target.achieved" }),
    });
    fireEvent.click(screen.getByTestId("sub-type-source-picker"));
    expect(screen.getByTestId("sub-type-source-picker").dataset.value).toBe("TG002");

    fireEvent.change(getEventTypeField(), { target: { value: "transaction" } });
    const freeText = screen.getByLabelText("Sub Type Identifier") as HTMLInputElement;
    expect(freeText.value).toBe("");
    delete sourceByEventType["target.achieved"];
  });
});
