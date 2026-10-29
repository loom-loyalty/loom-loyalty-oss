// Regression test for the AI-drafted badge reward review flow: the NL generator
// emits `{ issueCustomerBadge: { badgeCode } }` with NO `badgeId`, but the badge
// selector is keyed by id. The editor must resolve the code → id so the reviewer
// sees the chosen badge instead of an empty "Select badge…" control.

import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

interface BadgeFieldProps {
  value: string;
  onValueChange: (id: string) => void;
}
let badgeField: BadgeFieldProps | null = null;

vi.mock("../../forms/badge-field/index.js", () => ({
  BadgeField: (p: BadgeFieldProps) => {
    badgeField = p;
    return null;
  },
}));

const BADGES = [{ badgeId: "badge-uuid-1", code: "VIP", name: "VIP Member" }];

vi.mock("../../forms/badge-field/use-badge-field.js", () => ({
  useBadgeField: () => ({
    badges: BADGES,
    findBadge: (id: string) => BADGES.find((b) => (b.badgeId ?? b.code) === id),
  }),
}));

const { IssueBadgeActionComponent } = await import("./issue-badge-action");

function renderWith(value: Record<string, unknown>): void {
  badgeField = null;
  render(<IssueBadgeActionComponent value={value as never} onChange={vi.fn()} />);
}

describe("IssueBadgeActionComponent — badge selector value resolution", () => {
  it("resolves an AI-drafted badgeCode-only value to the badge's id", () => {
    renderWith({ badgeCode: "VIP" });
    // The AI never sets badgeId; the selector (keyed by id) must still show the badge.
    expect(badgeField!.value).toBe("badge-uuid-1");
  });

  it("prefers an explicit badgeId when present", () => {
    renderWith({ badgeId: "badge-uuid-1", badgeCode: "VIP" });
    expect(badgeField!.value).toBe("badge-uuid-1");
  });

  it("shows an empty selector when the badgeCode matches no loaded badge", () => {
    // An unresolvable code selects nothing (rather than mislabeling); the human can
    // still pick from the list, and it self-corrects if the badge loads later.
    renderWith({ badgeCode: "GHOST" });
    expect(badgeField!.value).toBe("");
  });

  it("shows an empty selector for a blank action", () => {
    renderWith({});
    expect(badgeField!.value).toBe("");
  });
});
