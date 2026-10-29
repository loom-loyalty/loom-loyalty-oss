/**
 * WebhookMessageLog Component Tests
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { WebhookMessage } from "./types.js";
import { WebhookMessageLog } from "./webhook-message-log.js";

const messages: WebhookMessage[] = [
  {
    id: "att_1",
    eventType: "customer.created",
    timestamp: "Jan 1, 12:00",
    status: "success",
    responseCode: 200,
    duration: "120ms",
  },
  {
    id: "att_2",
    eventType: "customer.updated",
    timestamp: "Jan 1, 12:05",
    status: "failed",
    responseCode: 500,
  },
];

describe("WebhookMessageLog", () => {
  it("renders a row per message with event type and response code", () => {
    render(<WebhookMessageLog messages={messages} />);

    expect(screen.getByText("customer.created")).toBeInTheDocument();
    expect(screen.getByText("200")).toBeInTheDocument();
    expect(screen.getByText("500")).toBeInTheDocument();
  });

  it("opens the attempt when a row is clicked and onSelect is provided", () => {
    const onSelect = vi.fn();
    render(<WebhookMessageLog messages={messages} onSelect={onSelect} />);

    fireEvent.click(screen.getByRole("button", { name: "View customer.created delivery attempt" }));
    expect(onSelect).toHaveBeenCalledWith("att_1");
  });

  it("renders non-interactive rows when onSelect is absent", () => {
    render(<WebhookMessageLog messages={messages} />);

    expect(screen.queryByRole("button", { name: /delivery attempt/i })).not.toBeInTheDocument();
  });

  it("keeps a row non-interactive when selectable is false, even with onSelect", () => {
    const onSelect = vi.fn();
    const mixed: WebhookMessage[] = [
      { id: "att_1", eventType: "customer.created", timestamp: "Jan 1, 12:00", status: "success" },
      {
        id: "att_2",
        eventType: "customer.updated",
        timestamp: "Jan 1, 12:05",
        status: "failed",
        selectable: false,
      },
    ];
    render(<WebhookMessageLog messages={mixed} onSelect={onSelect} />);

    // The selectable row is a button; the non-selectable one stays a plain row,
    // so there is no clickable affordance that silently does nothing.
    expect(
      screen.getByRole("button", { name: "View customer.created delivery attempt" })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "View customer.updated delivery attempt" })
    ).not.toBeInTheDocument();
  });

  it("shows the empty state when there are no messages", () => {
    render(<WebhookMessageLog messages={[]} />);

    expect(screen.getByText(/no delivery attempts yet/i)).toBeInTheDocument();
  });

  it("sets <time dateTime> from rawTimestamp when present", () => {
    const withRaw: WebhookMessage[] = [{ ...messages[0]!, rawTimestamp: "2026-01-01T12:00:00Z" }];
    render(<WebhookMessageLog messages={withRaw} />);

    expect(screen.getByText("Jan 1, 12:00").closest("time")).toHaveAttribute(
      "dateTime",
      "2026-01-01T12:00:00Z"
    );
  });

  it("omits dateTime rather than emitting the human-readable string when rawTimestamp is absent", () => {
    render(<WebhookMessageLog messages={messages} />);

    // messages[0] has no rawTimestamp — dateTime must not fall back to the
    // display string ("Jan 1, 12:00"), which isn't a valid machine timestamp.
    expect(screen.getByText("Jan 1, 12:00").closest("time")).not.toHaveAttribute("dateTime");
  });
});
