import { describe, expect, it } from "vitest";

import type { CustomerAudience } from "./types.js";
import {
  calculateTotalWeight,
  formatBehaviorWeight,
  formatConfidenceScore,
  formatConversionRate,
  formatCronExpression,
  formatMemberCount,
  formatMemberCountChange,
  formatOverlapPercentage,
  formatQueryDuration,
  getAudienceMemberCount,
  getAudienceStatus,
  getAudienceTypeLabel,
  getSegmentComputationNote,
  getTopBehaviors,
  isAudienceActive,
  sortBehaviorsByWeight,
} from "./utils.js";

// ---------------------------------------------------------------------------
// formatConfidenceScore
// ---------------------------------------------------------------------------
describe("formatConfidenceScore", () => {
  it("converts 0-1 to percentage string", () => {
    expect(formatConfidenceScore(0.85)).toBe("85%");
    expect(formatConfidenceScore(0)).toBe("0%");
    expect(formatConfidenceScore(1)).toBe("100%");
  });

  it("rounds to nearest integer", () => {
    expect(formatConfidenceScore(0.856)).toBe("86%");
    expect(formatConfidenceScore(0.854)).toBe("85%");
  });
});

// ---------------------------------------------------------------------------
// formatMemberCount
// ---------------------------------------------------------------------------
describe("formatMemberCount", () => {
  it("returns em dash for null/undefined", () => {
    expect(formatMemberCount(null)).toBe("\u2014");
    expect(formatMemberCount(undefined)).toBe("\u2014");
  });

  it("returns '0' for zero", () => {
    expect(formatMemberCount(0)).toBe("0");
  });

  it("formats millions with M suffix", () => {
    expect(formatMemberCount(1_500_000)).toBe("1.5M");
    expect(formatMemberCount(1_000_000)).toBe("1.0M");
  });

  it("formats thousands with K suffix", () => {
    expect(formatMemberCount(1_500)).toBe("1.5K");
    expect(formatMemberCount(1_000)).toBe("1.0K");
  });

  it("formats small numbers with locale string", () => {
    expect(formatMemberCount(999)).toBe("999");
    expect(formatMemberCount(42)).toBe("42");
  });
});

// ---------------------------------------------------------------------------
// formatBehaviorWeight
// ---------------------------------------------------------------------------
describe("formatBehaviorWeight", () => {
  it("converts 0-1 to percentage string", () => {
    expect(formatBehaviorWeight(0.25)).toBe("25%");
    expect(formatBehaviorWeight(0)).toBe("0%");
  });
});

// ---------------------------------------------------------------------------
// formatCronExpression
// ---------------------------------------------------------------------------
describe("formatCronExpression", () => {
  it("recognizes every hour", () => {
    expect(formatCronExpression("0 * * * *")).toBe("Every hour");
  });

  it("recognizes daily at midnight", () => {
    expect(formatCronExpression("0 0 * * *")).toBe("Daily at midnight");
  });

  it("recognizes hourly interval (0 */N)", () => {
    expect(formatCronExpression("0 */6 * * *")).toBe("Every 6 hours");
  });

  it("recognizes hourly interval without leading 0", () => {
    expect(formatCronExpression("30 */4 * * *")).toBe("Every 4 hours");
  });

  it("returns raw cron for unrecognized patterns", () => {
    expect(formatCronExpression("5 4 * * 1")).toBe("5 4 * * 1");
  });

  it("returns raw cron for invalid format", () => {
    expect(formatCronExpression("not a cron")).toBe("not a cron");
  });
});

// ---------------------------------------------------------------------------
// formatQueryDuration
// ---------------------------------------------------------------------------
describe("formatQueryDuration", () => {
  it("formats milliseconds", () => {
    expect(formatQueryDuration(500)).toBe("500ms");
  });

  it("formats seconds", () => {
    expect(formatQueryDuration(2500)).toBe("2.5s");
  });

  it("formats minutes", () => {
    expect(formatQueryDuration(120_000)).toBe("2m");
  });
});

// ---------------------------------------------------------------------------
// formatMemberCountChange
// ---------------------------------------------------------------------------
describe("formatMemberCountChange", () => {
  it("prefixes positive with +", () => {
    expect(formatMemberCountChange(500)).toBe("+500");
  });

  it("prefixes negative with -", () => {
    expect(formatMemberCountChange(-1500)).toBe("-1.5K");
  });

  it("handles zero", () => {
    expect(formatMemberCountChange(0)).toBe("0");
  });
});

