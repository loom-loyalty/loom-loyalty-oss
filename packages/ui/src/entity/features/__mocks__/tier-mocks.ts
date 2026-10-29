/**
 * Mock Tier data for testing and Storybook stories.
 *
 * Uses the SDK Tier type structure.
 */

import type { Tier } from "@loom-loyalty/sdk";

/**
 * Sample tiers representing a typical loyalty tier structure
 */
export const mockTiers: Tier[] = [
  {
    tierId: "tier_00000000000000000000000platinum",
    code: "platinum",
    name: "Platinum",
    rank: 1,
    durationPeriod: {
      durationPeriodType: "SLIDING",
      durationPeriod: "MONTHS",
      durationPeriodValue: 12,
    },
    programIds: ["prog-001"],
    description: { en: "Our most exclusive tier with premium benefits" },
    subscription: false,
    createdDateTime: "2024-01-01T00:00:00Z",
    modifiedDateTime: "2024-06-15T10:30:00Z",
  },
  {
    tierId: "tier_00000000000000000000000000gold",
    code: "gold",
    name: "Gold",
    rank: 2,
    durationPeriod: {
      durationPeriodType: "SLIDING",
      durationPeriod: "MONTHS",
      durationPeriodValue: 12,
    },
    programIds: ["prog-001"],
    description: { en: "Enhanced benefits for valued customers" },
    subscription: false,
    tierExpiryDowngradeTierId: "tier_abc123def456ghi789jkl012mno",
    createdDateTime: "2024-01-01T00:00:00Z",
    modifiedDateTime: "2024-06-15T10:30:00Z",
  },
  {
    tierId: "tier_0000000000000000000000000silver",
    code: "silver",
    name: "Silver",
    rank: 3,
    durationPeriod: {
      durationPeriodType: "SLIDING",
      durationPeriod: "MONTHS",
      durationPeriodValue: 12,
    },
    programIds: ["prog-001"],
    description: { en: "Great benefits for regular customers" },
    subscription: false,
    tierExpiryDowngradeTierId: "tier_abc123def456ghi789jkl012mno",
    createdDateTime: "2024-01-01T00:00:00Z",
    modifiedDateTime: "2024-06-15T10:30:00Z",
  },
  {
    tierId: "tier_0000000000000000000000000bronze",
    code: "bronze",
    name: "Bronze",
    rank: 4,
    durationPeriod: {
      durationPeriodType: "SLIDING",
      durationPeriod: "MONTHS",
      durationPeriodValue: 12,
    },
    programIds: ["prog-001"],
    description: { en: "Welcome tier for new members" },
    subscription: false,
    createdDateTime: "2024-01-01T00:00:00Z",
    modifiedDateTime: "2024-06-15T10:30:00Z",
  },
];

/**
 * Single tier for testing
 */
export const mockSingleTier: Tier = mockTiers[0] as Tier;

/**
 * Empty tier list for testing empty state
 */
export const mockEmptyTiers: Tier[] = [];

/**
 * Many tiers for testing scrolling/pagination
 */
export const mockManyTiers: Tier[] = [
  ...mockTiers,
  {
    tierId: "tier_0000000000000000000000000member",
    code: "member",
    name: "Member",
    rank: 5,
    programIds: ["prog-001"],
    description: { en: "Standard membership tier" },
    createdDateTime: "2024-01-01T00:00:00Z",
    modifiedDateTime: "2024-06-15T10:30:00Z",
  },
  {
    tierId: "tier_00000000000000000000000000basic",
    code: "basic",
    name: "Basic",
    rank: 6,
    programIds: ["prog-001"],
    description: { en: "Entry level tier" },
    createdDateTime: "2024-01-01T00:00:00Z",
    modifiedDateTime: "2024-06-15T10:30:00Z",
  },
  {
    tierId: "tier_000000000000000000000000starter",
    code: "starter",
    name: "Starter",
    rank: 7,
    programIds: ["prog-001"],
    description: { en: "Getting started tier" },
    createdDateTime: "2024-01-01T00:00:00Z",
    modifiedDateTime: "2024-06-15T10:30:00Z",
  },
  {
    tierId: "tier_00000000000000000000000000trial",
    code: "trial",
    name: "Trial",
    rank: 8,
    programIds: ["prog-001"],
    description: { en: "Trial membership tier" },
    createdDateTime: "2024-01-01T00:00:00Z",
    modifiedDateTime: "2024-06-15T10:30:00Z",
  },
  {
    tierId: "tier_0000000000000000000000000000vip",
    code: "vip",
    name: "VIP",
    rank: 9,
    programIds: ["prog-001"],
    description: { en: "Special VIP tier" },
    subscription: true,
    createdDateTime: "2024-01-01T00:00:00Z",
    modifiedDateTime: "2024-06-15T10:30:00Z",
  },
  {
    tierId: "tier_00000000000000000000000000elite",
    code: "elite",
    name: "Elite",
    rank: 10,
    programIds: ["prog-001"],
    description: { en: "Elite membership tier" },
    subscription: true,
    createdDateTime: "2024-01-01T00:00:00Z",
    modifiedDateTime: "2024-06-15T10:30:00Z",
  },
];

/**
 * Tiers with subscription flags
 */
export const mockSubscriptionTiers: Tier[] = mockTiers.map((tier, index) => ({
  ...tier,
  subscription: index < 2, // First two are subscription tiers
}));
