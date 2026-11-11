import type { MemberClient } from "../src/client";

// Shapes follow the API's JSON: customer ids are `cust_<32 hex>`, and the program account
// repeats the same id as a dashed UUID.
const A_UUID = "0a0a0a0a-0000-4000-8000-00000000000a";
const B_UUID = "0b0b0b0b-0000-4000-8000-00000000000b";
const external = (uuid: string) => `cust_${uuid.replace(/-/g, "")}`;
export const A = { customerId: external(A_UUID), externalId: "shopper-a", uuid: A_UUID };
export const B = { customerId: external(B_UUID), externalId: "shopper-b", uuid: B_UUID };
const uuidOf = (id: unknown) =>
  id === A.customerId ? A.uuid : id === B.customerId ? B.uuid : String(id);

const NOW = Date.now();
const iso = (offsetDays: number) => new Date(NOW + offsetDays * 86_400_000).toISOString();

export interface Call {
  method: string;
  args: unknown[];
}

/**
 * An in-memory stand-in for the parts of `LoomLoyalty` the member tools use. Its data
 * deliberately includes member B everywhere, so a tool that trusts the server filter alone
 * would leak B's rows.
 */
export function fakeClient(
  overrides: Partial<Record<string, (...args: unknown[]) => unknown>> = {}
) {
  const calls: Call[] = [];
  const record =
    (method: string, impl: (...args: unknown[]) => unknown) =>
    async (...args: unknown[]) => {
      calls.push({ method, args });
      const override = overrides[method];
      return (override ?? impl)(...args);
    };

  const customers = [
    {
      customerId: A.customerId,
      externalId: A.externalId,
      emailAddresses: [{ emailAddress: "a@example.com" }],
      identity: { firstName: "Ada" },
    },
    {
      customerId: B.customerId,
      externalId: B.externalId,
      emailAddresses: [{ emailAddress: "b@example.com" }],
      identity: { firstName: "Bo" },
    },
  ];

  const client = {
    customer: {
      listCustomers: record("listCustomers", (params) => {
        const externalId = (params as { externalId?: string }).externalId;
        // Ignores the filter on purpose: the tools must not rely on it.
        return { content: externalId === "nobody" ? [] : customers };
      }),
    },
    programBank: {
      getEntityProgramAccount: record("getEntityProgramAccount", (_type, id) => ({
        programAccountId: "pacct_00000000000000000000000000000001",
        programAccountEntityId: uuidOf(id),
        programAccountType: "CUSTOMER",
        programLedgers: {
          BEANS: [
            {
              programLedgerId: "6c1d2f00-0000-4000-8000-000000000001",
              program: { programId: "prog_1", code: "coffee", name: "Coffee Club" },
              programCurrency: { programCurrencyId: "cur_1", code: "BEANS", name: "Beans" },
            },
          ],
        },
        programLedgerBalances: {
          BEANS: {
            earned: id === A.customerId ? 1000 : 5,
            pending: 20,
            posted: id === A.customerId ? 980 : 5,
            debited: 80,
            available: id === A.customerId ? 900 : 5,
            expired: 0,
          },
        },
      })),
    },
    customerStatus: {
      // The API groups by tier and marks the one it counts as current `active`.
      listCustomerTiers: record("listCustomerTiers", (_type, id) => ({
        customerEntityType: "CUSTOMER",
        customerEntityId: id,
        tiers:
          id === B.customerId
            ? bTiers
            : [
                {
                  tier: {
                    tierId: "tier_silver",
                    code: "SILVER",
                    name: "Silver",
                    rank: 2,
                    programIds: ["prog_1"],
                  },
                  details: [{ eventId: "e1", dateTimePeriod: { startDateTime: iso(-10) } }],
                  count: 1,
                  active: true,
                  lifetimeTier: false,
                  trialTier: false,
                },
                {
                  tier: {
                    tierId: "tier_bronze",
                    code: "BRONZE",
                    name: "Bronze",
                    rank: 1,
                    programIds: ["prog_1"],
                  },
                  details: [
                    {
                      eventId: "e0",
                      dateTimePeriod: { startDateTime: iso(-100), endDateTime: iso(-10) },
                    },
                  ],
                  count: 1,
                  active: false,
                  lifetimeTier: false,
                  trialTier: false,
                },
              ],
      })),
    },
    customerStatusManagement: {
      listTiersByProgramId: record("listTiersByProgramId", () => [
        { tierId: "tier-bronze", code: "BRONZE", name: "Bronze", rank: 1 },
        { tierId: "tier-silver", code: "SILVER", name: "Silver", rank: 2 },
        { tierId: "tier-gold", code: "GOLD", name: "Gold", rank: 3 },
      ]),
    },
    customerOffer: {
      // The API scopes coupons by the path and doesn't repeat the member's id on rows, so
      // B's coupon only comes back on B's path.
      listEntityCoupons: record("listEntityCoupons", (_type, id) => ({
        content: id === B.customerId ? bCoupons : aCoupons,
      })),
    },
  };

  return { client: client as unknown as MemberClient, calls };
}

