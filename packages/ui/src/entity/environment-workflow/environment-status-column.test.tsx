/**
 * EnvironmentStatusColumn Tests
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  ENVIRONMENT_COLUMN_HEADER,
  EnvironmentStatusColumn,
  formatEnablementPeriod,
  getEnvironmentColumn,
  isEnabledNow,
  type EnabledInEnvironment,
} from "./environment-status-column.js";

function env(
  code: string,
  startDateTime: string,
  endDateTime?: string,
  timeZone?: string
): EnabledInEnvironment {
  return {
    organizationEnvironmentId: `orgenv_${code}`,
    environmentCode: code,
    dateTimePeriod: { startDateTime, endDateTime, timeZone },
  };
}

// "Now" is pinned to Oct 13, 2026 so current-year dates drop their year.
beforeAll(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-13T12:00:00"));
});
afterAll(() => {
  vi.useRealTimers();
});

const ACTIVE = env("PRODUCTION", "2026-10-01T00:00:00");
const SCHEDULED = env("STAGING", "2026-11-01T00:00:00", "2026-12-31T23:59:00");
const EXPIRED = env("SANDBOX", "2026-01-01T00:00:00", "2026-06-01T00:00:00");
const LAST_YEAR = env("LEGACY", "2025-03-03T00:00:00");
const FUTURE_OPEN = env("PREVIEW", "2027-02-01T00:00:00");

describe("formatEnablementPeriod", () => {
  it("describes an open-ended active window as 'Since', without this year", () => {
    expect(formatEnablementPeriod(ACTIVE)).toBe("Since Oct 1");
  });

  it("shows a short year for dates outside the current year", () => {
    expect(formatEnablementPeriod(LAST_YEAR)).toBe("Since Mar 3 '25");
  });

  it("describes an open-ended future window as 'Starts'", () => {
    expect(formatEnablementPeriod(FUTURE_OPEN)).toBe("Starts Feb 1 '27");
  });

  it("shows a bounded window as a range", () => {
    expect(formatEnablementPeriod(SCHEDULED)).toBe("Nov 1 – Dec 31");
    expect(formatEnablementPeriod(EXPIRED)).toBe("Jan 1 – Jun 1");
  });
});

describe("isEnabledNow", () => {
  it("is true only when some window is open now", () => {
    expect(isEnabledNow([ACTIVE, SCHEDULED])).toBe(true);
    expect(isEnabledNow([SCHEDULED, EXPIRED])).toBe(false);
    expect(isEnabledNow([])).toBe(false);
    expect(isEnabledNow(undefined)).toBe(false);
  });
});

describe("EnvironmentStatusColumn", () => {
  it("renders a dash when not enabled anywhere", () => {
    render(<EnvironmentStatusColumn enabledInEnvironments={[]} />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("shows every environment's dates inline, active first", () => {
    render(<EnvironmentStatusColumn enabledInEnvironments={[EXPIRED, SCHEDULED, ACTIVE]} />);

    expect(screen.getByText("Since Oct 1")).toBeInTheDocument();
    expect(screen.getByText("Nov 1 – Dec 31")).toBeInTheDocument();
    expect(screen.getByText("Jan 1 – Jun 1")).toBeInTheDocument();

    const codes = screen.getAllByText(/^(PRODUCTION|STAGING|SANDBOX)$/).map((el) => el.textContent);
    expect(codes).toEqual(["PRODUCTION", "STAGING", "SANDBOX"]);
  });

  it("announces status as text, not only color", () => {
    render(<EnvironmentStatusColumn enabledInEnvironments={[ACTIVE, SCHEDULED, EXPIRED]} />);

    expect(screen.getByText("(Active)")).toBeInTheDocument();
    expect(screen.getByText("(Scheduled)")).toBeInTheDocument();
    expect(screen.getByText("(Expired)")).toBeInTheDocument();
  });

  it("opens full times and time zone in the popover", () => {
    render(
      <EnvironmentStatusColumn
        enabledInEnvironments={[env("PRODUCTION", "2026-01-01T09:30:00", undefined, "UTC")]}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /1 environment enabled/i }));

    expect(screen.getByText(/January 1st, 2026 at 9:30 AM/)).toBeInTheDocument();
    expect(screen.getByText("Indefinite")).toBeInTheDocument();
    expect(screen.getByText("UTC")).toBeInTheDocument();
  });
});

describe("getEnvironmentColumn", () => {
  it("uses the shared key and header", () => {
    const column = getEnvironmentColumn<{ enabledInEnvironments?: EnabledInEnvironment[] }>();
    expect(column.key).toBe("enabledInEnvironments");
    expect(column.header).toBe(ENVIRONMENT_COLUMN_HEADER);
  });
});
