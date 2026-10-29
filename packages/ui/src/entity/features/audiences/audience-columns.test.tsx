// Version column — renders v{version} + Draft/Published badge for
// CUSTOMER_SEGMENT rows only; CUSTOMER_LIST (no version concept) and a
// segment missing `version` both fall back to an em dash.

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { getAudienceColumnsExtended } from "./audience-columns.js";
import type { CustomerList, CustomerSegment } from "./types.js";

const segment: CustomerSegment = {
  customerAudienceId: "aud_00000000000000000000000000000001",
  customerSegmentId: "seg_00000000000000000000000000000001",
  code: "birthday",
  name: "Birthday",
  type: "CUSTOMER_SEGMENT",
  engine: "CLICKHOUSE",
  engineConfig: { engine: "CLICKHOUSE", queryDefinition: "SELECT 1" },
  version: 2,
  versionStatus: "DRAFT",
};

const list: CustomerList = {
  customerAudienceId: "aud_00000000000000000000000000000002",
  customerListId: "lst_00000000000000000000000000000002",
  code: "vip",
  name: "VIP",
  type: "CUSTOMER_LIST",
};

function versionColumn() {
  const column = getAudienceColumnsExtended().find((c) => c.key === "version");
  if (!column) throw new Error("version column not found");
  return column;
}

describe("getAudienceColumnsExtended — version column", () => {
  it("renders the version number and Draft badge for a DRAFT segment", () => {
    render(<>{versionColumn().render(segment)}</>);
    expect(screen.getByText("v2")).toBeInTheDocument();
    expect(screen.getByText("Draft")).toBeInTheDocument();
  });

  it("renders an em dash for a CUSTOMER_LIST row (no version concept)", () => {
    render(<>{versionColumn().render(list)}</>);
    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.queryByText("Draft")).not.toBeInTheDocument();
    expect(screen.queryByText("Published")).not.toBeInTheDocument();
  });

  it("renders an em dash for a segment that has no version yet", () => {
    render(<>{versionColumn().render({ ...segment, version: undefined })}</>);
    expect(screen.getByText("—")).toBeInTheDocument();
  });
});
