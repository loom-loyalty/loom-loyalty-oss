// AudienceDetail — Publish action for CUSTOMER_SEGMENT audiences.
//
// A CustomerSegment's `versionStatus` (DRAFT/PUBLISHED) gates whether it's
// ever scheduled for analytics computation (segment membership) — a DRAFT
// segment created through the Hub's normal create flow is otherwise
// permanently inert. This suite mirrors data-model-detail.test.tsx's style
// for the analogous DataModel version/publish lifecycle.

import type { SegmentExpressionHistory } from "@loom-loyalty/sdk";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { AudienceDetail } from "./audience-detail.js";
import type { CustomerList, CustomerSegment } from "./types.js";

function segment(overrides: Partial<CustomerSegment> = {}): CustomerSegment {
  return {
    customerAudienceId: "aud_00000000000000000000000000000001",
    customerSegmentId: "seg_00000000000000000000000000000001",
    code: "birthday",
    name: "Birthday",
    type: "CUSTOMER_SEGMENT",
    engine: "CLICKHOUSE",
    engineConfig: { engine: "CLICKHOUSE", queryDefinition: "SELECT 1" },
    version: 1,
    versionStatus: "DRAFT",
    ...overrides,
  };
}

function list(overrides: Partial<CustomerList> = {}): CustomerList {
  return {
    customerAudienceId: "aud_00000000000000000000000000000002",
    customerListId: "lst_00000000000000000000000000000002",
    code: "vip",
    name: "VIP",
    type: "CUSTOMER_LIST",
    ...overrides,
  };
}

