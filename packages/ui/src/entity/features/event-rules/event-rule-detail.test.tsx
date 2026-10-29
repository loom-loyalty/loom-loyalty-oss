// EventRuleDetail version-lifecycle actions (U3): button gating, the
// PUBLISHED-vs-"status unknown" indicator, and the always-available fallback
// for Create Version/Pause/Resume (KTD3 — the schema can't structurally
// distinguish DRAFT from PAUSED, so those three are gated by the caller's
// handler presence only, not by a live signal).

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import type { EntityRecord } from "../../entity-list.js";
import { EventRuleDetail } from "./event-rule-detail.js";

vi.mock("../../../forms/program-field/index.js", () => ({
  useProgramField: () => ({ options: [] }),
}));

function withQueryClient(ui: ReactNode): ReactNode {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{ui}</QueryClientProvider>;
}

const eventRule: EntityRecord = {
  eventRuleId: "er_001",
  name: "Double Points on Weekends",
  code: "double-points-weekends",
  category: "PROMOTION",
};

describe("EventRuleDetail version lifecycle (U3)", () => {
  it("renders no version status or actions when no version-lifecycle handler is passed", () => {
    render(withQueryClient(<EventRuleDetail eventRule={eventRule} />));

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "New Version" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Publish" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Pause" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Resume" })).not.toBeInTheDocument();
  });

  it("shows Create Version, Pause, and Resume unconditionally once wired (KTD3 fallback)", () => {
    render(
      withQueryClient(
        <EventRuleDetail
          eventRule={eventRule}
          canEdit
          onCreateVersion={vi.fn()}
          onPause={vi.fn()}
          onResume={vi.fn()}
        />
      )
    );

    // No isConfirmedPublished signal was passed — these three still render,
    // matching KTD3's "always available, rely on inline errors" fallback.
    expect(screen.getByRole("button", { name: "New Version" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pause" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Resume" })).toBeInTheDocument();
  });

  it("hides version-lifecycle actions when canEdit is false", () => {
    render(
      withQueryClient(
        <EventRuleDetail
          eventRule={eventRule}
          canEdit={false}
          onCreateVersion={vi.fn()}
          onPublish={vi.fn()}
          onPause={vi.fn()}
          onResume={vi.fn()}
        />
      )
    );

    expect(screen.queryByRole("button", { name: "New Version" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Publish" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Pause" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Resume" })).not.toBeInTheDocument();
  });

  it("hides Publish once the live signal confirms this record is already published", () => {
    render(
      withQueryClient(
        <EventRuleDetail
          eventRule={eventRule}
          canEdit
          onPublish={vi.fn()}
          isConfirmedPublished={true}
        />
      )
    );

    expect(screen.queryByRole("button", { name: "Publish" })).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Published");
  });

  it("shows Publish and a 'status unknown' indicator when not confirmed published", () => {
    render(
      withQueryClient(
        <EventRuleDetail
          eventRule={eventRule}
          canEdit
          onPublish={vi.fn()}
          isConfirmedPublished={false}
        />
      )
    );

    expect(screen.getByRole("button", { name: "Publish" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Status unknown");
  });

  it("shows the 'status unknown' indicator when isConfirmedPublished is undefined (loading)", () => {
    render(withQueryClient(<EventRuleDetail eventRule={eventRule} canEdit onPause={vi.fn()} />));

    expect(screen.getByRole("status")).toHaveTextContent("Status unknown");
  });

  it("shows a 'Draft' indicator when recentVersionStatusHint is 'draft'", () => {
    render(
      withQueryClient(
        <EventRuleDetail
          eventRule={eventRule}
          canEdit
          onPublish={vi.fn()}
          isConfirmedPublished={false}
          recentVersionStatusHint="draft"
        />
      )
    );

    expect(screen.getByRole("status")).toHaveTextContent("Draft");
  });

  it("shows a 'Paused' indicator when recentVersionStatusHint is 'paused'", () => {
    render(
      withQueryClient(
        <EventRuleDetail
          eventRule={eventRule}
          canEdit
          onPublish={vi.fn()}
          isConfirmedPublished={false}
          recentVersionStatusHint="paused"
        />
      )
    );

    expect(screen.getByRole("status")).toHaveTextContent("Paused");
  });

  it("ignores recentVersionStatusHint once isConfirmedPublished is true", () => {
    render(
      withQueryClient(
        <EventRuleDetail
          eventRule={eventRule}
          canEdit
          onPublish={vi.fn()}
          isConfirmedPublished={true}
          recentVersionStatusHint="paused"
        />
      )
    );

    expect(screen.getByRole("status")).toHaveTextContent("Published");
  });

  it("calls the corresponding handler when each version-lifecycle button is clicked", async () => {
    const user = userEvent.setup();
    const onPublish = vi.fn();
    const onCreateVersion = vi.fn();
    const onPause = vi.fn();
    const onResume = vi.fn();

    render(
      withQueryClient(
        <EventRuleDetail
          eventRule={eventRule}
          canEdit
          onPublish={onPublish}
          onCreateVersion={onCreateVersion}
          onPause={onPause}
          onResume={onResume}
          isConfirmedPublished={false}
        />
      )
    );

    await user.click(screen.getByRole("button", { name: "New Version" }));
    await user.click(screen.getByRole("button", { name: "Publish" }));
    await user.click(screen.getByRole("button", { name: "Pause" }));
    await user.click(screen.getByRole("button", { name: "Resume" }));

    expect(onCreateVersion).toHaveBeenCalledTimes(1);
    expect(onPublish).toHaveBeenCalledTimes(1);
    expect(onPause).toHaveBeenCalledTimes(1);
    expect(onResume).toHaveBeenCalledTimes(1);
  });

  it("disables the pending action's button via its isXxx pending flag", () => {
    render(
      withQueryClient(<EventRuleDetail eventRule={eventRule} canEdit onPause={vi.fn()} isPausing />)
    );

    expect(screen.getByRole("button", { name: "Pause" })).toBeDisabled();
  });

  it("renders a passed versionActionError inline", () => {
    render(
      withQueryClient(
        <EventRuleDetail
          eventRule={eventRule}
          canEdit
          onPublish={vi.fn()}
          versionActionError="Rule is already PUBLISHED"
        />
      )
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Rule is already PUBLISHED");
  });
});
