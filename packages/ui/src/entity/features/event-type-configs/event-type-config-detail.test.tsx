import type { EventTypeConfiguration } from "@loom-loyalty/sdk";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { EventTypeConfigDetail } from "./event-type-config-detail";
import type { EventTypeVariant } from "./types";

// Per-variant field rendering (Basic Information, Event Type badge, Processing
// Settings, Edit/Delete, etc.) was removed from this component (R8) — it now
// opens as a separate, stacked `EventTypeConfigDetailSheet` instead of
// rendering inline here. That coverage lives in
// `event-type-config-detail-sheet.test.tsx`.

function makeConfig(overrides: Partial<EventTypeConfiguration>): EventTypeConfiguration {
  return {
    eventTypeConfigurationId: "etcfg_00000000000000000000000000000001",
    code: "PURCHASE_CFG",
    name: "Purchase Config",
    eventTypeCode: "",
    ...overrides,
  } as EventTypeConfiguration;
}

describe("EventTypeConfigDetail — Identity section (R1, R3)", () => {
  it("renders Identity only when eventTypeIdentity is provided", () => {
    const { rerender } = render(<EventTypeConfigDetail />);
    expect(screen.queryByText("Identity")).not.toBeInTheDocument();

    rerender(
      <EventTypeConfigDetail
        eventTypeIdentity={{ name: "Purchase", code: "purchase", dataModelCode: "purchase_v1" }}
      />
    );
    expect(screen.getByText("Identity")).toBeInTheDocument();
    expect(screen.getByText("purchase_v1")).toBeInTheDocument();
  });
});

describe("EventTypeConfigDetail — Configuration Variants (R2)", () => {
  function variant(overrides: Partial<EventTypeVariant> = {}): EventTypeVariant {
    return {
      eventSubTypeIdentifier: "",
      configuration: makeConfig({}),
      ...overrides,
    };
  }

  it("renders a single default variant row rather than an empty list", () => {
    render(<EventTypeConfigDetail variants={[variant()]} />);
    expect(screen.getByText("Default")).toBeInTheDocument();
  });

  it("renders every sub-type variant and calls onSelectVariant when a row is clicked", () => {
    const onSelectVariant = vi.fn();
    render(
      <EventTypeConfigDetail
        variants={[
          variant({ eventSubTypeIdentifier: "PURCHASE" }),
          variant({ eventSubTypeIdentifier: "RETURN" }),
        ]}
        onSelectVariant={onSelectVariant}
      />
    );
    expect(screen.getByText("PURCHASE")).toBeInTheDocument();
    expect(screen.getByText("RETURN")).toBeInTheDocument();
    screen.getByText("RETURN").closest("button")?.click();
    expect(onSelectVariant).toHaveBeenCalledWith(
      expect.objectContaining({ eventSubTypeIdentifier: "RETURN" })
    );
  });

  it("renders an empty-configuration message for a zero-variant anchor", () => {
    render(<EventTypeConfigDetail variants={[]} />);
    expect(screen.getByText("No configuration yet for this event type.")).toBeInTheDocument();
  });

  it("renders a per-variant '+ New rule' entry point that calls onNewRule with that variant (KTD3)", () => {
    const onNewRule = vi.fn();
    render(
      <EventTypeConfigDetail
        variants={[
          variant({ eventSubTypeIdentifier: "PURCHASE" }),
          variant({ eventSubTypeIdentifier: "RETURN" }),
        ]}
        onNewRule={onNewRule}
      />
    );
    const buttons = screen.getAllByRole("button", { name: /New rule for/ });
    expect(buttons).toHaveLength(2);
    buttons[1]!.click();
    expect(onNewRule).toHaveBeenCalledWith(
      expect.objectContaining({ eventSubTypeIdentifier: "RETURN" })
    );
  });

  it("omits the '+ New rule' entry point when onNewRule is not provided", () => {
    render(<EventTypeConfigDetail variants={[variant()]} />);
    expect(screen.queryByRole("button", { name: /New rule for/ })).not.toBeInTheDocument();
  });

  it("renders a per-variant 'Enable in Environment' entry point that calls onEnableVariant with that variant", () => {
    const onEnableVariant = vi.fn();
    render(
      <EventTypeConfigDetail
        variants={[
          variant({ eventSubTypeIdentifier: "PURCHASE" }),
          variant({ eventSubTypeIdentifier: "RETURN" }),
        ]}
        onEnableVariant={onEnableVariant}
      />
    );
    const buttons = screen.getAllByRole("button", { name: /Enable .* in environment/ });
    expect(buttons).toHaveLength(2);
    buttons[1]!.click();
    expect(onEnableVariant).toHaveBeenCalledWith(
      expect.objectContaining({ eventSubTypeIdentifier: "RETURN" })
    );
  });

  it("omits the 'Enable in Environment' entry point when onEnableVariant is not provided", () => {
    render(<EventTypeConfigDetail variants={[variant()]} />);
    expect(
      screen.queryByRole("button", { name: /Enable .* in environment/ })
    ).not.toBeInTheDocument();
  });

  it("renders a trailing '+ Add Configuration' entry point after the variants list and calls onAddConfiguration (R6)", () => {
    const onAddConfiguration = vi.fn();
    render(
      <EventTypeConfigDetail
        variants={[variant({ eventSubTypeIdentifier: "PURCHASE" })]}
        onAddConfiguration={onAddConfiguration}
      />
    );
    const button = screen.getByRole("button", { name: "Add Configuration" });
    expect(button).toBeInTheDocument();
    button.click();
    expect(onAddConfiguration).toHaveBeenCalledTimes(1);
  });

  it("renders '+ Add Configuration' even for a zero-variant anchor, so the first configuration can be added", () => {
    const onAddConfiguration = vi.fn();
    render(<EventTypeConfigDetail variants={[]} onAddConfiguration={onAddConfiguration} />);
    expect(screen.getByRole("button", { name: "Add Configuration" })).toBeInTheDocument();
  });

  it("omits the '+ Add Configuration' entry point when onAddConfiguration is not provided", () => {
    render(<EventTypeConfigDetail variants={[variant()]} />);
    expect(screen.queryByRole("button", { name: "Add Configuration" })).not.toBeInTheDocument();
  });

  it("does not mark the Default variant as selected when selectedEventSubTypeIdentifier is omitted", () => {
    // The Default variant's own eventSubTypeIdentifier is "" — omitting the
    // prop (meaning "no stacked sheet is open") must not collide with that
    // and render it pre-selected.
    render(<EventTypeConfigDetail variants={[variant()]} onSelectVariant={vi.fn()} />);
    expect(screen.getByText("Default").closest("button")).not.toHaveAttribute("aria-current");
  });

  it("marks only the variant matching an explicitly passed selectedEventSubTypeIdentifier", () => {
    render(
      <EventTypeConfigDetail
        variants={[
          variant({ eventSubTypeIdentifier: "PURCHASE" }),
          variant({ eventSubTypeIdentifier: "RETURN" }),
        ]}
        selectedEventSubTypeIdentifier="RETURN"
        onSelectVariant={vi.fn()}
      />
    );
    expect(screen.getByText("PURCHASE").closest("button")).not.toHaveAttribute("aria-current");
    expect(screen.getByText("RETURN").closest("button")).toHaveAttribute("aria-current", "true");
  });
});
