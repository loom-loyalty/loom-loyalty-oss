/**
 * WebhookAttemptDetail Component Tests
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { WebhookMessage } from "./types.js";
import { WebhookAttemptDetail } from "./webhook-attempt-detail.js";

const message: WebhookMessage = {
  id: "att_1",
  eventType: "customer.created",
  timestamp: "Jan 1, 2026, 12:00",
  rawTimestamp: "2026-01-01T12:00:00Z",
  status: "success",
  responseCode: 200,
  duration: "120ms",
  triggerType: "SCHEDULED",
  endpointUrl: "https://example.com/hooks",
  payload: { id: "cust_1", email: "a@b.com" },
  responseBody: '{"ok":true}',
};

describe("WebhookAttemptDetail", () => {
  it("renders the status summary fields", () => {
    render(<WebhookAttemptDetail message={message} />);

    expect(screen.getByText("Success")).toBeInTheDocument();
    expect(screen.getByText("200")).toBeInTheDocument();
    expect(screen.getByText("120ms")).toBeInTheDocument();
    expect(screen.getByText("SCHEDULED")).toBeInTheDocument();
    expect(screen.getByText("https://example.com/hooks")).toBeInTheDocument();
    expect(screen.getByText("customer.created")).toBeInTheDocument();
  });

  it("renders the request payload as formatted JSON", () => {
    render(<WebhookAttemptDetail message={message} />);

    expect(screen.getByRole("region", { name: "Request payload" })).toHaveTextContent(
      '"email": "a@b.com"'
    );
  });

  it("renders the response body", () => {
    render(<WebhookAttemptDetail message={message} />);

    expect(screen.getByRole("region", { name: "Response body" })).toHaveTextContent('{"ok":true}');
  });

  it("shows an empty hint when there is no response body", () => {
    render(<WebhookAttemptDetail message={{ ...message, responseBody: undefined }} />);

    expect(screen.getByText(/no response body returned/i)).toBeInTheDocument();
  });
});
