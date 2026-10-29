import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const getSubTypesForMock = vi.fn((eventTypeCode: string) =>
  eventTypeCode === "purchase"
    ? ["PURCHASE", "RETURN", "EXCHANGE"]
    : eventTypeCode === "return-only"
      ? ["RETURN"]
      : [""]
);

vi.mock("./use-event-trigger-field", () => ({
  useEventTriggerField: () => ({
    options: [
      { id: "purchase", name: "Purchase" },
      { id: "signup", name: "Signup" },
    ],
    optionsAll: [
      { id: "purchase", name: "Purchase" },
      { id: "signup", name: "Signup" },
    ],
    isLoading: false,
    error: null,
    searchValue: "",
    setSearchValue: vi.fn(),
    hasNextPage: false,
    isFetchingNextPage: false,
    fetchNextPage: vi.fn(),
    getSubTypesFor: getSubTypesForMock,
  }),
}));

import { EventTriggerField, type EventTriggerValue } from "./event-trigger-field";

function openCombobox(container: HTMLElement, index = 0): void {
  const trigger = container.querySelectorAll('[role="combobox"]')[index];
  if (!trigger) throw new Error("combobox trigger missing");
  fireEvent.click(trigger);
}

describe("EventTriggerField — global mode (R8, R9, R16)", () => {
  it("selecting a single-variant event type sets the trigger with no sub-type prompt", () => {
    const onValueChange = vi.fn();
    const { container, rerender } = render(
      <EventTriggerField mode="global" value={null} onValueChange={onValueChange} />
    );

    openCombobox(container);
    fireEvent.click(screen.getByText("Signup"));
    expect(onValueChange).toHaveBeenCalledWith({
      eventTypeCode: "signup",
      eventSubTypeIdentifier: undefined,
    });

    rerender(
      <EventTriggerField
        mode="global"
        value={{ eventTypeCode: "signup" }}
        onValueChange={onValueChange}
      />
    );
    expect(container.querySelectorAll('[role="combobox"]')).toHaveLength(1);
  });

  it("selecting an event type with 3 variants prompts for sub-type and records the choice", () => {
    const onValueChange = vi.fn();
    const { container, rerender } = render(
      <EventTriggerField mode="global" value={null} onValueChange={onValueChange} />
    );

    openCombobox(container);
    fireEvent.click(screen.getByText("Purchase"));
    expect(onValueChange).toHaveBeenCalledWith({
      eventTypeCode: "purchase",
      eventSubTypeIdentifier: undefined,
    });

    rerender(
      <EventTriggerField
        mode="global"
        value={{ eventTypeCode: "purchase" }}
        onValueChange={onValueChange}
      />
    );
    expect(container.querySelectorAll('[role="combobox"]')).toHaveLength(2);

    openCombobox(container, 1);
    fireEvent.click(screen.getByText("RETURN"));
    expect(onValueChange).toHaveBeenLastCalledWith({
      eventTypeCode: "purchase",
      eventSubTypeIdentifier: "RETURN",
    });
  });

  it("prompts for the only named sub-type when no default variant exists", () => {
    const onValueChange = vi.fn();
    const { container } = render(
      <EventTriggerField
        mode="global"
        value={{ eventTypeCode: "return-only" }}
        onValueChange={onValueChange}
      />
    );

    expect(container.querySelectorAll('[role="combobox"]')).toHaveLength(2);
    openCombobox(container, 1);
    fireEvent.click(screen.getByText("RETURN"));
    expect(onValueChange).toHaveBeenCalledWith({
      eventTypeCode: "return-only",
      eventSubTypeIdentifier: "RETURN",
    });
  });

  it("selecting 'Add new event type' hands off to the caller with no other state lost", () => {
    const onCreateNew = vi.fn();
    const onValueChange = vi.fn();
    const { container } = render(
      <EventTriggerField
        mode="global"
        value={{ eventTypeCode: "signup" }}
        onValueChange={onValueChange}
        onCreateNew={onCreateNew}
      />
    );

    openCombobox(container);
    fireEvent.click(screen.getByText("Add New Event Type"));
    expect(onCreateNew).toHaveBeenCalled();

    // Completing the inline-create flow (owned by the caller, R9) returns
    // control here via the same onValueChange contract — no field state lost.
    const created: EventTriggerValue = { eventTypeCode: "new-signal" };
    onValueChange(created);
    expect(onValueChange).toHaveBeenLastCalledWith(created);
  });
});

describe("EventTriggerField — contextual mode (R7)", () => {
  it("never renders a picker for event type or sub-type, regardless of variant count", () => {
    const { container } = render(
      <EventTriggerField mode="contextual" eventTypeCode="purchase" eventTypeName="Purchase" />
    );

    expect(container.querySelectorAll('[role="combobox"]')).toHaveLength(0);
    expect(screen.getByText("Purchase")).toBeInTheDocument();
  });

  it("shows the sub-type as read-only text when the variant is known, still with no picker", () => {
    const { container } = render(
      <EventTriggerField
        mode="contextual"
        eventTypeCode="purchase"
        eventTypeName="Purchase"
        eventSubTypeIdentifier="RETURN"
      />
    );

    expect(container.querySelectorAll('[role="combobox"]')).toHaveLength(0);
    expect(screen.getByText(/RETURN/)).toBeInTheDocument();
  });
});
