/**
 * BadgeDetail Component Tests
 */

import type { Badge as BadgeEntity } from "@loom-loyalty/sdk";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BadgeDetail } from "./badge-detail.js";

const MINIMAL_BADGE: BadgeEntity = {
  badgeId: "badge_00000000000000000000000000000001",
  code: "loyalty-badge",
  name: "Loyalty Badge",
  type: {
    metadataId: "meta_00000000000000000000000000000001",
    code: "ACHIEVEMENT",
    name: "Achievement",
    typeCode: "BADGE_TYPE",
    dataTypeId: "dtyp_00000000000000000000000000000001",
  },
};

type BadgeDateTimePeriod = NonNullable<
  NonNullable<BadgeEntity["enabledInEnvironments"]>[number]["dateTimePeriod"]
>;

function dateTimePeriod(startDateTime: string, endDateTime?: string): BadgeDateTimePeriod {
  // Generated DateTimePeriod required fields are a confirmed backend OpenAPI spec-gen artifact.
  return { startDateTime, ...(endDateTime ? { endDateTime } : {}) } as BadgeDateTimePeriod;
}

describe("BadgeDetail — Enabled Environments", () => {
  it("renders the heading and a badge per entry", () => {
    const badge: BadgeEntity = {
      ...MINIMAL_BADGE,
      enabledInEnvironments: [
        {
          environmentCode: "PRODUCTION",
          organizationEnvironmentId: "orgenv_00000000000000000000000000000001",
          dateTimePeriod: dateTimePeriod("2020-01-01T00:00:00"),
        },
        {
          environmentCode: "STAGING",
          organizationEnvironmentId: "orgenv_00000000000000000000000000000002",
          dateTimePeriod: dateTimePeriod("2020-01-01T00:00:00"),
        },
      ],
    };
    render(<BadgeDetail badge={badge} />);

    expect(screen.getByText("Enabled Environments")).toBeInTheDocument();
    expect(screen.getByText("PRODUCTION")).toBeInTheDocument();
    expect(screen.getByText("STAGING")).toBeInTheDocument();
  });

  it("does not render the heading when enabledInEnvironments is undefined", () => {
    render(<BadgeDetail badge={MINIMAL_BADGE} />);

    expect(screen.queryByText("Enabled Environments")).not.toBeInTheDocument();
  });

  it("does not render the heading when enabledInEnvironments is empty", () => {
    const badge: BadgeEntity = { ...MINIMAL_BADGE, enabledInEnvironments: [] };
    render(<BadgeDetail badge={badge} />);

    expect(screen.queryByText("Enabled Environments")).not.toBeInTheDocument();
  });

  it("shows each environment's status and enablement dates inline", () => {
    const badge: BadgeEntity = {
      ...MINIMAL_BADGE,
      enabledInEnvironments: [
        {
          environmentCode: "PRODUCTION",
          organizationEnvironmentId: "orgenv_00000000000000000000000000000001",
          dateTimePeriod: dateTimePeriod("2020-01-01T00:00:00"),
        },
        {
          environmentCode: "STAGING",
          organizationEnvironmentId: "orgenv_00000000000000000000000000000002",
          dateTimePeriod: dateTimePeriod("2099-01-01T00:00:00"),
        },
        {
          environmentCode: "SANDBOX",
          organizationEnvironmentId: "orgenv_00000000000000000000000000000003",
          dateTimePeriod: dateTimePeriod("2020-01-01T00:00:00", "2020-06-01T00:00:00"),
        },
      ],
    };
    render(<BadgeDetail badge={badge} />);

    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("Scheduled")).toBeInTheDocument();
    expect(screen.getByText("Expired")).toBeInTheDocument();
    expect(screen.getByText(/January 1st, 2099/)).toBeInTheDocument();
    expect(screen.getByText(/June 1st, 2020/)).toBeInTheDocument();
    expect(screen.getAllByText("Indefinite")).toHaveLength(2);
  });
});