// ---------------------------------------------------------------------------
// formatConversionRate / formatOverlapPercentage
// ---------------------------------------------------------------------------
describe("formatConversionRate", () => {
  it("formats rate as percentage with one decimal", () => {
    expect(formatConversionRate(0.1234)).toBe("12.3%");
  });
});

describe("formatOverlapPercentage", () => {
  it("rounds to nearest integer percentage", () => {
    expect(formatOverlapPercentage(42.7)).toBe("43%");
  });
});

// ---------------------------------------------------------------------------
// getAudienceMemberCount
// ---------------------------------------------------------------------------
describe("getAudienceMemberCount", () => {
  it("returns 0 for null/undefined", () => {
    expect(getAudienceMemberCount(null)).toBe(0);
    expect(getAudienceMemberCount(undefined)).toBe(0);
  });

  it("returns memberCount for CustomerList", () => {
    const audience = {
      type: "CUSTOMER_LIST",
      memberCount: 500,
    } as CustomerAudience;
    expect(getAudienceMemberCount(audience)).toBe(500);
  });

  it("returns 0 when CustomerList has no memberCount", () => {
    const audience = {
      type: "CUSTOMER_LIST",
    } as CustomerAudience;
    expect(getAudienceMemberCount(audience)).toBe(0);
  });

  // loom-loyalty#1028: Platform API segments carry no engine config, so every
  // seeded lifecycle segment rendered 0 members.
  it("returns lastCardinality for a Platform API segment", () => {
    const audience = {
      type: "CUSTOMER_SEGMENT",
      lastCardinality: 42,
      computationStatus: "COMPLETED",
    } as CustomerAudience;
    expect(getAudienceMemberCount(audience)).toBe(42);
  });

  it("keeps a computed count of 0", () => {
    const audience = {
      type: "CUSTOMER_SEGMENT",
      lastCardinality: 0,
      computationStatus: "COMPLETED",
    } as CustomerAudience;
    expect(getAudienceMemberCount(audience)).toBe(0);
  });

  it("returns null for a segment that has never been computed", () => {
    const audience = {
      type: "CUSTOMER_SEGMENT",
      computationStatus: "PENDING",
      lastCardinality: null,
    } as CustomerAudience;
    expect(getAudienceMemberCount(audience)).toBeNull();
  });

  it("still reads engineConfig.memberCount for engine segments", () => {
    const audience = {
      type: "CUSTOMER_SEGMENT",
      engine: "CLICKHOUSE",
      engineConfig: { engine: "CLICKHOUSE", queryDefinition: "", memberCount: 12 },
    } as CustomerAudience;
    expect(getAudienceMemberCount(audience)).toBe(12);
  });
});

