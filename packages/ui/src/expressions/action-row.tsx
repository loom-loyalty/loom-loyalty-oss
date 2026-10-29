import { ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { type ReactNode, useCallback, useId } from "react";

import { cn } from "../lib/utils.js";
import { Badge } from "../primitives/badge.js";
import { Button } from "../primitives/button.js";
import { getActionCategoryColor } from "./action-category-colors.js";
import { getActionSummary } from "./action-summaries.js";
import type { ActionSummaryLookups } from "./action-summary-lookups.js";
import { AddCounterDataActionComponent } from "./actions/add-counter-data-action.js";
import { AddCustomerToAudienceActionComponent } from "./actions/add-customer-to-audience-action.js";
import { CancelCouponActionComponent } from "./actions/cancel-coupon-action.js";
import { CancelCustomerExternalOfferActionComponent } from "./actions/cancel-customer-external-offer-action.js";
import { CompleteTargetActionComponent } from "./actions/complete-target-action.js";
import { CouponLifecycleActionComponent } from "./actions/coupon-lifecycle-actions.js";
import { IssueBadgeActionComponent } from "./actions/issue-badge-action.js";
import { IssueCouponActionComponent } from "./actions/issue-coupon-action.js";
import { IssueCurrencyActionComponent } from "./actions/issue-currency-action.js";
import { IssueCustomerExternalOfferActionComponent } from "./actions/issue-customer-external-offer-action.js";
import { IssueTierActionComponent } from "./actions/issue-tier-action.js";
import { MetadataTaggingActionComponent } from "./actions/metadata-tagging-action.js";
import { RegisterTargetActionComponent } from "./actions/register-target-action.js";
import { RemoveCustomerFromAudienceActionComponent } from "./actions/remove-customer-from-audience-action.js";
import { SendNotificationActionComponent } from "./actions/send-notification-action.js";
import { WithdrawCurrencyActionComponent } from "./actions/withdraw-currency-action.js";
import type { ExpressionAction, ExpressionPresentation } from "./types.js";
import { ACTION_TYPE_NAMES, getActionData, getActionType } from "./utils.js";

export interface ActionRowProps {
  action: ExpressionAction;
  index: number;
  expanded: boolean;
  disabled?: boolean;
  isLast: boolean;
  presentation?: ExpressionPresentation;
  resolve: ActionSummaryLookups;
  onExpand: () => void;
  onRemove: () => void;
  onChange: (action: ExpressionAction) => void;
}

// New action type? Add a case here AND in action-summaries.tsx's
// getActionSummary switch — see utils.ts's ACTION_CATEGORIES comment for the
// full list of places a new action type must be registered (adversarial
// review finding: nothing enforces these switches stay in sync at compile
// time).
function renderActionComponent(
  action: ExpressionAction,
  onChange: (action: ExpressionAction) => void,
  disabled: boolean | undefined,
  presentation: ExpressionPresentation
): ReactNode {
  const type = getActionType(action);
  const data = getActionData(action);
  const handleChange = (newData: Record<string, unknown>) => {
    onChange({ [type]: newData } as unknown as ExpressionAction);
  };

  switch (type) {
    case "issueProgramCurrency":
      return (
        <IssueCurrencyActionComponent
          value={data as Parameters<typeof IssueCurrencyActionComponent>[0]["value"]}
          onChange={handleChange as Parameters<typeof IssueCurrencyActionComponent>[0]["onChange"]}
          disabled={disabled}
          presentation={presentation}
        />
      );
    case "withdrawProgramCurrency":
      return (
        <WithdrawCurrencyActionComponent
          value={data as Parameters<typeof WithdrawCurrencyActionComponent>[0]["value"]}
          onChange={
            handleChange as Parameters<typeof WithdrawCurrencyActionComponent>[0]["onChange"]
          }
          disabled={disabled}
          presentation={presentation}
        />
      );
    case "issueCustomerCoupon":
      return (
        <IssueCouponActionComponent
          value={data as Parameters<typeof IssueCouponActionComponent>[0]["value"]}
          onChange={handleChange as Parameters<typeof IssueCouponActionComponent>[0]["onChange"]}
          disabled={disabled}
          presentation={presentation}
        />
      );
    case "useCustomerCoupon":
    case "holdCustomerCoupon":
    case "returnCustomerCoupon":
      return (
        <CouponLifecycleActionComponent
          value={data as Parameters<typeof CouponLifecycleActionComponent>[0]["value"]}
          onChange={
            handleChange as Parameters<typeof CouponLifecycleActionComponent>[0]["onChange"]
          }
          disabled={disabled}
          presentation={presentation}
        />
      );
    case "cancelCustomerCoupon":
      return (
        <CancelCouponActionComponent
          value={data as Parameters<typeof CancelCouponActionComponent>[0]["value"]}
          onChange={handleChange as Parameters<typeof CancelCouponActionComponent>[0]["onChange"]}
          disabled={disabled}
          presentation={presentation}
        />
      );
    case "issueCustomerBadge":
      return (
        <IssueBadgeActionComponent
          value={data as Parameters<typeof IssueBadgeActionComponent>[0]["value"]}
          onChange={handleChange as Parameters<typeof IssueBadgeActionComponent>[0]["onChange"]}
          disabled={disabled}
          presentation={presentation}
        />
      );
    case "issueCustomerTier":
      return (
        <IssueTierActionComponent
          value={data as Parameters<typeof IssueTierActionComponent>[0]["value"]}
          onChange={handleChange as Parameters<typeof IssueTierActionComponent>[0]["onChange"]}
          disabled={disabled}
          presentation={presentation}
        />
      );
    case "registerTarget":
      return (
        <RegisterTargetActionComponent
          value={data as Parameters<typeof RegisterTargetActionComponent>[0]["value"]}
          onChange={handleChange as Parameters<typeof RegisterTargetActionComponent>[0]["onChange"]}
          disabled={disabled}
          presentation={presentation}
        />
      );
    case "addCounterData":
      return (
        <AddCounterDataActionComponent
          value={data as Parameters<typeof AddCounterDataActionComponent>[0]["value"]}
          onChange={handleChange as Parameters<typeof AddCounterDataActionComponent>[0]["onChange"]}
          disabled={disabled}
          presentation={presentation}
        />
      );
    case "completeTargetData":
      return (
        <CompleteTargetActionComponent
          value={data as Parameters<typeof CompleteTargetActionComponent>[0]["value"]}
          onChange={handleChange as Parameters<typeof CompleteTargetActionComponent>[0]["onChange"]}
          disabled={disabled}
          presentation={presentation}
        />
      );
    case "addCustomerToAudience":
      return (
        <AddCustomerToAudienceActionComponent
          value={data as Parameters<typeof AddCustomerToAudienceActionComponent>[0]["value"]}
          onChange={
            handleChange as Parameters<typeof AddCustomerToAudienceActionComponent>[0]["onChange"]
          }
          disabled={disabled}
          presentation={presentation}
        />
      );
    case "removeCustomerFromAudience":
      return (
        <RemoveCustomerFromAudienceActionComponent
          value={data as Parameters<typeof RemoveCustomerFromAudienceActionComponent>[0]["value"]}
          onChange={
            handleChange as Parameters<
              typeof RemoveCustomerFromAudienceActionComponent
            >[0]["onChange"]
          }
          disabled={disabled}
          presentation={presentation}
        />
      );
    case "metadataTagging":
      return (
        <MetadataTaggingActionComponent
          value={data as Parameters<typeof MetadataTaggingActionComponent>[0]["value"]}
          onChange={
            handleChange as Parameters<typeof MetadataTaggingActionComponent>[0]["onChange"]
          }
          disabled={disabled}
          presentation={presentation}
        />
      );
    case "sendNotification":
      return (
        <SendNotificationActionComponent
          value={data as Parameters<typeof SendNotificationActionComponent>[0]["value"]}
          onChange={
            handleChange as Parameters<typeof SendNotificationActionComponent>[0]["onChange"]
          }
          disabled={disabled}
          presentation={presentation}
        />
      );
    case "issueCustomerExternalOffer":
      return (
        <IssueCustomerExternalOfferActionComponent
          value={data as Parameters<typeof IssueCustomerExternalOfferActionComponent>[0]["value"]}
          onChange={
            handleChange as Parameters<
              typeof IssueCustomerExternalOfferActionComponent
            >[0]["onChange"]
          }
          disabled={disabled}
          presentation={presentation}
        />
      );
    case "cancelCustomerExternalOffer":
      return (
        <CancelCustomerExternalOfferActionComponent
          value={data as Parameters<typeof CancelCustomerExternalOfferActionComponent>[0]["value"]}
          onChange={
            handleChange as Parameters<
              typeof CancelCustomerExternalOfferActionComponent
            >[0]["onChange"]
          }
          disabled={disabled}
          presentation={presentation}
        />
      );
    default:
      return <p className="text-muted-foreground text-xs">Unknown action type: {type}</p>;
  }
}

export function ActionRow({
  action,
  index,
  expanded,
  disabled,
  isLast,
  presentation = "card",
  resolve,
  onExpand,
  onRemove,
  onChange,
}: ActionRowProps): ReactNode {
  const panelId = `action-panel-${useId()}`;
  const type = getActionType(action);
  const data = getActionData(action);
  const handleChange = useCallback(
    (nextAction: ExpressionAction) => onChange(nextAction),
    [onChange]
  );

  return (
    <div
      className={cn(
        !isLast && "border-border border-b",
        expanded && "bg-muted shadow-[inset_2px_0_0_var(--primary)]"
      )}
    >
      <div className="flex items-start gap-[10px] px-[14px] py-[11px]">
        <span className="text-muted-foreground w-2.5 shrink-0 pt-0.5 font-mono text-[11px]">
          {index + 1}
        </span>
        <span
          className={cn(getActionCategoryColor(type), "h-[34px] w-[3px] shrink-0 rounded-full")}
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1 space-y-1">
          <Badge variant="outline" className="self-start text-[11px]">
            {ACTION_TYPE_NAMES[type] ?? type}
          </Badge>
          <p className="text-muted-foreground text-sm leading-5">
            {getActionSummary(type, data, resolve)}
          </p>
        </div>
        <div className="flex shrink-0 items-center">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onRemove}
            disabled={disabled}
            className="text-destructive hover:text-destructive min-h-11 min-w-11 p-0 sm:h-9 sm:w-9"
            aria-label={`Remove action ${index + 1}`}
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onExpand}
            disabled={disabled}
            className="min-h-11 min-w-11 p-0 sm:h-9 sm:w-9"
            aria-label={`${expanded ? "Collapse" : "Expand"} action ${index + 1}`}
            aria-expanded={expanded}
            aria-controls={panelId}
          >
            {expanded ? (
              <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
            )}
          </Button>
        </div>
      </div>
      {expanded && (
        <div id={panelId} className="space-y-4 pt-1 pr-[14px] pb-4 pl-[37px]">
          {renderActionComponent(action, handleChange, disabled, presentation)}
        </div>
      )}
    </div>
  );
}
