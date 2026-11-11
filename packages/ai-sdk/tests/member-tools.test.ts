import { ApiError } from "@loom-loyalty/sdk/core";
import { afterEach, describe, expect, it, vi } from "vitest";

import * as pkg from "../src/index";
import { LoomLoyaltyConfigError, memberTools, type MemberTools } from "../src/index";
import { A, B, bCoupon, fakeClient } from "./fake-client";

const KEY = "llk_test_secret_key_value";
const ENV = { LOOM_LOYALTY_API_URL: "https://api.example.com", LOOM_LOYALTY_API_KEY: KEY };

async function run(tools: MemberTools, name: keyof MemberTools, input: unknown = {}) {
  const tool = tools[name] as unknown as {
    execute: (
      input: unknown,
      options: { toolCallId: string; messages: unknown[]; abortSignal?: AbortSignal }
    ) => Promise<unknown>;
  };
  return tool.execute(input, { toolCallId: "call-1", messages: [] });
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("P1 configuration", () => {
  it("builds the three read tools from LOOM_LOYALTY_API_URL and LOOM_LOYALTY_API_KEY", () => {
    vi.stubEnv("LOOM_LOYALTY_API_URL", ENV.LOOM_LOYALTY_API_URL);
    vi.stubEnv("LOOM_LOYALTY_API_KEY", ENV.LOOM_LOYALTY_API_KEY);
    const tools = memberTools({ customerExternalId: A.externalId });
    expect(Object.keys(tools).sort()).toEqual(["getMyOffers", "getMyPoints", "getMyTier"]);
  });

  it.each([
    ["LOOM_LOYALTY_API_URL", { LOOM_LOYALTY_API_URL: "", LOOM_LOYALTY_API_KEY: KEY }],
    [
      "LOOM_LOYALTY_API_KEY",
      { LOOM_LOYALTY_API_URL: ENV.LOOM_LOYALTY_API_URL, LOOM_LOYALTY_API_KEY: "  " },
    ],
  ])("throws one clear error naming %s when it is missing", (missing, env) => {
    vi.stubEnv("LOOM_LOYALTY_API_URL", env.LOOM_LOYALTY_API_URL);
    vi.stubEnv("LOOM_LOYALTY_API_KEY", env.LOOM_LOYALTY_API_KEY);
    expect(() => memberTools({ customerExternalId: A.externalId })).toThrow(LoomLoyaltyConfigError);
    expect(() => memberTools({ customerExternalId: A.externalId })).toThrow(missing);
  });

  it.each(["", "   "])("throws on an empty customer external id (%j)", (customerExternalId) => {
    const { client } = fakeClient();
    expect(() => memberTools({ customerExternalId, client })).toThrow(LoomLoyaltyConfigError);
  });

  it("never puts the API key in the config error", () => {
    vi.stubEnv("LOOM_LOYALTY_API_URL", "");
    vi.stubEnv("LOOM_LOYALTY_API_KEY", KEY);
    try {
      memberTools({ customerExternalId: A.externalId });
    } catch (error) {
      expect(String((error as Error).message)).not.toContain(KEY);
    }
  });
});

describe("P2 one member only", () => {
  it("getMyPoints reads member A's account and reports per program currency", async () => {
    const { client, calls } = fakeClient();
    const result = await run(
      memberTools({ customerExternalId: A.externalId, client }),
      "getMyPoints"
    );
    expect(result).toEqual({
      programs: [{ program: "Coffee Club", currency: "Beans", available: 900, pending: 20 }],
    });
    expect(calls.find((c) => c.method === "getEntityProgramAccount")?.args.slice(0, 2)).toEqual([
      "CUSTOMER",
      A.customerId,
    ]);
  });

  it("getMyTier reports A's current tier and the next tier by rank, never B's Gold", async () => {
    const { client } = fakeClient();
    const result = await run(
      memberTools({ customerExternalId: A.externalId, client }),
      "getMyTier"
    );
    expect(result).toEqual({ tiers: [{ tier: "Silver", nextTier: "Gold" }] });
  });

  it("getMyOffers lists A's usable coupons only (no expired, cancelled, used, held or B's)", async () => {
    const { client } = fakeClient();
    const result = (await run(
      memberTools({ customerExternalId: A.externalId, client }),
      "getMyOffers"
    )) as {
      offers: { name: string; code?: string; validUntil?: string }[];
    };
    expect(result.offers.map((o) => o.name)).toEqual(["Birthday double points", "Free shipping"]);
    expect(result.offers[0]?.code).toBe("BDAY-2X");
    expect(result.offers[0]?.validUntil).toMatch(/Z$/);
  });

  it("property: no input the model sends changes whose data is read", async () => {
    const inputs: unknown[] = [
      {},
      { customerId: B.customerId },
      { customerExternalId: B.externalId },
      { externalId: B.externalId, id: B.customerId },
      B.uuid,
      null,
      [B.customerId],
    ];
    let seed = 7;
    const rand = () => (seed = (seed * 48271) % 2147483647) / 2147483647;
    for (let i = 0; i < 50; i++) {
      inputs.push({ [`k${Math.floor(rand() * 100)}`]: rand() > 0.5 ? B.customerId : B.externalId });
    }
    for (const input of inputs) {
      const { client, calls } = fakeClient();
      const tools = memberTools({ customerExternalId: A.externalId, client });
      for (const name of ["getMyPoints", "getMyTier", "getMyOffers"] as const) {
        const result = (await run(tools, name, input)) as { tiers?: { tier: string }[] };
        expect(JSON.stringify(result)).not.toContain("B-ONLY");
        // B holds Gold; it may only ever appear as A's next tier, never as a tier A holds.
        expect(result.tiers?.map((t) => t.tier) ?? []).not.toContain("Gold");
      }
      const entityIds = calls.filter((c) => c.args[0] === "CUSTOMER").map((c) => c.args[1]);
      expect(new Set(entityIds)).toEqual(new Set([A.customerId]));
    }
  });

  it("P2a drops rows the API returns for other members", async () => {
    const { client } = fakeClient({
      getEntityProgramAccount: () => ({
        programAccountId: "acct-b",
        programAccountEntityId: B.uuid,
        programAccountType: "CUSTOMER",
        programLedgers: {},
        programLedgerBalances: {},
      }),
      listCustomerTiers: () => ({
        customerEntityType: "CUSTOMER",
        customerEntityId: B.customerId,
        tiers: [{ tier: { name: "Gold", rank: 3 }, active: true }],
      }),
    });
    const tools = memberTools({ customerExternalId: A.externalId, client });
    expect(await run(tools, "getMyPoints")).toEqual({
      error: "Couldn't read this member's points right now.",
    });
    expect(await run(tools, "getMyTier")).toEqual({
      error: "Couldn't read this member's tier right now.",
    });
  });

  it("P2a refuses an offers list that carries another member's coupon", async () => {
    const { client } = fakeClient({ listEntityCoupons: () => ({ content: [bCoupon] }) });
    expect(
      await run(memberTools({ customerExternalId: A.externalId, client }), "getMyOffers")
    ).toEqual({ error: "Couldn't read this member's offers right now." });
  });

  it("P2b matches the external id ignoring case, as the API does", async () => {
    const { client } = fakeClient();
    const result = await run(
      memberTools({ customerExternalId: A.externalId.toUpperCase(), client }),
      "getMyTier"
    );
    expect(result).toEqual({ tiers: [{ tier: "Silver", nextTier: "Gold" }] });
  });

  it("P2b returns member not found when no customer matches", async () => {
    const { client, calls } = fakeClient();
    const tools = memberTools({ customerExternalId: "nobody", client });
    for (const name of ["getMyPoints", "getMyTier", "getMyOffers"] as const) {
      expect(await run(tools, name)).toEqual({ error: "Member not found." });
    }
    expect(calls.every((c) => c.method === "listCustomers")).toBe(true);
  });

  it("P2b fails closed when the external id matches more than one customer", async () => {
    const { client } = fakeClient({
      listCustomers: () => ({
        content: [
          { customerId: "x1", externalId: "dup" },
          { customerId: "x2", externalId: "dup" },
        ],
      }),
    });
    expect(await run(memberTools({ customerExternalId: "dup", client }), "getMyPoints")).toEqual({
      error: "Member not found.",
    });
  });

  it("resolves the member once per tools instance", async () => {
    const { client, calls } = fakeClient();
    const tools = memberTools({ customerExternalId: A.externalId, client });
    await run(tools, "getMyPoints");
    await run(tools, "getMyTier");
    await run(tools, "getMyOffers");
    expect(calls.filter((c) => c.method === "listCustomers")).toHaveLength(1);
  });

  it("P2c outputs carry no email, name or internal ids", async () => {
    const { client } = fakeClient();
    const tools = memberTools({ customerExternalId: A.externalId, client });
    const all = JSON.stringify([
      await run(tools, "getMyPoints"),
      await run(tools, "getMyTier"),
      await run(tools, "getMyOffers"),
    ]);
    for (const leak of [
      "a@example.com",
      "Ada",
      A.customerId,
      A.uuid,
      "pacct_",
      "6c1d2f00",
      "tier_silver",
      "prog_1",
      "cc-1",
      "offer_",
    ]) {
      expect(all).not.toContain(leak);
    }
  });
});

describe("P3b time zones", () => {
  it("uses the new offset for a time just after a daylight-saving change", async () => {
    // Chicago moves to CDT (UTC-5) at 2:00 on 2027-03-14, so 3:30 that morning is 08:30Z.
    const { client } = fakeClient({
      listEntityCoupons: () => ({
        content: [
          {
            entityId: A.customerId,
            dateTimePeriod: { endDateTime: "2027-03-14T03:30:00", timeZone: "America/Chicago" },
            coupon: { couponCode: "DST", couponOffer: { name: "Spring forward" } },
          },
        ],
      }),
    });
    const result = (await run(
      memberTools({ customerExternalId: A.externalId, client }),
      "getMyOffers"
    )) as { offers: { validUntil?: string }[] };
    expect(result.offers[0]?.validUntil).toBe("2027-03-14T08:30:00.000Z");
  });

  it("reads a period's times in its own time zone", async () => {
    // One hour from now on a Chicago wall clock. Read as UTC it would be about five hours ago.
    const chicago = new Intl.DateTimeFormat("sv-SE", {
      timeZone: "America/Chicago",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .format(new Date(Date.now() + 3_600_000))
      .replace(" ", "T");
    const { client } = fakeClient({
      listEntityCoupons: () => ({
        content: [
          {
            entityId: A.customerId,
            dateTimePeriod: { endDateTime: chicago, timeZone: "America/Chicago" },
            coupon: { couponCode: "SOON", couponOffer: { name: "Ends within the hour" } },
          },
        ],
      }),
    });
    const result = (await run(
      memberTools({ customerExternalId: A.externalId, client }),
      "getMyOffers"
    )) as { offers: { name: string; validUntil?: string }[] };
    expect(result.offers.map((o) => o.name)).toEqual(["Ends within the hour"]);
    const until = Date.parse(result.offers[0]!.validUntil!);
    expect(Math.abs(until - (Date.now() + 3_600_000))).toBeLessThan(5_000);
  });
});

describe("P3 members without activity", () => {
  it("a member with no program account has no points yet, not an error", async () => {
    const { client } = fakeClient({
      getEntityProgramAccount: () => {
        throw new ApiError({ message: "Not found", status: 404 });
      },
    });
    expect(
      await run(memberTools({ customerExternalId: A.externalId, client }), "getMyPoints")
    ).toEqual({ programs: [] });
  });

  it("a member with no tier gets an empty list", async () => {
    const { client } = fakeClient({
      listCustomerTiers: () => ({
        customerEntityType: "CUSTOMER",
        customerEntityId: A.customerId,
        tiers: [],
      }),
    });
    expect(
      await run(memberTools({ customerExternalId: A.externalId, client }), "getMyTier")
    ).toEqual({ tiers: [] });
  });
});

describe("P4 errors and timeouts", () => {
  it.each([
    [401, "The Loom Loyalty API key is invalid or has been revoked."],
    [403, "The Loom Loyalty API key isn't allowed to read this."],
    [429, "Loom Loyalty is busy. Try again in a moment."],
    [503, "Loom Loyalty couldn't answer right now. Try again in a moment."],
  ])("maps HTTP %i to a short message", async (status, message) => {
    const { client } = fakeClient({
      listCustomers: () => {
        throw new ApiError({ message: `boom Bearer ${KEY}`, status });
      },
    });
    const result = await run(
      memberTools({ customerExternalId: A.externalId, client }),
      "getMyPoints"
    );
    expect(result).toEqual({ error: message });
    expect(JSON.stringify(result)).not.toContain(KEY);
  });

  it("retries the member lookup on the next call after it timed out", async () => {
    let lookups = 0;
    const { client } = fakeClient({
      listCustomers: () => {
        lookups += 1;
        // The first lookup never answers; the second does.
        return lookups === 1
          ? new Promise(() => {})
          : { content: [{ customerId: A.customerId, externalId: A.externalId }] };
      },
    });
    const tools = memberTools({ customerExternalId: A.externalId, client, timeoutMs: 20 });
    expect(await run(tools, "getMyTier")).toEqual({
      error: "Loom Loyalty took too long to answer. Try again in a moment.",
    });
    expect(await run(tools, "getMyTier")).toEqual({
      tiers: [{ tier: "Silver", nextTier: "Gold" }],
    });
    expect(lookups).toBe(2);
  });

  it("returns an error result after the timeout instead of hanging", async () => {
    const { client } = fakeClient({ listCustomers: () => new Promise(() => {}) });
    const tools = memberTools({ customerExternalId: A.externalId, client, timeoutMs: 20 });
    expect(await run(tools, "getMyPoints")).toEqual({
      error: "Loom Loyalty took too long to answer. Try again in a moment.",
    });
  });

  it("honours the AI SDK abort signal", async () => {
    const { client } = fakeClient({ listCustomers: () => new Promise(() => {}) });
    const tools = memberTools({ customerExternalId: A.externalId, client });
    const controller = new AbortController();
    const tool = tools.getMyPoints as unknown as {
      execute: (
        i: unknown,
        o: { toolCallId: string; messages: unknown[]; abortSignal?: AbortSignal }
      ) => Promise<unknown>;
    };
    const pending = tool.execute(
      {},
      { toolCallId: "c", messages: [], abortSignal: controller.signal }
    );
    controller.abort();
    expect(await pending).toEqual({ error: "The request was cancelled." });
  });

  it("does not treat a thrown non-API error as a crash", async () => {
    const { client } = fakeClient({
      listCustomers: () => {
        throw new Error(`socket hang up ${KEY}`);
      },
    });
    const result = await run(
      memberTools({ customerExternalId: A.externalId, client }),
      "getMyTier"
    );
    expect(result).toEqual({
      error: "Loom Loyalty couldn't answer right now. Try again in a moment.",
    });
  });
});

describe("P5 tolerant reads", () => {
  it("ignores unknown fields and enum values", async () => {
    const { client } = fakeClient({
      listCustomerTiers: () => ({
        customerEntityType: "SOMETHING_NEW",
        customerEntityId: A.customerId,
        brandNewField: { nested: true },
        tiers: [
          {
            active: true,
            sourceType: "SOMETHING_NEW",
            tier: { tierId: "t", code: "X", name: "Platinum", rank: 9, futureFlag: "yes" },
          },
        ],
      }),
      listTiersByProgramId: () => [],
    });
    expect(
      await run(memberTools({ customerExternalId: A.externalId, client }), "getMyTier")
    ).toEqual({ tiers: [{ tier: "Platinum" }] });
  });

  const day = 86_400_000;
  const silverRow = (overrides: Record<string, unknown> = {}) => ({
    customerEntityId: A.customerId,
    dateTimePeriod: { startDateTime: new Date(Date.now() - day).toISOString() },
    tier: { name: "Silver", rank: 2, programIds: ["prog_1"] },
    ...overrides,
  });

  it.each([
    ["a single assignment", () => silverRow()],
    ["a list of assignments", () => [silverRow()]],
    ["a page of assignments", () => ({ content: [silverRow()] })],
  ])("reads the current tier from %s", async (_label, response) => {
    const { client } = fakeClient({ listCustomerTiers: response });
    expect(
      await run(memberTools({ customerExternalId: A.externalId, client }), "getMyTier")
    ).toEqual({ tiers: [{ tier: "Silver", nextTier: "Gold" }] });
  });

  it("skips raw assignments that are cancelled, ended, not started or another member's", async () => {
    const past = new Date(Date.now() - day).toISOString();
    const future = new Date(Date.now() + day).toISOString();
    const { client } = fakeClient({
      listCustomerTiers: () => [
        silverRow({ cancelled: true }),
        silverRow({ dateTimePeriod: { startDateTime: past, endDateTime: past } }),
        silverRow({ dateTimePeriod: { startDateTime: future } }),
        silverRow({ customerEntityId: B.customerId }),
      ],
    });
    expect(
      await run(memberTools({ customerExternalId: A.externalId, client }), "getMyTier")
    ).toEqual({ tiers: [] });
  });

  it("names every program that shares a currency, since the balance is per currency", async () => {
    const ledger = (name: string) => ({
      program: { name },
      programCurrency: { code: "PTS", name: "Points" },
    });
    const { client } = fakeClient({
      getEntityProgramAccount: () => ({
        programAccountEntityId: A.uuid,
        programLedgers: { PTS: [ledger("Coffee Club"), ledger("Bakery Club")] },
        programLedgerBalances: { PTS: { available: 50, pending: 5 } },
      }),
    });
    expect(
      await run(memberTools({ customerExternalId: A.externalId, client }), "getMyPoints")
    ).toEqual({
      programs: [
        { program: "Coffee Club, Bakery Club", currency: "Points", available: 50, pending: 5 },
      ],
    });
  });

  it("uses the coupon's start when the member's own period has none", async () => {
    const start = new Date(Date.now() + day).toISOString();
    const { client } = fakeClient({
      listEntityCoupons: () => ({
        content: [
          {
            entityId: A.customerId,
            coupon: {
              couponCode: "LATER",
              couponOffer: { name: "Not yet" },
              dateTimePeriod: { startDateTime: start },
            },
          },
          {
            entityId: A.customerId,
            dateTimePeriod: { endDateTime: new Date(Date.now() + 2 * day).toISOString() },
            coupon: {
              couponCode: "LATER-2",
              couponOffer: { name: "Own end, coupon start later" },
              dateTimePeriod: { startDateTime: start },
            },
          },
        ],
      }),
    });
    expect(
      await run(memberTools({ customerExternalId: A.externalId, client }), "getMyOffers")
    ).toEqual({ offers: [] });
  });
});

describe("P6 read-only surface", () => {
  it("exports memberTools and its error type only, no write or operator tools", () => {
    expect(Object.keys(pkg).sort()).toEqual(["LoomLoyaltyConfigError", "memberTools"]);
  });

  it("calls only read methods on the client", async () => {
    const { client, calls } = fakeClient();
    const tools = memberTools({ customerExternalId: A.externalId, client });
    await run(tools, "getMyPoints");
    await run(tools, "getMyTier");
    await run(tools, "getMyOffers");
    for (const call of calls) expect(call.method).toMatch(/^(list|get)/);
  });
});

describe("P7 stable tool contract", () => {
  it("tool names, descriptions and empty input schemas match the snapshot", () => {
    const { client } = fakeClient();
    const tools = memberTools({ customerExternalId: A.externalId, client });
    const contract = Object.fromEntries(
      Object.entries(tools).map(([name, t]) => {
        const tool = t as unknown as {
          description: string;
          inputSchema: { safeParse: (v: unknown) => { success: boolean } };
        };
        return [
          name,
          {
            description: tool.description,
            acceptsEmptyInput: tool.inputSchema.safeParse({}).success,
          },
        ];
      })
    );
    expect(contract).toMatchInlineSnapshot(`
      {
        "getMyOffers": {
          "acceptsEmptyInput": true,
          "description": "List the offers and coupons the signed-in shopper can use right now, with their codes and end dates.",
        },
        "getMyPoints": {
          "acceptsEmptyInput": true,
          "description": "Get the signed-in shopper's loyalty points balance in each program: available to spend now and pending.",
        },
        "getMyTier": {
          "acceptsEmptyInput": true,
          "description": "Get the signed-in shopper's current loyalty tier in each program, and the name of the next tier up when there is one.",
        },
      }
    `);
  });
});
