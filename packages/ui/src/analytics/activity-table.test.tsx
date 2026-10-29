import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ActivityTable } from "./activity-table";

function row(source_event_datetime: string) {
  return {
    source_event_datetime,
    event_type_code: "EVT",
    entity_type: "CUSTOMER",
    entity_id: "abc12345-1111",
    status: "PROCESSED",
    description: "desc",
  };
}

describe("ActivityTable timestamp parsing", () => {
  it("parses ClickHouse-format UTC timestamps (space separator, no offset)", () => {
    render(<ActivityTable title="t" data={[row("2026-05-20 23:54:14.563")]} />);
    const time = screen.getByRole("table").querySelector("time");
    expect(time?.getAttribute("datetime")).toBe("2026-05-20T23:54:14.563Z");
  });

  it("parses ISO 8601 with Z", () => {
    render(<ActivityTable title="t" data={[row("2026-05-20T23:54:14.000Z")]} />);
    const time = screen.getByRole("table").querySelector("time");
    expect(time?.getAttribute("datetime")).toBe("2026-05-20T23:54:14.000Z");
  });

  it("renders em-dash when timestamp is empty", () => {
    render(<ActivityTable title="t" data={[row("")]} />);
    expect(screen.getByRole("table").querySelector("time")).toBeNull();
    expect(screen.getByLabelText("Unknown time").textContent).toBe("—");
  });

  it("renders em-dash when timestamp is unparseable", () => {
    render(<ActivityTable title="t" data={[row("not-a-date")]} />);
    expect(screen.getByRole("table").querySelector("time")).toBeNull();
    expect(screen.getByLabelText("Unknown time")).not.toBeNull();
  });
});

describe("ActivityTable status badge", () => {
  it("maps uppercase PROCESSED to success styling", () => {
    render(
      <ActivityTable
        title="t"
        data={[{ ...row("2026-05-20 23:54:14.563"), status: "PROCESSED" }]}
      />
    );
    const badge = screen.getByText("PROCESSED");
    expect(badge.className).toMatch(/text-success/);
    expect(badge.className).not.toMatch(/text-muted-foreground/);
  });

  it("maps uppercase FAILED to destructive styling", () => {
    render(
      <ActivityTable title="t" data={[{ ...row("2026-05-20 23:54:14.563"), status: "FAILED" }]} />
    );
    const badge = screen.getByText("FAILED");
    expect(badge.className).toMatch(/text-destructive/);
  });

  it("falls back to muted for unknown statuses", () => {
    render(
      <ActivityTable title="t" data={[{ ...row("2026-05-20 23:54:14.563"), status: "WEIRD" }]} />
    );
    const badge = screen.getByText("WEIRD");
    expect(badge.className).toMatch(/text-muted-foreground/);
  });
});
