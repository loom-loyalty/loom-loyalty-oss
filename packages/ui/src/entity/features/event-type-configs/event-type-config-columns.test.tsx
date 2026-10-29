import type { EventTypeConfiguration } from "@loom-loyalty/sdk";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  getEventTypeConfigColumnsExtended,
  resolveEventTypeLabel,
} from "./event-type-config-columns";

function makeConfig(overrides: Partial<EventTypeConfiguration>): EventTypeConfiguration {
  return {
    eventTypeConfigurationId: "etcfg_00000000000000000000000000000001",
    code: "PURCHASE_CFG",
    name: "Purchase Config",
    eventTypeCode: "",
    ...overrides,
  } as EventTypeConfiguration;
}

describe("resolveEventTypeLabel", () => {
  it("prefers eventType.name when the resolved object is present", () => {
    const cfg = makeConfig({
      eventTypeCode: "PURCHASE",
      eventType: { name: "Purchase", code: "PURCHASE" } as EventTypeConfiguration["eventType"],
    });
    expect(resolveEventTypeLabel(cfg)).toBe("Purchase");
  });

  it("falls back to eventType.code when name is missing", () => {
    const cfg = makeConfig({
      eventType: { code: "PURCHASE" } as EventTypeConfiguration["eventType"],
    });
    expect(resolveEventTypeLabel(cfg)).toBe("PURCHASE");
  });

  it("falls back to eventTypeCode when eventType is absent", () => {
    const cfg = makeConfig({ eventTypeCode: "PURCHASE" });
    expect(resolveEventTypeLabel(cfg)).toBe("PURCHASE");
  });

  it("returns empty string when both are missing — column renders the em-dash fallback", () => {
    const cfg = makeConfig({});
    expect(resolveEventTypeLabel(cfg)).toBe("");
  });
});

describe("Event Type column renderer", () => {
  const eventTypeColumn = getEventTypeConfigColumnsExtended().find((c) => c.key === "eventType");

  it("renders the resolved name from the eventType object (regression for empty '-')", () => {
    const cfg = makeConfig({
      eventType: { name: "Purchase", code: "PURCHASE" } as EventTypeConfiguration["eventType"],
    });
    const { container } = render(<>{eventTypeColumn!.render(cfg)}</>);
    expect(container.textContent).toContain("Purchase");
    expect(container.textContent).not.toBe("—");
  });

  it("renders the em-dash when neither eventType nor eventTypeCode is populated", () => {
    const cfg = makeConfig({});
    const { container } = render(<>{eventTypeColumn!.render(cfg)}</>);
    expect(container.textContent).toBe("—");
  });
});