const offer = (code: string, name: string) => ({
  offerId: `offer_${code}`,
  code,
  name,
  programIds: [],
  type: "COUPON",
});

// API times carry no offset; they're in the period's time zone.
const local = (offsetDays: number) => iso(offsetDays).replace("Z", "");
const UTC = "UTC";

const bTiers = [
  {
    tier: { tierId: "tier_gold", code: "GOLD", name: "Gold", rank: 3, programIds: ["prog_1"] },
    details: [],
    count: 1,
    active: true,
  },
];

const aCoupons = [
  {
    customerCouponId: "cc-1",
    entityType: "CUSTOMER",
    entityId: A.customerId,
    dateTimePeriod: { startDateTime: local(-1), endDateTime: local(7), timeZone: UTC },
    couponUses: [],
    coupon: {
      couponId: "c1",
      couponCode: "BDAY-2X",
      couponOffer: offer("BDAY", "Birthday double points"),
    },
  },
  {
    // Held, then released: available again.
    customerCouponId: "cc-returned",
    entityType: "CUSTOMER",
    entityId: A.customerId,
    couponUses: [{ status: "RETURN" }],
    coupon: {
      couponId: "c5",
      couponCode: "FREE-SHIP",
      couponOffer: offer("SHIP", "Free shipping"),
    },
  },
  {
    customerCouponId: "cc-expired",
    entityType: "CUSTOMER",
    entityId: A.customerId,
    dateTimePeriod: { startDateTime: local(-30), endDateTime: local(-1), timeZone: UTC },
    coupon: { couponId: "c2", couponCode: "OLD", couponOffer: offer("OLD", "Expired offer") },
  },
  {
    // No end of its own; the coupon's own window has ended.
    customerCouponId: "cc-coupon-expired",
    entityType: "CUSTOMER",
    entityId: A.customerId,
    dateTimePeriod: { startDateTime: local(-30), timeZone: UTC },
    coupon: {
      couponId: "c6",
      couponCode: "LAPSED",
      dateTimePeriod: { endDateTime: local(-2), timeZone: UTC },
      couponOffer: offer("LAPSED", "Lapsed coupon"),
    },
  },
  {
    customerCouponId: "cc-cancelled",
    entityType: "CUSTOMER",
    entityId: A.customerId,
    cancelled: true,
    coupon: { couponId: "c3", couponCode: "GONE", couponOffer: offer("GONE", "Cancelled offer") },
  },
  {
    customerCouponId: "cc-used",
    entityType: "CUSTOMER",
    entityId: A.customerId,
    couponUses: [{ status: "USE" }],
    coupon: { couponId: "c7", couponCode: "USED", couponOffer: offer("USED", "Used coupon") },
  },
  {
    customerCouponId: "cc-held",
    entityType: "CUSTOMER",
    entityId: A.customerId,
    couponUses: [{ status: "HOLD" }],
    coupon: { couponId: "c8", couponCode: "HELD", couponOffer: offer("HELD", "Held coupon") },
  },
];

export const bCoupon = {
  customerCouponId: "cc-b",
  entityType: "CUSTOMER",
  entityId: B.customerId,
  coupon: {
    couponId: "c4",
    couponCode: "B-ONLY",
    couponOffer: offer("BONLY", "B's private offer"),
  },
};
const bCoupons = [bCoupon];
