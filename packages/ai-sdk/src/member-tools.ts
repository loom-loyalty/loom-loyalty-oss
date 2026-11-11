import type { Tool } from "ai";
import { z } from "zod";

import { createClient, LoomLoyaltyConfigError, type MemberClient } from "./client";
import {
  bounded,
  isNotFound,
  MemberNotFound,
  OtherMembersData,
  toToolError,
  type ToolError,
} from "./errors";

const CUSTOMER = "CUSTOMER";
const DEFAULT_TIMEOUT_MS = 10_000;

export interface MemberToolsOptions {
  /**
   * The shopper's id in your own system, as stored on their Loom Loyalty customer record.
   * Your server decides who the shopper is; the model can never change it.
   */
  customerExternalId: string;
  /** Defaults to `LOOM_LOYALTY_API_URL`. */
  apiUrl?: string;
  /** Defaults to `LOOM_LOYALTY_API_KEY`. Use a read-only key; it must stay on the server. */
  apiKey?: string;
  /** Per tool call. Defaults to 10 seconds. */
  timeoutMs?: number;
  /** A client to use instead of building one from `apiUrl` and `apiKey`. */
  client?: MemberClient;
}

export interface PointsResult {
  programs: {
    program: string;
    currency: string;
    available: number;
    pending: number;
  }[];
}

export interface TierResult {
  tiers: { tier: string; nextTier?: string }[];
}

export interface OffersResult {
  offers: { name: string; code?: string; validFrom?: string; validUntil?: string }[];
}

type NoInput = Record<string, never>;

// A type alias, not an interface: AI SDK's `ToolSet` has an index signature, which an interface
// doesn't satisfy, so `tools: memberTools(...)` would fail to type-check.
export type MemberTools = {
  getMyPoints: Tool<NoInput, PointsResult | ToolError>;
  getMyTier: Tool<NoInput, TierResult | ToolError>;
  getMyOffers: Tool<NoInput, OffersResult | ToolError>;
};

interface Period {
  startDateTime?: string;
  endDateTime?: string;
  /** IANA zone the times are written in when they carry no offset. */
  timeZone?: string;
}

/**
 * Milliseconds since the epoch for one end of a period. The API writes times without an offset,
 * in the period's own time zone (UTC when it names none).
 */
function instant(value: string | undefined, timeZone: string | undefined): number | undefined {
  if (!value) return undefined;
  if (/(Z|[+-]\d{2}:?\d{2})$/i.test(value)) return Date.parse(value);
  const asUtc = Date.parse(`${value}Z`);
  if (Number.isNaN(asUtc) || !timeZone || timeZone === "UTC") return asUtc;
  try {
    const format = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    // The zone's offset from UTC at an instant, in milliseconds.
    const offsetAt = (ms: number) => {
      const parts = format.formatToParts(new Date(ms));
      const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
      const shown = Date.UTC(
        get("year"),
        get("month") - 1,
        get("day"),
        get("hour"),
        get("minute"),
        get("second")
      );
      return shown - Math.floor(ms / 1000) * 1000;
    };
    // Guess with the offset at the wall time read as UTC, then correct with the offset at the
    // guess, so a time just after a daylight-saving change gets the new offset.
    const guess = asUtc - offsetAt(asUtc);
    return asUtc - offsetAt(guess);
  } catch {
    return asUtc;
  }
}

function iso(ms: number | undefined): string | undefined {
  return ms === undefined || Number.isNaN(ms) ? undefined : new Date(ms).toISOString();
}

interface TierEntry {
  active?: boolean;
  cancelled?: boolean;
  customerEntityId?: string;
  dateTimePeriod?: Period;
  tier?: { name?: string; rank?: number; programIds?: string[] };
}

function activeAt(period: Period | undefined, now: number): boolean {
  const from = instant(period?.startDateTime, period?.timeZone);
  const until = instant(period?.endDateTime, period?.timeZone);
  return !(from !== undefined && from > now) && !(until !== undefined && until <= now);
}

/** Coupon use statuses that make a coupon unavailable, as the API counts it. */
const SPENT = new Set(["HOLD", "USE"]);

