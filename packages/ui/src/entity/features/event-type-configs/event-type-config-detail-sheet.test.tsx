import type { EventRule, EventTypeConfiguration } from "@loom-loyalty/sdk";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { EventTypeConfigDetailSheet } from "./event-type-config-detail-sheet";
import type { EventTypeVariant } from "./types";

function makeConfig(overrides: Partial<EventTypeConfiguration>): EventTypeConfiguration {
  return {
    eventTypeConfigurationId: "etcfg_00000000000000000000000000000001",
    code: "PURCHASE_CFG",
    name: "Purchase Config",
    eventTypeCode: "purchase",
    ...overrides,
  } as EventTypeConfiguration;
}

function makeVariant(overrides: Partial<EventTypeVariant> = {}): EventTypeVariant {
  return {
    eventSubTypeIdentifier: "PURCHASE",
    configuration: makeConfig({ eventSubTypeIdentifier: "PURCHASE" }),
    ...overrides,
  };
}

function rule(overrides: Partial<EventRule>): EventRule {
  return {
    eventRuleId: "er_1",
    code: "RULE_1",
    name: "Rule One",
    eventTypeCode: "purchase",
    category: "ORGANIZATION_DEFINED",
    programIds: [],
    ...overrides,
  } as EventRule;
}

describe("EventTypeConfigDetailSheet — rendering the configuration's own fields (AE5)", () => {
  it("renders nothing in the body when no variant is selected", () => {
    render(<EventTypeConfigDetailSheet open onOpenChange={vi.fn()} variant={null} rules={[]} />);
    expect(screen.queryByText("Basic Information")).not.toBeInTheDocument();
  });

  it("renders the resolved Event Type name from eventType (regression for empty badge)", () => {
    const variant = makeVariant({
      configuration: makeConfig({
        eventType: { name: "Purchase", code: "PURCHASE" } as EventTypeConfiguration["eventType"],
      }),
    });
    render(<EventTypeConfigDetailSheet open onOpenChange={vi.fn()} variant={variant} rules={[]} />);
    const labels = screen.getAllByText("Event Type");
    const eventTypeBlock = labels[0]?.parentElement;
    expect(eventTypeBlock?.textContent).toContain("Purchase");
  });

  it("renders an em-dash when both eventType and eventTypeCode are missing", () => {
    const variant = makeVariant({ configuration: makeConfig({ eventTypeCode: "" }) });
    render(<EventTypeConfigDetailSheet open onOpenChange={vi.fn()} variant={variant} rules={[]} />);
    const labels = screen.getAllByText("Event Type");
    const eventTypeBlock = labels[0]?.parentElement;
    expect(eventTypeBlock?.textContent).toContain("—");
  });

  it("shows the configuration's name in the sheet title and Basic Information", () => {
    const variant = makeVariant({ configuration: makeConfig({ name: "Purchase Config" }) });
    render(<EventTypeConfigDetailSheet open onOpenChange={vi.fn()} variant={variant} rules={[]} />);
    expect(screen.getAllByText("Purchase Config").length).toBeGreaterThan(0);
  });
});

describe("EventTypeConfigDetailSheet — Edit/Delete action buttons", () => {
  it("calls onEdit and onDelete (moved here from EventTypeConfigDetail, R8)", () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    render(
      <EventTypeConfigDetailSheet
        open
        onOpenChange={vi.fn()}
        variant={makeVariant()}
        rules={[]}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    );
    screen.getByRole("button", { name: "Edit" }).click();
    expect(onEdit).toHaveBeenCalledTimes(1);
    screen.getByRole("button", { name: "Delete" }).click();
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it("omits action buttons when canEdit and canDelete are false", () => {
    render(
      <EventTypeConfigDetailSheet
        open
        onOpenChange={vi.fn()}
        variant={makeVariant()}
        rules={[]}
        canEdit={false}
        canDelete={false}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />
    );
    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
  });
});

describe("EventTypeConfigDetailSheet — dependents scoped to this configuration (R9, AE6)", () => {
  it("renders only the rules passed in (scoping is the caller's responsibility)", () => {
    render(
      <EventTypeConfigDetailSheet
        open
        onOpenChange={vi.fn()}
        variant={makeVariant()}
        rules={[rule({ eventRuleId: "er_purchase", name: "Award purchase points" })]}
      />
    );
    expect(screen.getByText("Award purchase points")).toBeInTheDocument();
  });

  it("shows the scoped empty state when this configuration has zero dependent rules", () => {
    render(
      <EventTypeConfigDetailSheet open onOpenChange={vi.fn()} variant={makeVariant()} rules={[]} />
    );
    expect(screen.getByText("No rules reference this event type yet.")).toBeInTheDocument();
  });

  it("shows the flows not-yet-available placeholder unscoped (R9)", () => {
    render(
      <EventTypeConfigDetailSheet open onOpenChange={vi.fn()} variant={makeVariant()} rules={[]} />
    );
    expect(screen.getByText(/Not available yet/)).toBeInTheDocument();
  });
});

describe("EventTypeConfigDetailSheet — loading and error states (forwarded to EventTypeDependents, same handling as the anchor sheet's unscoped section)", () => {
  it("shows the Referenced-by section's loading state while the initial dependents fetch is in flight", () => {
    render(
      <EventTypeConfigDetailSheet
        open
        onOpenChange={vi.fn()}
        variant={makeVariant()}
        rules={[]}
        dependentsLoading
        onEdit={vi.fn()}
      />
    );
    expect(screen.getByText("Loading rules…")).toBeInTheDocument();
    // The configuration's own fields are already loaded synchronously — they
    // don't wait on the dependents fetch, so a slow/failed fetch can't hide
    // Edit/Delete.
    expect(screen.getByText("Basic Information")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
  });

  it("shows an inline error (not a spinner or toast) for the Referenced-by section when the dependents fetch fails, with retry", () => {
    const onEdit = vi.fn();
    const onRetryDependents = vi.fn();
    render(
      <EventTypeConfigDetailSheet
        open
        onOpenChange={vi.fn()}
        variant={makeVariant()}
        rules={[]}
        dependentsError
        onRetryDependents={onRetryDependents}
        onEdit={onEdit}
      />
    );
    expect(screen.getByRole("alert")).toBeInTheDocument();
    // The fields and Edit/Delete still render — only the Referenced-by
    // section shows the error state.
    expect(screen.getByText("Basic Information")).toBeInTheDocument();
    screen.getByRole("button", { name: "Edit" }).click();
    expect(onEdit).toHaveBeenCalledTimes(1);
    screen.getByText("Retry").click();
    expect(onRetryDependents).toHaveBeenCalledTimes(1);
  });
});
