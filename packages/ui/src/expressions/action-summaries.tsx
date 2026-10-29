import type { ReactNode } from "react";

import type { ActionSummaryLookups } from "./action-summary-lookups.js";
import { SchemaValueChip } from "./components/schema-value-chip.js";

type ActionData = Record<string, unknown>;

export function missing(label: string): ReactNode {
  return <span className="text-destructive">Set {label}</span>;
}

export function val(value: unknown, kind: "number" | "string" = "string"): ReactNode {
  if (value === undefined || value === null || value === "") return null;
  return (
    <span
      className={kind === "number" ? "text-foreground font-mono" : "text-foreground font-medium"}
    >
      {String(value)}
    </span>
  );
}

export function schemaVal(path: unknown, resolve?: ActionSummaryLookups): ReactNode {
  return typeof path === "string" && path ? (
    <SchemaValueChip path={path} label={resolve?.fieldName?.(path)} />
  ) : null;
}

function resolved(
  resolver: (id?: string, code?: string) => string | undefined,
  id: unknown,
  code: unknown,
  label: string
): ReactNode {
  if (typeof id !== "string" && typeof code !== "string") return missing(label);
  const name = resolver(
    typeof id === "string" ? id : undefined,
    typeof code === "string" ? code : undefined
  );
  return name ? val(name) : missing(label);
}

function couponReference(data: ActionData, resolve: ActionSummaryLookups): ReactNode {
  if (typeof data.couponCode === "string" && data.couponCode) return val(data.couponCode);
  if (typeof data.couponId === "string" && data.couponId) return val(data.couponId);
  return resolved(resolve.offerName, data.couponOfferId, data.couponOfferCode, "coupon reference");
}

function dateRange(data: ActionData): ReactNode {
  const period = data.dateTimePeriod as Record<string, unknown> | undefined;
  const start = period?.startDateTime;
  const end = period?.endDateTime;
  if (!start && !end) return null;
  return (
    <>
      , valid {val(start ?? "—")} → {val(end ?? "—")}
    </>
  );
}

function amount(data: ActionData, resolve: ActionSummaryLookups, label = "amount"): ReactNode {
  if (!data.isFixedAmount && typeof data.path === "string" && data.path)
    return schemaVal(data.path, resolve);
  return val(data.defaultResult, "number") ?? missing(label);
}

// New action type? Add a case here AND in action-row.tsx's
// renderActionComponent switch — see utils.ts's ACTION_CATEGORIES comment
// for the full list of places a new action type must be registered
// (adversarial review finding: nothing enforces these switches stay in sync
// at compile time).
export function getActionSummary(
  type: string,
  data: ActionData,
  resolve: ActionSummaryLookups
): ReactNode {
  switch (type) {
    case "issueProgramCurrency":
      return (
        <>
          Issue {amount(data, resolve)} {val(data.programCurrencyCode) ?? missing("currency code")}{" "}
          to the customer
          {data.expiryDate ? <> , expires {val(data.expiryDate)}</> : null}
        </>
      );
    case "withdrawProgramCurrency":
      return (
        <>
          {"Withdraw "}
          {amount(data, resolve)} {val(data.programCurrencyCode) ?? missing("currency code")} from
          the customer
        </>
      );
    case "issueCustomerCoupon":
      return (
        <>
          Issue offer {couponReference(data, resolve)}
          {dateRange(data)}
        </>
      );
    case "useCustomerCoupon":
    case "holdCustomerCoupon":
    case "returnCustomerCoupon": {
      const verb =
        type === "useCustomerCoupon" ? "Use" : type === "holdCustomerCoupon" ? "Hold" : "Return";
      return (
        <>
          {verb} coupon{" "}
          {schemaVal(data.path, resolve) ?? val(data.defaultResult) ?? missing("coupon code")}
        </>
      );
    }
    case "cancelCustomerCoupon":
      return <>Cancel coupon {couponReference(data, resolve)}</>;
    case "issueCustomerBadge":
      return (
        <>
          Issue badge {resolved(resolve.badgeName, data.badgeId, data.badgeCode, "badge")}
          {(data.dateTimePeriod as Record<string, unknown> | undefined)?.endDateTime ? (
            <> expiring {val((data.dateTimePeriod as Record<string, unknown>).endDateTime)}</>
          ) : null}
        </>
      );
    case "issueCustomerTier": {
      const qualifier = data.issueLifetimeTier ? "lifetime " : data.issueTrialTier ? "trial " : "";
      return (
        <>
          Issue {qualifier}tier {resolved(resolve.tierName, data.tierId, data.tierCode, "tier")}
        </>
      );
    }
    case "registerTarget":
      return (
        <>
          Register target {resolved(resolve.targetName, data.targetId, data.targetCode, "target")}{" "}
          on {resolved(resolve.programName, data.programId, data.programCode, "program")}
        </>
      );
    case "addCounterData":
      return (
        <>
          Add {amount(data, resolve, "increment")} to target{" "}
          {resolved(resolve.targetName, data.targetId, data.targetCode, "target")}
          {data.registerTarget ? ", auto-registering if needed" : null}
        </>
      );
    case "completeTargetData":
      return (
        <>
          Complete target {resolved(resolve.targetName, data.targetId, data.targetCode, "target")}
        </>
      );
    case "metadataTagging":
      return (
        <>
          Tag {val(data.metadataCode) ?? missing("metadata code")} (
          {val(data.metadataTypeCode) ?? missing("metadata type code")})
          {data.weight !== undefined ? <> weight {val(data.weight, "number")}</> : null}
        </>
      );
    case "sendNotification":
      return (
        <>
          Send notification via {val(data.channelCode) ?? missing("channel code")} using template{" "}
          {val(data.templateCode) ?? missing("template code")}
        </>
      );
    case "addCustomerToAudience":
      return (
        <>
          Add customer to audience{" "}
          {resolved(
            resolve.audienceName,
            data.customerAudienceId,
            data.customerAudienceCode,
            "audience"
          )}
        </>
      );
    case "removeCustomerFromAudience":
      return (
        <>
          Remove customer from audience{" "}
          {resolved(
            resolve.audienceName,
            data.customerAudienceId,
            data.customerAudienceCode,
            "audience"
          )}
        </>
      );
    case "issueCustomerExternalOffer": {
      const denomination = data.partnerDenomination;
      return (
        <>
          Issue external offer {resolved(resolve.offerName, data.offerId, data.offerCode, "offer")}
          {denomination != null && denomination !== "" ? ` at ${String(denomination)}` : null}
        </>
      );
    }
    case "cancelCustomerExternalOffer":
      return (
        <>
          Cancel external offer {resolved(resolve.offerName, data.offerId, data.offerCode, "offer")}
        </>
      );
    default:
      return missing("action details");
  }
}
