import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SubscriptionChecklist } from "./subscription-checklist";

describe("SubscriptionChecklist", () => {
  it("orders categories alphabetically, then events alphabetically within each", () => {
    render(
      <SubscriptionChecklist
        eventTypes={["points.earned", "member.updated", "member.created", "account.closed"]}
        subscribedTypes={[]}
        onToggle={vi.fn()}
      />
    );

    const labels = screen.getAllByRole("checkbox").map((c) => c.getAttribute("aria-label"));
    expect(labels).toEqual([
      "Subscribe to account.closed",
      "Subscribe to member.created",
      "Subscribe to member.updated",
      "Subscribe to points.earned",
    ]);
  });
});
