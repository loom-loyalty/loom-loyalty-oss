import { ArrowUpRight, Gift, Pin, PinOff, Sparkles, TrendingDown, TrendingUp } from "lucide-react";
import * as React from "react";
import { cn } from "../../../../lib/utils.js";
import { Badge } from "../../../../primitives/badge.js";
import { Button } from "../../../../primitives/button.js";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../../primitives/card.js";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../../../../primitives/tooltip.js";
import type { BanditStatus, OfferRecommendation } from "../types.js";
import { formatLastUpdate } from "../utils.js";
import { BanditStatusIndicator } from "./bandit-status-indicator.js";
import { ConfidenceScoreBadge } from "./confidence-score-gauge.js";

export interface NextBestOfferPanelProps {
  offers: OfferRecommendation[];
  banditStatus: BanditStatus;
  explorationInteractions?: number;
  onPinToggle?: (offerCode: string, isPinned: boolean) => void;
  onViewOffer?: (offerCode: string) => void;
  isPinning?: boolean;
  className?: string;
}

/**
 * Displays AI-recommended offers for a THREADS segment with conversion rates and pinning.
 */
export function NextBestOfferPanel({
  offers,
  banditStatus,
  explorationInteractions,
  onPinToggle,
  onViewOffer,
  isPinning,
  className,
}: NextBestOfferPanelProps) {
  // Sort offers: pinned first, then by confidence score
  const sortedOffers = React.useMemo(() => {
    return [...offers].sort((a, b) => {
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
      return b.confidenceScore - a.confidenceScore;
    });
  }, [offers]);

  return (
    <Card className={cn("glass border-border", className)}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              <Gift className="text-primary h-5 w-5" />
              Next Best Offers
            </CardTitle>
            <CardDescription>AI-recommended offers ranked by predicted conversion</CardDescription>
          </div>
          <BanditStatusIndicator
            status={banditStatus}
            explorationInteractions={explorationInteractions}
            showProgress
            size="sm"
          />
        </div>
      </CardHeader>
      <CardContent>
        {sortedOffers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="bg-primary/10 rounded-full p-3">
              <Sparkles className="text-primary h-6 w-6" />
            </div>
            <p className="text-muted-foreground mt-3 text-sm">
              No offer recommendations yet. The AI needs more data to make suggestions.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {sortedOffers.map((offer, index) => (
              <OfferRecommendationRow
                key={offer.offerTypeCode}
                offer={offer}
                rank={index + 1}
                onPinToggle={onPinToggle}
                onViewOffer={onViewOffer}
                isPinning={isPinning}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Single offer recommendation row
 */
function OfferRecommendationRow({
  offer,
  rank,
  onPinToggle,
  onViewOffer,
  isPinning,
}: {
  offer: OfferRecommendation;
  rank: number;
  onPinToggle?: (offerCode: string, isPinned: boolean) => void;
  onViewOffer?: (offerCode: string) => void;
  isPinning?: boolean;
}) {
  const expectedRate = Math.round(offer.expectedConversionRate * 100);
  const historicalRate = offer.historicalConversionRate
    ? Math.round(offer.historicalConversionRate * 100)
    : null;

  // Calculate conversion rate delta
  const rateDelta = historicalRate !== null ? expectedRate - historicalRate : null;
  const isImproving = rateDelta !== null && rateDelta > 0;

  return (
    <div
      className={cn(
        "group rounded-lg border p-3 transition-all",
        offer.isPinned
          ? "border-primary/30 bg-primary/5"
          : "border-border hover:border-primary/30 hover:bg-primary/5"
      )}
    >
      <div className="flex items-start gap-3">
        {/* Rank indicator */}
        <div
          className={cn(
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-medium",
            rank === 1
              ? "bg-accent/10 text-accent"
              : rank === 2
                ? "bg-muted text-foreground"
                : rank === 3
                  ? "bg-accent/10 text-accent"
                  : "bg-muted text-muted-foreground"
          )}
        >
          {rank}
        </div>

        {/* Offer info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-medium">{offer.offerTypeName}</span>
            {offer.isPinned && (
              <Badge variant="outline" className="border-primary/40 text-primary">
                <Pin className="mr-1 h-3 w-3" />
                Pinned
              </Badge>
            )}
          </div>
          <div className="text-muted-foreground mt-0.5 font-mono text-xs">
            {offer.offerTypeCode}
          </div>
        </div>

        {/* Confidence and conversion rates */}
        <div className="flex shrink-0 items-center gap-3">
          <ConfidenceScoreBadge score={offer.confidenceScore} />

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="text-right">
                  <div className="flex items-center gap-1">
                    <span className="text-primary text-lg font-bold">{expectedRate}%</span>
                    {rateDelta !== null && (
                      <span
                        className={cn(
                          "flex items-center text-xs font-medium",
                          isImproving ? "text-success-dark" : "text-destructive"
                        )}
                      >
                        {isImproving ? (
                          <TrendingUp className="h-3 w-3" />
                        ) : (
                          <TrendingDown className="h-3 w-3" />
                        )}
                        {Math.abs(rateDelta)}%
                      </span>
                    )}
                  </div>
                  <div className="text-muted-foreground text-xs">expected conversion</div>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <div className="space-y-1">
                  <p>
                    <strong>Expected:</strong> {expectedRate}% conversion
                  </p>
                  {historicalRate !== null && (
                    <p>
                      <strong>Historical:</strong> {historicalRate}% conversion
                    </p>
                  )}
                  <p className="text-muted-foreground text-xs">
                    Last updated: {formatLastUpdate(offer.lastUpdated)}
                  </p>
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Actions */}
          <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            {onPinToggle && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                aria-label={offer.isPinned ? "Unpin offer" : "Pin offer"}
                onClick={() => onPinToggle(offer.offerTypeCode, !offer.isPinned)}
                disabled={isPinning}
              >
                {offer.isPinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
              </Button>
            )}
            {onViewOffer && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                aria-label="View offer details"
                onClick={() => onViewOffer(offer.offerTypeCode)}
              >
                <ArrowUpRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Compact list variant for sidebars
 */
export function NextBestOfferList({
  offers,
  maxItems = 3,
  onViewOffer,
  className,
}: {
  offers: OfferRecommendation[];
  maxItems?: number;
  onViewOffer?: (offerCode: string) => void;
  className?: string;
}) {
  const topOffers = offers
    .slice()
    .sort((a, b) => {
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
      return b.confidenceScore - a.confidenceScore;
    })
    .slice(0, maxItems);

  return (
    <div className={cn("space-y-2", className)}>
      {topOffers.map((offer, index) => (
        <Button
          key={offer.offerTypeCode}
          variant="ghost"
          className="h-auto w-full justify-start gap-2 p-2"
          onClick={() => onViewOffer?.(offer.offerTypeCode)}
        >
          <div
            className={cn(
              "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-medium",
              index === 0 ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
            )}
          >
            {index + 1}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{offer.offerTypeName}</div>
            <div className="text-muted-foreground text-xs">
              {Math.round(offer.expectedConversionRate * 100)}% expected
            </div>
          </div>
          {offer.isPinned && <Pin className="text-primary h-3 w-3" />}
        </Button>
      ))}
    </div>
  );
}
