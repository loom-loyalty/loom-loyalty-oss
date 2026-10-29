/**
 * WebhookDetail Component Tests
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { WebhookEndpoint } from "./types.js";
import { WebhookDetail } from "./webhook-detail.js";

const webhook: WebhookEndpoint = {
  id: "ep_1",
  url: "https://example.com/hooks",
  status: "active",
  events: ["points.earned", "tier.changed"],
};

describe("WebhookDetail", () => {
  it("renders the subscribed events as static badges", () => {
    render(<WebhookDetail webhook={webhook} />);

    expect(screen.getByText("points.earned")).toBeInTheDocument();
    expect(screen.getByText("tier.changed")).toBeInTheDocument();
    expect(screen.getByText(/2 events subscribed/i)).toBeInTheDocument();
  });

  it("exposes an inline signature verification snippet with the Svix headers", () => {
    render(<WebhookDetail webhook={webhook} />);

    expect(screen.getByText("How to verify signatures")).toBeInTheDocument();
    expect(screen.getByText("svix-id")).toBeInTheDocument();
    expect(screen.getByText("svix-signature")).toBeInTheDocument();
  });

  it("reveals a copy control only once the secret is shown", () => {
    const { rerender } = render(
      <WebhookDetail
        webhook={webhook}
        secret="whsec_x"
        showSecret={false}
        onToggleSecret={() => {}}
      />
    );
    expect(screen.queryByRole("button", { name: "Copy signing secret" })).not.toBeInTheDocument();

    rerender(
      <WebhookDetail webhook={webhook} secret="whsec_x" showSecret onToggleSecret={() => {}} />
    );
    expect(screen.getByRole("button", { name: "Copy signing secret" })).toBeInTheDocument();
  });

  describe("Transformation section", () => {
    it("is hidden when no edit handler is wired", () => {
      render(<WebhookDetail webhook={webhook} />);

      expect(screen.queryByText("Transformation")).not.toBeInTheDocument();
    });

    it("shows an enabled badge and the code preview", () => {
      render(
        <WebhookDetail
          webhook={webhook}
          transformation={{ code: "function handler(webhook) { return webhook; }", enabled: true }}
          onEditTransformation={() => {}}
        />
      );

      expect(screen.getByText("Transformation")).toBeInTheDocument();
      expect(screen.getByText("Enabled")).toBeInTheDocument();
      expect(screen.getByRole("region", { name: "Transformation code preview" })).toHaveTextContent(
        "function handler(webhook)"
      );
    });

    it("shows the disabled empty state when no code is configured", () => {
      render(
        <WebhookDetail
          webhook={webhook}
          transformation={{ code: null, enabled: false }}
          onEditTransformation={() => {}}
        />
      );

      expect(screen.getByText("Disabled")).toBeInTheDocument();
      expect(screen.getByText(/no transformation configured/i)).toBeInTheDocument();
    });

    it("calls onEditTransformation when Edit is clicked", () => {
      const onEdit = vi.fn();
      render(
        <WebhookDetail
          webhook={webhook}
          transformation={{ code: null, enabled: false }}
          onEditTransformation={onEdit}
        />
      );

      fireEvent.click(screen.getByRole("button", { name: /edit transformation/i }));
      expect(onEdit).toHaveBeenCalledTimes(1);
    });

    it("renders a loading state while the transformation loads", () => {
      render(
        <WebhookDetail webhook={webhook} transformationLoading onEditTransformation={() => {}} />
      );

      expect(screen.getByRole("status", { name: "Loading transformation" })).toBeInTheDocument();
    });
  });
});