describe("AudienceDetail — Publish action", () => {
  it("shows an enabled Publish button for a DRAFT segment and invokes onPublish on click", async () => {
    const user = userEvent.setup();
    const onPublish = vi.fn();
    render(<AudienceDetail audience={segment()} onPublish={onPublish} canEdit canDelete />);

    const button = screen.getByRole("button", { name: "Publish" });
    expect(button).toBeEnabled();
    await user.click(button);
    expect(onPublish).toHaveBeenCalledTimes(1);
  });

  it("does not show Publish for an already-PUBLISHED segment", () => {
    render(
      <AudienceDetail
        audience={segment({ versionStatus: "PUBLISHED" })}
        onPublish={vi.fn()}
        canEdit
        canDelete
      />
    );
    expect(screen.queryByRole("button", { name: "Publish" })).not.toBeInTheDocument();
  });

  it("never shows Publish for a CUSTOMER_LIST audience (no version lifecycle)", () => {
    render(<AudienceDetail audience={list()} onPublish={vi.fn()} canEdit canDelete />);
    expect(screen.queryByRole("button", { name: "Publish" })).not.toBeInTheDocument();
  });

  it("hides Publish for a read-only viewer (canEdit=false) even on a DRAFT segment", () => {
    render(
      <AudienceDetail audience={segment()} onPublish={vi.fn()} canEdit={false} canDelete={false} />
    );
    expect(screen.queryByRole("button", { name: "Publish" })).not.toBeInTheDocument();
  });

  it("omits Publish entirely when no onPublish handler is supplied", () => {
    render(<AudienceDetail audience={segment()} canEdit canDelete />);
    expect(screen.queryByRole("button", { name: /Publish/ })).not.toBeInTheDocument();
  });

  it("disables the button and shows a pending label while isPublishing", () => {
    render(
      <AudienceDetail audience={segment()} onPublish={vi.fn()} isPublishing canEdit canDelete />
    );
    const button = screen.getByRole("button", { name: "Publishing…" });
    expect(button).toBeDisabled();
  });

  it("renders a dismissible-style inline error banner when publishError is set", () => {
    render(
      <AudienceDetail
        audience={segment()}
        onPublish={vi.fn()}
        publishError="Cannot publish — version conflict"
        canEdit
        canDelete
      />
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Cannot publish — version conflict");
  });

  it("shows the version number and a Draft badge for a DRAFT segment", () => {
    render(<AudienceDetail audience={segment({ version: 3 })} canEdit canDelete />);
    expect(screen.getByText("v3")).toBeInTheDocument();
    expect(screen.getByText("Draft")).toBeInTheDocument();
  });

  it("shows a Published badge for a published segment", () => {
    render(<AudienceDetail audience={segment({ versionStatus: "PUBLISHED" })} canEdit canDelete />);
    expect(screen.getByText("Published")).toBeInTheDocument();
  });
});

// The New Version button is gone ("There should be no New
// Version button"). These replace the old "Create Version action" tests,
// whose requirement changed: Edit on a published segment now starts the
// draft, and system segments are read-only.
describe("AudienceDetail — no New Version, system segments read-only", () => {
  it.each(["DRAFT", "PUBLISHED"] as const)(
    "shows no New Version button for a %s segment (W4)",
    (versionStatus) => {
      render(
        <AudienceDetail
          audience={segment({ versionStatus })}
          onEdit={vi.fn()}
          onDelete={vi.fn()}
          onPublish={vi.fn()}
        />
      );
      expect(screen.queryByRole("button", { name: /new version/i })).not.toBeInTheDocument();
    }
  );

  it("shows Edit on a PUBLISHED segment (Edit starts the draft)", () => {
    render(
      <AudienceDetail
        audience={segment({ versionStatus: "PUBLISHED" })}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />
    );
    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Publish" })).not.toBeInTheDocument();
  });

  it("gives a system segment no Edit and no Delete (spec 10)", () => {
    render(
      <AudienceDetail
        audience={segment({ versionStatus: "PUBLISHED", isSystem: true })}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />
    );
    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
  });

  it("keeps Edit and Delete on a customer list", () => {
    render(<AudienceDetail audience={list()} onEdit={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
  });
});

// AudienceDetail — Version History (display-only) (U4).
//
// `SegmentExpressionHistory` carries no `versionStatus` field at all
// (confirmed in openapi.yaml), unlike DataModel's version history — so this
// only ever renders version/created-date/referenced-fields, never a per-row
// status badge or per-row Publish button.
describe("AudienceDetail — Version History (display-only)", () => {
  const historyEntries: SegmentExpressionHistory[] = [
    {
      segmentExpressionHistoryId: "veh_2",
      customerAudienceId: "aud_00000000000000000000000000000001",
      customerSegmentId: "seg_00000000000000000000000000000001",
      version: 2,
      createdDateTime: "2026-01-02T00:00:00Z",
      referencedFields: ["birthDate", "loyaltyTier"],
    },
    {
      segmentExpressionHistoryId: "veh_1",
      customerAudienceId: "aud_00000000000000000000000000000001",
      customerSegmentId: "seg_00000000000000000000000000000001",
      version: 1,
      createdDateTime: "2026-01-01T00:00:00Z",
      referencedFields: [],
    },
  ];

  it("lists prior versions (version, created date, referenced fields) for a segment with more than one version", () => {
    render(
      <AudienceDetail
        audience={segment({ versionStatus: "PUBLISHED" })}
        versionHistory={historyEntries}
        canEdit
        canDelete
      />
    );
    const heading = screen.getByText("Version History (2)");
    const section = heading.closest("section");
    expect(section).not.toBeNull();
    // Scoped to the history section — the audience's own current version
    // (shown separately in Basic Information) can coincidentally collide with
    // a history row's version number (both may read "v1").
    const scoped = within(section!);
    expect(scoped.getByText("v2")).toBeInTheDocument();
    expect(scoped.getByText("v1")).toBeInTheDocument();
    expect(scoped.getByText("birthDate, loyaltyTier")).toBeInTheDocument();
  });

  it("omits the version history section entirely when there is no history", () => {
    render(<AudienceDetail audience={segment({ versionStatus: "PUBLISHED" })} canEdit canDelete />);
    expect(screen.queryByText(/Version History/)).not.toBeInTheDocument();
  });

  it("never shows version history for a CUSTOMER_LIST audience", () => {
    render(<AudienceDetail audience={list()} versionHistory={historyEntries} canEdit canDelete />);
    expect(screen.queryByText(/Version History/)).not.toBeInTheDocument();
  });

  it("renders no per-row status badge or per-row Publish button — only version, created date, and referenced fields", () => {
    render(
      <AudienceDetail
        audience={segment({ versionStatus: "DRAFT" })}
        versionHistory={historyEntries}
        onPublish={vi.fn()}
        canEdit
        canDelete
      />
    );
    // Exactly one Publish button total (the existing top-level action, gated
    // on the segment's own isDraftSegment) — none per history row.
    expect(screen.getAllByRole("button", { name: "Publish" })).toHaveLength(1);
    // No status badge (role="status", per SegmentVersionStatusBadge) inside
    // the version-history section itself.
    const heading = screen.getByText("Version History (2)");
    const section = heading.closest("section");
    expect(section).not.toBeNull();
    expect(section?.querySelector('[role="status"]')).toBeNull();
  });
});

// loom-loyalty#1028 — a Platform API segment carries no engine config; its
// member count is lastCardinality from the last computation run.
describe("AudienceDetail — Platform API segment membership", () => {
  function apiSegment(overrides: Partial<CustomerSegment> = {}): CustomerSegment {
    const {
      engine: _engine,
      engineConfig: _engineConfig,
      ...rest
    } = segment({
      code: "lifecycle-loyalty",
      name: "Lifecycle: Loyalty",
      versionStatus: "PUBLISHED",
      ...overrides,
    });
    return rest as CustomerSegment;
  }

  it("shows the computed member count", () => {
    render(
      <AudienceDetail
        audience={apiSegment({
          lastCardinality: 42,
          computationStatus: "COMPLETED",
          lastComputedDateTime: new Date().toISOString(),
        })}
      />
    );

    const section = screen.getByRole("heading", { name: "Membership" }).closest("section");
    expect(section).not.toBeNull();
    expect(within(section as HTMLElement).getByText("42")).toBeInTheDocument();
    expect(within(section as HTMLElement).getByText(/^Updated /)).toBeInTheDocument();
  });

  it("says a segment that has never been computed has no count yet", () => {
    render(<AudienceDetail audience={apiSegment({ computationStatus: "PENDING" })} />);

    const section = screen.getByRole("heading", { name: "Membership" }).closest("section");
    expect(within(section as HTMLElement).getByText("—")).toBeInTheDocument();
    expect(within(section as HTMLElement).getByText("Not computed yet")).toBeInTheDocument();
  });
});
