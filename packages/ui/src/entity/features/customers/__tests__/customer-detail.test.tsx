import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CustomerPreview } from "../customer-detail";
import type { CustomerPreviewProps } from "../types";

function renderPreview(programs: Array<Record<string, unknown>>) {
  const customer = {
    customerId: "cus_1",
    identity: { firstName: "Riley", lastName: "Referrer" },
    programs,
  } as unknown as CustomerPreviewProps["customer"];
  render(<CustomerPreview customer={customer} />);
}

describe("CustomerPreview — referral code", () => {
  it("shows a membership's referral code", () => {
    renderPreview([{ programCode: "coffee", referralCode: "K7QX-9PM2" }]);
    expect(screen.getByText("K7QX-9PM2")).toBeInTheDocument();
    expect(screen.getByText(/referral code/i)).toBeInTheDocument();
  });

  it("shows no referral line for a membership without a code", () => {
    renderPreview([{ programCode: "coffee" }]);
    expect(screen.getByText("coffee")).toBeInTheDocument();
    expect(screen.queryByText(/referral code/i)).not.toBeInTheDocument();
  });
});
