import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ApprovalDetail } from "./approval-detail";
import type { WorkflowRequest, WorkflowRequestStatus } from "./types";

function buildRequest(status: WorkflowRequestStatus): WorkflowRequest {
  return {
    environmentWorkflowRequestId: "wfr-1",
    environmentWorkflow: { environmentWorkflowId: "wf-1", name: "Enable Workflow", code: "enable" },
    entities: [
      {
        environmentWorkflowRequestEntityId: "e-1",
        entityType: "event-rule",
        entityId: "er-1",
        entityName: "Welcome Bonus Rule",
        primaryEntity: true,
      },
    ],
    status,
    requestedByUserId: "user-1",
    requestedDateTime: "2026-09-01T00:00:00Z",
  };
}

describe("ApprovalDetail — actionability by status", () => {
  it("shows Approve/Reject for a pending (P) request", () => {
    render(<ApprovalDetail request={buildRequest("P")} onApprove={vi.fn()} onReject={vi.fn()} />);

    expect(screen.getByRole("button", { name: /approve/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /reject/i })).toBeInTheDocument();
  });

  it("shows Approve/Reject for an in-progress (I) request, matching the row menu's actionability", () => {
    render(<ApprovalDetail request={buildRequest("I")} onApprove={vi.fn()} onReject={vi.fn()} />);

    expect(screen.getByRole("button", { name: /approve/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /reject/i })).toBeInTheDocument();
  });

  it.each([["A"], ["R"], ["C"]] as const)(
    "hides Approve/Reject for a resolved (%s) request",
    (status) => {
      render(
        <ApprovalDetail request={buildRequest(status)} onApprove={vi.fn()} onReject={vi.fn()} />
      );

      expect(screen.queryByRole("button", { name: /approve/i })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /reject/i })).not.toBeInTheDocument();
    }
  );

  it("hides Approve/Reject when canApprove is false, even for a pending request", () => {
    render(
      <ApprovalDetail
        request={buildRequest("P")}
        onApprove={vi.fn()}
        onReject={vi.fn()}
        canApprove={false}
      />
    );

    expect(screen.queryByRole("button", { name: /approve/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /reject/i })).not.toBeInTheDocument();
  });
});
