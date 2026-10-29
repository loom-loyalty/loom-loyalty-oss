/**
 * ProgramDetail Component Tests
 */

import type { Program } from "@loom-loyalty/sdk";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProgramDetail } from "./program-detail.js";

const MINIMAL_PROGRAM: Program = {
  programId: "prog_550e8400e29b41d4a716446655440000",
  code: "test-program",
  name: "Test Program",
  type: {
    metadataId: "meta_00000000000000000000000000000001",
    code: "POINTS",
    name: "Points",
    typeCode: "PROGRAM_TYPE",
    dataTypeId: "dtyp_00000000000000000000000000000001",
  },
};

type ProgramDateTimePeriod = NonNullable<
  NonNullable<Program["enabledInEnvironments"]>[number]["dateTimePeriod"]
>;

function dateTimePeriod(startDateTime: string, endDateTime?: string): ProgramDateTimePeriod {
  // Generated DateTimePeriod required fields are a confirmed backend OpenAPI spec-gen artifact.
  return { startDateTime, ...(endDateTime ? { endDateTime } : {}) } as ProgramDateTimePeriod;
}

describe("ProgramDetail — Enabled Environments", () => {
  it("renders the heading and a badge per entry", () => {
    const program: Program = {
      ...MINIMAL_PROGRAM,
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
    render(<ProgramDetail program={program} />);

    expect(screen.getByText("Enabled Environments")).toBeInTheDocument();
    expect(screen.getByText("PRODUCTION")).toBeInTheDocument();
    expect(screen.getByText("STAGING")).toBeInTheDocument();
  });

  it("does not render the heading when enabledInEnvironments is undefined", () => {
    render(<ProgramDetail program={MINIMAL_PROGRAM} />);

    expect(screen.queryByText("Enabled Environments")).not.toBeInTheDocument();
  });

  it("does not render the heading when enabledInEnvironments is empty", () => {
    const program: Program = { ...MINIMAL_PROGRAM, enabledInEnvironments: [] };
    render(<ProgramDetail program={program} />);

    expect(screen.queryByText("Enabled Environments")).not.toBeInTheDocument();
  });

  it("shows each environment's status and enablement dates inline", () => {
    const program: Program = {
      ...MINIMAL_PROGRAM,
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
    render(<ProgramDetail program={program} />);

    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("Scheduled")).toBeInTheDocument();
    expect(screen.getByText("Expired")).toBeInTheDocument();
    expect(screen.getByText(/January 1st, 2099/)).toBeInTheDocument();
    expect(screen.getByText(/June 1st, 2020/)).toBeInTheDocument();
    expect(screen.getAllByText("Indefinite")).toHaveLength(2);
  });
});
