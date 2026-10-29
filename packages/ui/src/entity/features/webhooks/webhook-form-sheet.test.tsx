/**
 * WebhookFormSheet Component Tests
 */

import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { WebhookFormSheet } from "./webhook-form-sheet.js";

const availableEventTypes = ["member.created", "points.earned"];

/** Open the Destination Radix Select and pick a connector by visible name. */
function selectConnector(name: RegExp) {
  fireEvent.click(screen.getByLabelText("Destination"));
  // Radix portals options to document.body — search there.
  fireEvent.click(within(document.body).getByRole("option", { name }));
}

function renderSheet(onSubmit = vi.fn()) {
  render(
    <WebhookFormSheet
      open
      mode="create"
      onOpenChange={() => {}}
      onSubmit={onSubmit}
      availableEventTypes={availableEventTypes}
    />
  );
  return onSubmit;
}

describe("WebhookFormSheet — event validation", () => {
  it("blocks submit and shows an error when no events are selected", async () => {
    const onSubmit = renderSheet();

    fireEvent.change(screen.getByPlaceholderText("https://your-domain.com/webhooks"), {
      target: { value: "https://hooks.example.com/in" },
    });
    fireEvent.click(screen.getByRole("button", { name: /create endpoint/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/at least one event/i);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits once at least one event is selected", async () => {
    const onSubmit = renderSheet();

    fireEvent.change(screen.getByPlaceholderText("https://your-domain.com/webhooks"), {
      target: { value: "https://hooks.example.com/in" },
    });
    fireEvent.click(screen.getByRole("checkbox", { name: "Subscribe to member.created" }));
    fireEvent.click(screen.getByRole("button", { name: /create endpoint/i }));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ events: ["member.created"] }))
    );
  });

  it("clears the error once an event is selected after a blocked submit", async () => {
    renderSheet();

    fireEvent.change(screen.getByPlaceholderText("https://your-domain.com/webhooks"), {
      target: { value: "https://hooks.example.com/in" },
    });
    fireEvent.click(screen.getByRole("button", { name: /create endpoint/i }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("checkbox", { name: "Subscribe to points.earned" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("submits without blocking when no event types are available to choose from", async () => {
    const onSubmit = vi.fn();
    render(
      <WebhookFormSheet
        open
        mode="create"
        onOpenChange={() => {}}
        onSubmit={onSubmit}
        availableEventTypes={[]}
      />
    );

    fireEvent.change(screen.getByPlaceholderText("https://your-domain.com/webhooks"), {
      target: { value: "https://hooks.example.com/in" },
    });
    fireEvent.click(screen.getByRole("button", { name: /create endpoint/i }));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ events: [] }))
    );
  });
});

describe("WebhookFormSheet — URL validation", () => {
  it("blocks submit and shows an error when the URL is empty", async () => {
    const onSubmit = renderSheet();

    fireEvent.click(screen.getByRole("checkbox", { name: "Subscribe to member.created" }));
    fireEvent.click(screen.getByRole("button", { name: /create endpoint/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/enter the endpoint url/i);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("rejects a non-HTTPS URL", async () => {
    const onSubmit = renderSheet();

    fireEvent.change(screen.getByPlaceholderText("https://your-domain.com/webhooks"), {
      target: { value: "http://hooks.example.com/in" },
    });
    fireEvent.click(screen.getByRole("checkbox", { name: "Subscribe to member.created" }));
    fireEvent.click(screen.getByRole("button", { name: /create endpoint/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/must use https/i);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("rejects a malformed URL", async () => {
    const onSubmit = renderSheet();

    fireEvent.change(screen.getByPlaceholderText("https://your-domain.com/webhooks"), {
      target: { value: "not-a-url" },
    });
    fireEvent.click(screen.getByRole("checkbox", { name: "Subscribe to member.created" }));
    fireEvent.click(screen.getByRole("button", { name: /create endpoint/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/valid url/i);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("clears the URL error after the field is corrected", async () => {
    renderSheet();

    fireEvent.click(screen.getByRole("checkbox", { name: "Subscribe to member.created" }));
    fireEvent.click(screen.getByRole("button", { name: /create endpoint/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/enter the endpoint url/i);

    fireEvent.change(screen.getByPlaceholderText("https://your-domain.com/webhooks"), {
      target: { value: "https://hooks.example.com/in" },
    });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("trims and submits a valid HTTPS URL", async () => {
    const onSubmit = renderSheet();

    fireEvent.change(screen.getByPlaceholderText("https://your-domain.com/webhooks"), {
      target: { value: "  https://hooks.example.com/in  " },
    });
    fireEvent.click(screen.getByRole("checkbox", { name: "Subscribe to member.created" }));
    fireEvent.click(screen.getByRole("button", { name: /create endpoint/i }));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ url: "https://hooks.example.com/in" })
      )
    );
  });
});

describe("WebhookFormSheet — connectors", () => {
  const connectors = [
    { kind: "CUSTOM", name: "Custom URL", requiresOauth: false },
    { kind: "SLACK", name: "Slack", requiresOauth: true },
    { kind: "ZAPIER", name: "Zapier", requiresOauth: false },
  ];

  it("swaps the URL field for a Connect button on an OAuth connector", () => {
    render(
      <WebhookFormSheet
        open
        mode="create"
        onOpenChange={() => {}}
        onSubmit={vi.fn()}
        availableEventTypes={availableEventTypes}
        connectors={connectors}
      />
    );

    expect(screen.getByPlaceholderText("https://your-domain.com/webhooks")).toBeInTheDocument();
    selectConnector(/^Slack$/i);

    expect(
      screen.queryByPlaceholderText("https://your-domain.com/webhooks")
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /connect to slack/i })).toBeInTheDocument();
  });

  it("includes connectorKind in the submitted data for a paste-URL connector", async () => {
    const onSubmit = vi.fn();
    render(
      <WebhookFormSheet
        open
        mode="create"
        onOpenChange={() => {}}
        onSubmit={onSubmit}
        availableEventTypes={availableEventTypes}
        connectors={connectors}
      />
    );

    selectConnector(/^Zapier$/i);
    fireEvent.change(screen.getByPlaceholderText("https://your-domain.com/webhooks"), {
      target: { value: "https://hooks.zapier.com/hooks/catch/1/abc" },
    });
    fireEvent.click(screen.getByRole("checkbox", { name: "Subscribe to member.created" }));
    fireEvent.click(screen.getByRole("button", { name: /create endpoint/i }));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ connectorKind: "ZAPIER" }))
    );
  });

  it("does not send connectorKind in edit mode", async () => {
    const onSubmit = vi.fn();
    render(
      <WebhookFormSheet
        open
        mode="edit"
        onOpenChange={() => {}}
        onSubmit={onSubmit}
        availableEventTypes={availableEventTypes}
        initialData={{
          url: "https://x.example.com",
          status: "enabled",
          events: ["member.created"],
          connectorKind: "SLACK",
        }}
        connectors={connectors}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit).toHaveBeenCalledWith(
      expect.not.objectContaining({ connectorKind: expect.anything() })
    );
  });
});