function rowsOf<T>(page: unknown): T[] {
  if (Array.isArray(page)) return page as T[];
  const content = (page as { content?: unknown } | null)?.content;
  return Array.isArray(content) ? (content as T[]) : [];
}

/**
 * The API writes the same id as `cust_<32 hex>` in some fields and as a dashed UUID in others.
 * Both reduce to the 32 hex digits.
 */
function sameId(a: string, b: string): boolean {
  const bare = (id: string) =>
    id
      .toLowerCase()
      .replace(/^[a-z]+_/, "")
      .replace(/-/g, "");
  return bare(a) === bare(b);
}

/** True when a response says it belongs to someone else. A response that doesn't say is kept. */
function belongsToOther(entityId: unknown, customerId: string): boolean {
  return typeof entityId === "string" && !sameId(entityId, customerId);
}

function amount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

const noInput = z.object({}).strict() as unknown as z.ZodType<NoInput>;

/**
 * Read-only AI SDK tools for one shopper: their points, tier and offers.
 *
 * Every tool reads the member named by `customerExternalId` and nobody else: no tool takes a
 * customer as input, and rows the API returns for anyone else are dropped. Errors come back as
 * `{ error }` results the model can relay, never as thrown exceptions.
 */
export function memberTools(options: MemberToolsOptions): MemberTools {
  const externalId = options.customerExternalId?.trim();
  if (!externalId) {
    throw new LoomLoyaltyConfigError(
      "memberTools needs the signed-in shopper's customerExternalId."
    );
  }
  const client = options.client ?? createClient(options);
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  let member: Promise<string> | undefined;
  const customerId = (): Promise<string> => {
    // The lookup has its own time limit, so a stalled one fails and is dropped from the cache
    // instead of every later call waiting on it.
    member ??= bounded(
      (async () => {
        const page = await client.customer.listCustomers({ externalId, page: 0, size: 2 });
        const matches = rowsOf<{ customerId?: string; externalId?: string }>(page).filter(
          // The API matches external ids ignoring case, so this does too.
          (c) =>
            typeof c.externalId === "string" &&
            c.externalId.toLowerCase() === externalId.toLowerCase() &&
            typeof c.customerId === "string"
        );
        if (matches.length !== 1) throw new MemberNotFound();
        return matches[0]!.customerId!;
      })(),
      timeoutMs
    );
    // A failed lookup (timeout, 5xx) is retried on the next call instead of cached.
    member.catch(() => (member = undefined));
    return member;
  };

  const readTool = <T>(
    description: string,
    readFailed: string,
    read: (id: string) => Promise<T>
  ): Tool<NoInput, T | ToolError> =>
    ({
      description,
      inputSchema: noInput,
      execute: async (_input: unknown, callOptions?: { abortSignal?: AbortSignal }) => {
        try {
          return await bounded(customerId().then(read), timeoutMs, callOptions?.abortSignal);
        } catch (error) {
          return toToolError(error, readFailed);
        }
      },
    }) as unknown as Tool<NoInput, T | ToolError>;

  return {
    getMyPoints: readTool(
      "Get the signed-in shopper's loyalty points balance in each program: available to spend now and pending.",
      "Couldn't read this member's points right now.",
      async (id): Promise<PointsResult> => {
        let account;
        try {
          account = (await client.programBank.getEntityProgramAccount(CUSTOMER, id, {
            includeProgramLedgerBalances: true,
          })) as unknown as {
            programAccountEntityId?: string;
            // Keyed by currency code, both of them.
            programLedgers?: Record<
              string,
              { program?: { name?: string }; programCurrency?: { name?: string } }[]
            >;
            programLedgerBalances?: Record<string, { available?: unknown; pending?: unknown }>;
          };
        } catch (error) {
          if (isNotFound(error)) return { programs: [] };
          throw error;
        }
        if (belongsToOther(account.programAccountEntityId, id)) throw new OtherMembersData();
        const balances = account.programLedgerBalances ?? {};
        return {
          programs: Object.entries(account.programLedgers ?? {}).map(([code, ledgers]) => {
            // The API keeps one balance per currency code. When programs share a currency, the
            // balance can't be split between them, so the row names them all.
            const list = Array.isArray(ledgers) ? ledgers : [];
            const programs = [...new Set(list.map((l) => l.program?.name).filter(Boolean))];
            const balance = balances[code] ?? {};
            return {
              program: programs.join(", "),
              currency: list[0]?.programCurrency?.name ?? code,
              available: amount(balance.available),
              pending: amount(balance.pending),
            };
          }),
        };
      }
    ),

    getMyTier: readTool(
      "Get the signed-in shopper's current loyalty tier in each program, and the name of the next tier up when there is one.",
      "Couldn't read this member's tier right now.",
      async (id): Promise<TierResult> => {
        // The API answers { customerEntityId, tiers: [{ tier, active }] }, one entry per tier the
        // member has held, with the current one marked `active` in the organization's time zone.
        // A single assignment, a list or a page of assignments is read too.
        const response = (await client.customerStatus.listCustomerTiers(
          CUSTOMER,
          id
        )) as unknown as TierEntry & { customerEntityId?: string; tiers?: TierEntry[] };
        if (belongsToOther(response?.customerEntityId, id)) throw new OtherMembersData();
        const now = Date.now();
        const entries: TierEntry[] = Array.isArray(response?.tiers)
          ? response.tiers
          : (response?.tier ? [response] : rowsOf<TierEntry>(response)).map((row) => ({
              ...row,
              active:
                !row.cancelled &&
                activeAt(row.dateTimePeriod, now) &&
                !belongsToOther(row.customerEntityId, id),
            }));

        const current = new Map<string, { name: string; rank: number; programId?: string }>();
        for (const entry of entries) {
          if (entry.active !== true || !entry.tier?.name) continue;
          const programId = entry.tier.programIds?.[0];
          const key = programId ?? `tier:${entry.tier.name}`;
          const rank = entry.tier.rank ?? 0;
          const held = current.get(key);
          if (!held || rank > held.rank)
            current.set(key, { name: entry.tier.name, rank, programId });
        }

        const tiers: TierResult["tiers"] = [];
        for (const held of current.values()) {
          let nextTier: string | undefined;
          if (held.programId) {
            const ladder = await client.customerStatusManagement.listTiersByProgramId(
              held.programId
            );
            nextTier = rowsOf<{ name?: string; rank?: number }>(ladder)
              .filter((t) => typeof t.rank === "number" && t.rank > held.rank && t.name)
              .sort((a, b) => a.rank! - b.rank!)[0]?.name;
          }
          tiers.push(nextTier ? { tier: held.name, nextTier } : { tier: held.name });
        }
        return { tiers };
      }
    ),

    getMyOffers: readTool(
      "List the offers and coupons the signed-in shopper can use right now, with their codes and end dates.",
      "Couldn't read this member's offers right now.",
      async (id): Promise<OffersResult> => {
        const now = Date.now();
        const rows = rowsOf<{
          entityId?: string;
          cancelled?: boolean;
          dateTimePeriod?: Period;
          couponUses?: { status?: string }[];
          coupon?: {
            couponCode?: string;
            dateTimePeriod?: Period;
            couponOffer?: { name?: string };
          };
        }>(await client.customerOffer.listEntityCoupons(CUSTOMER, id));
        const offers: OffersResult["offers"] = [];
        for (const row of rows) {
          if (belongsToOther(row.entityId, id)) throw new OtherMembersData();
          const name = row.coupon?.couponOffer?.name;
          if (!name || row.cancelled) continue;
          if ((row.couponUses ?? []).some((use) => SPENT.has(String(use.status)))) continue;
          // Same rule as the API: the member's own window ends it when it has an end, else the coupon's.
          const own = row.dateTimePeriod;
          const starts = own?.startDateTime ? own : row.coupon?.dateTimePeriod;
          const ends = own?.endDateTime ? own : row.coupon?.dateTimePeriod;
          const from = instant(starts?.startDateTime, starts?.timeZone);
          const until = instant(ends?.endDateTime, ends?.timeZone);
          if (from !== undefined && from > now) continue;
          if (until !== undefined && until <= now) continue;
          offers.push({
            name,
            ...(row.coupon?.couponCode ? { code: row.coupon.couponCode } : {}),
            ...(iso(from) ? { validFrom: iso(from) } : {}),
            ...(iso(until) ? { validUntil: iso(until) } : {}),
          });
        }
        return { offers };
      }
    ),
  };
}
