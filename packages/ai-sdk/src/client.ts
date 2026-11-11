import { LoomLoyalty } from "@loom-loyalty/sdk/client";

/**
 * The read methods of the Loom Loyalty client the member tools call. Anything with this shape
 * works, which is how the tests pass an in-memory client.
 */
export interface MemberClient {
  customer: Pick<LoomLoyalty["customer"], "listCustomers">;
  programBank: Pick<LoomLoyalty["programBank"], "getEntityProgramAccount">;
  customerStatus: Pick<LoomLoyalty["customerStatus"], "listCustomerTiers">;
  customerStatusManagement: Pick<LoomLoyalty["customerStatusManagement"], "listTiersByProgramId">;
  customerOffer: Pick<LoomLoyalty["customerOffer"], "listEntityCoupons">;
}

/** Thrown when the tools are created without what they need. */
export class LoomLoyaltyConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LoomLoyaltyConfigError";
  }
}

function env(name: string): string | undefined {
  const value = typeof process === "undefined" ? undefined : process.env[name];
  return value?.trim() ? value.trim() : undefined;
}

export function createClient(options: { apiUrl?: string; apiKey?: string }): MemberClient {
  const baseUrl = options.apiUrl?.trim() || env("LOOM_LOYALTY_API_URL");
  const apiKey = options.apiKey?.trim() || env("LOOM_LOYALTY_API_KEY");
  if (!baseUrl) {
    throw new LoomLoyaltyConfigError(
      "Set LOOM_LOYALTY_API_URL (or pass apiUrl) to use the Loom Loyalty tools."
    );
  }
  if (!apiKey) {
    throw new LoomLoyaltyConfigError(
      "Set LOOM_LOYALTY_API_KEY (or pass apiKey) to use the Loom Loyalty tools."
    );
  }
  return new LoomLoyalty({ baseUrl: baseUrl.replace(/\/+$/, ""), tokenProvider: () => apiKey });
}