// ---------------------------------------------------------------------------
// getSegmentComputationNote
// ---------------------------------------------------------------------------
describe("getSegmentComputationNote", () => {
  const segment = (fields: Record<string, unknown>) =>
    ({ type: "CUSTOMER_SEGMENT", versionStatus: "PUBLISHED", ...fields }) as CustomerAudience;

  it("returns null for a list", () => {
    expect(getSegmentComputationNote({ type: "CUSTOMER_LIST" } as CustomerAudience)).toBeNull();
  });

  it("asks a draft segment to be published", () => {
    expect(getSegmentComputationNote(segment({ versionStatus: "DRAFT" }))).toBe(
      "Publish to compute"
    );
  });

  it("says a published segment has not been computed yet", () => {
    expect(getSegmentComputationNote(segment({ computationStatus: "PENDING" }))).toBe(
      "Not computed yet"
    );
  });

  it("reports a running or failed computation", () => {
    expect(getSegmentComputationNote(segment({ computationStatus: "COMPUTING" }))).toBe(
      "Computing now"
    );
    expect(
      getSegmentComputationNote(
        segment({ computationStatus: "FAILED", lastComputedDateTime: "2026-10-01T00:00:00Z" })
      )
    ).toBe("Last run failed");
  });

  it("says when a completed segment was last computed", () => {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    expect(
      getSegmentComputationNote(
        segment({ computationStatus: "COMPLETED", lastComputedDateTime: tenMinutesAgo })
      )
    ).toBe("Updated 10 minutes ago");
  });

  it("returns null when a segment carries no computation data", () => {
    expect(getSegmentComputationNote(segment({}))).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// getAudienceTypeLabel
// ---------------------------------------------------------------------------
describe("getAudienceTypeLabel", () => {
  it("returns Customer List for lists", () => {
    const audience = { type: "CUSTOMER_LIST" } as CustomerAudience;
    expect(getAudienceTypeLabel(audience)).toBe("Customer List");
  });

  it("returns engine label for segments", () => {
    const audience = { type: "CUSTOMER_SEGMENT", engine: "THREADS" } as CustomerAudience;
    expect(getAudienceTypeLabel(audience)).toBe("AI-Generated Segment");
  });

  it("falls back to raw engine for unknown engine", () => {
    const audience = {
      type: "CUSTOMER_SEGMENT",
      engine: "UNKNOWN",
    } as unknown as CustomerAudience;
    expect(getAudienceTypeLabel(audience)).toBe("UNKNOWN Segment");
  });
});

// ---------------------------------------------------------------------------
// isAudienceActive / getAudienceStatus
// ---------------------------------------------------------------------------
describe("isAudienceActive", () => {
  it("returns true for basic active audience", () => {
    const audience = { type: "CUSTOMER_LIST" } as CustomerAudience;
    expect(isAudienceActive(audience)).toBe(true);
  });

  it("returns false for archived THREADS segment", () => {
    const audience = {
      type: "CUSTOMER_SEGMENT",
      engine: "THREADS",
      engineConfig: { archivedAt: "2024-01-01T00:00:00Z" },
    } as CustomerAudience;
    expect(isAudienceActive(audience)).toBe(false);
  });
});

describe("getAudienceStatus", () => {
  it("returns inactive for null", () => {
    expect(getAudienceStatus(null)).toBe("inactive");
  });

  it("returns active for basic audience", () => {
    const audience = { type: "CUSTOMER_LIST" } as CustomerAudience;
    expect(getAudienceStatus(audience)).toBe("active");
  });

  it("returns archived for archived THREADS segment", () => {
    const audience = {
      type: "CUSTOMER_SEGMENT",
      engine: "THREADS",
      engineConfig: { archivedAt: "2024-01-01T00:00:00Z" },
    } as CustomerAudience;
    expect(getAudienceStatus(audience)).toBe("archived");
  });

  it("returns scheduled for future start date", () => {
    const futureDate = new Date(Date.now() + 86_400_000).toISOString();
    const audience = {
      type: "CUSTOMER_LIST",
      durationPeriod: {
        fixedDurationDateTimePeriod: { startDateTime: futureDate },
      },
    } as CustomerAudience;
    expect(getAudienceStatus(audience)).toBe("scheduled");
  });

  it("returns inactive for expired end date", () => {
    const pastStart = new Date(Date.now() - 86_400_000 * 10).toISOString();
    const pastEnd = new Date(Date.now() - 86_400_000).toISOString();
    const audience = {
      type: "CUSTOMER_LIST",
      durationPeriod: {
        fixedDurationDateTimePeriod: {
          startDateTime: pastStart,
          endDateTime: pastEnd,
        },
      },
    } as CustomerAudience;
    expect(getAudienceStatus(audience)).toBe("inactive");
  });
});

// ---------------------------------------------------------------------------
// sortBehaviorsByWeight / getTopBehaviors / calculateTotalWeight
// ---------------------------------------------------------------------------
describe("sortBehaviorsByWeight", () => {
  it("sorts descending by weight", () => {
    const behaviors = [
      { contributionWeight: 0.1 },
      { contributionWeight: 0.5 },
      { contributionWeight: 0.3 },
    ];
    const sorted = sortBehaviorsByWeight(behaviors);
    expect(sorted.map((b) => b.contributionWeight)).toEqual([0.5, 0.3, 0.1]);
  });

  it("does not mutate original array", () => {
    const behaviors = [{ contributionWeight: 0.1 }, { contributionWeight: 0.5 }];
    sortBehaviorsByWeight(behaviors);
    expect(behaviors[0]!.contributionWeight).toBe(0.1);
  });
});

describe("getTopBehaviors", () => {
  it("returns top N by weight", () => {
    const behaviors = [
      { contributionWeight: 0.1 },
      { contributionWeight: 0.5 },
      { contributionWeight: 0.3 },
      { contributionWeight: 0.2 },
    ];
    const top = getTopBehaviors(behaviors, 2);
    expect(top).toHaveLength(2);
    expect(top[0]!.contributionWeight).toBe(0.5);
    expect(top[1]!.contributionWeight).toBe(0.3);
  });
});

describe("calculateTotalWeight", () => {
  it("sums all weights", () => {
    const behaviors = [
      { contributionWeight: 0.3 },
      { contributionWeight: 0.5 },
      { contributionWeight: 0.2 },
    ];
    expect(calculateTotalWeight(behaviors)).toBeCloseTo(1.0);
  });

  it("returns 0 for empty array", () => {
    expect(calculateTotalWeight([])).toBe(0);
  });
});
