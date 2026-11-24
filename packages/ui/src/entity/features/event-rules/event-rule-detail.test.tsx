// EventRuleDetail version-lifecycle actions: every button comes from the record's own
// versionStatus, so the sheet never offers an action the API refuses. This
// replaces the U3/KTD3 tests, which asserted the old fallback (Pause and
// Resume always shown, status inferred); the requirement changed, so they did.

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

const ALL_HANDLERS = {
  onPublish: vi.fn(),
  onPause: vi.fn(),
  onResume: vi.fn(),
  onEdit: vi.fn(),
  onDelete: vi.fn(),
  onShowHistory: vi.fn(),
};

function renderWith(status: string | undefined, extra: Record<string, unknown> = {}) {
  render(
    withQueryClient(
      <EventRuleDetail
        eventRule={{ ...eventRule, version: 2, versionStatus: status }}
        canEdit
        canDelete
        {...ALL_HANDLERS}
        {...extra}
      />
    )
  );
}

const button = (name: string) => screen.queryByRole("button", { name });

describe("EventRuleDetail shows only actions the rule's status allows", () => {
  it.each([
    ["DRAFT", ["Publish"], ["Pause", "Resume"]],
    ["PUBLISHED", ["Pause"], ["Publish", "Resume"]],
    ["PAUSED", ["Resume"], ["Publish", "Pause"]],
    ["ARCHIVED", [], ["Publish", "Pause", "Resume"]],
    [undefined, [], ["Publish", "Pause", "Resume"]],
  ])("%s shows %j and hides %j", (status, shown, hidden) => {
    renderWith(status);
    for (const name of shown) expect(button(name)).toBeInTheDocument();
    for (const name of hidden) expect(button(name)).not.toBeInTheDocument();
    // Edit, Delete and Version history stay in every status.
    expect(button("Edit")).toBeInTheDocument();
    expect(button("Delete")).toBeInTheDocument();
    expect(button("Version history")).toBeInTheDocument();
  });

  it.each(["DRAFT", "PUBLISHED", "PAUSED", "ARCHIVED"])(
    "never shows a New Version button (%s)",
    (status) => {
      renderWith(status);
      expect(screen.queryByRole("button", { name: /new version/i })).not.toBeInTheDocument();
    }
  );

  it("an old version that a newer one replaced offers no lifecycle action", () => {
    renderWith("PAUSED", { isReplaced: true });
    expect(button("Resume")).not.toBeInTheDocument();
    expect(button("Publish")).not.toBeInTheDocument();
    expect(button("Pause")).not.toBeInTheDocument();
  });

  it("hides lifecycle actions when canEdit is false", () => {
    renderWith("PUBLISHED", { canEdit: false });
    expect(button("Pause")).not.toBeInTheDocument();
    expect(button("Edit")).not.toBeInTheDocument();
  });

  it.each([
    ["DRAFT", "Draft"],
    ["PUBLISHED", "Published"],
    ["PAUSED", "Paused"],
    ["ARCHIVED", "Archived"],
    [undefined, "Status unknown"],
  ])("the badge shows the real status %s as %s", (status, label) => {
    renderWith(status);
    expect(screen.getByLabelText(`Version status: ${label}`)).toBeInTheDocument();
  });

  it("calls the matching handler for each shown action", async () => {
    const user = userEvent.setup();
    const onPause = vi.fn();
    const onShowHistory = vi.fn();
    renderWith("PUBLISHED", { onPause, onShowHistory });
    await user.click(screen.getByRole("button", { name: "Pause" }));
    await user.click(screen.getByRole("button", { name: "Version history" }));
    expect(onPause).toHaveBeenCalledOnce();
    expect(onShowHistory).toHaveBeenCalledOnce();
  });

  it("disables the pending action's button", () => {
    renderWith("PAUSED", { isResuming: true });
    expect(button("Resume")).toBeDisabled();
  });

  it("renders a passed versionActionError inline", () => {
    renderWith("PUBLISHED", { versionActionError: "Can only pause a PUBLISHED EventRule" });
    expect(screen.getByText("Can only pause a PUBLISHED EventRule")).toBeInTheDocument();
  });

  it("renders no lifecycle row or badge when no lifecycle handler is passed", () => {
    render(
      withQueryClient(<EventRuleDetail eventRule={{ ...eventRule, versionStatus: "PUBLISHED" }} />)
    );
    expect(button("Pause")).not.toBeInTheDocument();
    expect(button("Version history")).not.toBeInTheDocument();
  });
});
