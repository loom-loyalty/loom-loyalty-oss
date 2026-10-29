import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ActionRow } from "./action-row";

const resolve = {
  programName: () => undefined,
  offerName: () => undefined,
  badgeName: () => undefined,
  tierName: () => undefined,
  targetName: () => undefined,
  eventRuleName: () => undefined,
  audienceName: () => undefined,
  fieldName: () => undefined,
};

describe("ActionRow", () => {
  it("renders the Send Notification editor", () => {
    render(
      <ActionRow
        action={{ sendNotification: { channelCode: "EMAIL", templateCode: "WELCOME" } }}
        index={0}
        expanded
        isLast
        resolve={resolve}
        onExpand={vi.fn()}
        onRemove={vi.fn()}
        onChange={vi.fn()}
      />
    );

    expect(screen.getByText("Send Notification")).toBeInTheDocument();
    expect(screen.getByLabelText("Channel Code *")).toHaveValue("EMAIL");
  });
});
