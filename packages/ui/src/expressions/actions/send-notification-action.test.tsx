import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SendNotificationActionComponent } from "./send-notification-action";

describe("SendNotificationActionComponent", () => {
  it("shows the backend notification default and updates its fields", () => {
    const onChange = vi.fn();
    render(
      <SendNotificationActionComponent
        value={{ channelCode: "EMAIL", templateCode: "WELCOME" }}
        onChange={onChange}
      />
    );

    expect(screen.getByLabelText("Kind")).toHaveValue("NOTIFICATION");
    expect(screen.getByLabelText("Channel Code *")).toBeRequired();
    expect(screen.getByLabelText("Template Code *")).toBeRequired();

    fireEvent.change(screen.getByLabelText("Kind"), { target: { value: "REMINDER" } });
    expect(onChange).toHaveBeenCalledWith({
      channelCode: "EMAIL",
      templateCode: "WELCOME",
      kind: "REMINDER",
    });

    fireEvent.change(screen.getByLabelText("Channel Code *"), { target: { value: "SMS" } });
    expect(onChange).toHaveBeenLastCalledWith({ channelCode: "SMS", templateCode: "WELCOME" });

    fireEvent.change(screen.getByLabelText("Template Code *"), {
      target: { value: "REMINDER_TEMPLATE" },
    });
    expect(onChange).toHaveBeenLastCalledWith({
      channelCode: "EMAIL",
      templateCode: "REMINDER_TEMPLATE",
    });

    fireEvent.change(screen.getByLabelText("Reason (optional)"), { target: { value: "Renewal" } });
    expect(onChange).toHaveBeenLastCalledWith({
      channelCode: "EMAIL",
      templateCode: "WELCOME",
      reason: "Renewal",
    });
  });
});
