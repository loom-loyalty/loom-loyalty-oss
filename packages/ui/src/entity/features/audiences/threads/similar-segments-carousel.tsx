import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  GitCompare,
  Layers,
  Sparkles,
  Users,
} from "lucide-react";
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
import { Checkbox } from "../../../../primitives/checkbox.js";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../../../../primitives/tooltip.js";
import type { SimilarSegmentReference } from "../types.js";
import { prefersReducedMotion } from "./viz-utils.js";

export interface SimilarSegmentsCarouselProps {
  segments: SimilarSegmentReference[];
  onSegmentClick?: (segmentId: string) => void;
  onCompare?: (segmentIds: string[]) => void;
  maxCompareCount?: number;
  className?: string;
}

/**
 * Horizontal carousel displaying similar/related segments with overlap indicators.
 * Allows selection for comparison.
 */
export function SimilarSegmentsCarousel({
  segments,
  onSegmentClick,
  onCompare,
  maxCompareCount = 3,
  className,
}: SimilarSegmentsCarouselProps) {
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = React.useState(false);
  const [canScrollRight, setCanScrollRight] = React.useState(false);
  const [selectedForCompare, setSelectedForCompare] = React.useState<Set<string>>(new Set());

  // Check scroll state
  const updateScrollState = React.useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    setCanScrollLeft(container.scrollLeft > 0);
    setCanScrollRight(container.scrollLeft < container.scrollWidth - container.clientWidth - 1);
  }, []);

  React.useEffect(() => {
    updateScrollState();
    const container = scrollContainerRef.current;
    if (container) {
      container.addEventListener("scroll", updateScrollState);
      window.addEventListener("resize", updateScrollState);
      return () => {
        container.removeEventListener("scroll", updateScrollState);
        window.removeEventListener("resize", updateScrollState);
      };
    }
  }, [updateScrollState, segments]);

  const scroll = (direction: "left" | "right") => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const scrollAmount = 280; // Card width + gap
    container.scrollBy({
      left: direction === "left" ? -scrollAmount : scrollAmount,
      behavior: prefersReducedMotion() ? "auto" : "smooth",
    });
  };

  const toggleCompareSelection = (segmentId: string) => {
    setSelectedForCompare((prev) => {
      const next = new Set(prev);
      if (next.has(segmentId)) {
        next.delete(segmentId);
      } else if (next.size < maxCompareCount) {
        next.add(segmentId);
      }
      return next;
    });
  };

  const handleCompare = () => {
    if (onCompare && selectedForCompare.size > 0) {
      onCompare(Array.from(selectedForCompare));
    }
  };

  if (segments.length === 0) {
    return (
      <Card className={cn("glass border-border", className)}>
        <CardContent className="flex flex-col items-center justify-center py-8 text-center">
          <div className="bg-primary/10 rounded-full p-3">
            <Layers className="text-primary h-6 w-6" />
          </div>
          <p className="text-muted-foreground mt-3 text-sm">
            No similar segments found yet. The AI will discover related segments as it learns more.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("glass border-border flex h-full flex-col", className)}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Layers className="text-primary h-5 w-5" />
              Similar Segments
            </CardTitle>
            <CardDescription>Related segments with overlapping customers</CardDescription>
          </div>

          {/* Compare button */}
          {onCompare && selectedForCompare.size > 0 && (
            <Button size="sm" onClick={handleCompare}>
              <GitCompare className="mr-2 h-4 w-4" />
              Compare ({selectedForCompare.size})
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="relative flex flex-1 flex-col">
        {/* Scroll buttons */}
        {canScrollLeft && (
          <Button
            variant="outline"
            size="icon"
            className="bg-background absolute top-1/2 -left-3 z-10 h-8 w-8 -translate-y-1/2 rounded-full shadow-md"
            aria-label="Scroll left"
            onClick={() => scroll("left")}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        )}
        {canScrollRight && (
          <Button
            variant="outline"
            size="icon"
            className="bg-background absolute top-1/2 -right-3 z-10 h-8 w-8 -translate-y-1/2 rounded-full shadow-md"
            aria-label="Scroll right"
            onClick={() => scroll("right")}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        )}

        {/* Carousel container */}
        <div
          ref={scrollContainerRef}
          role="region"
          aria-label="Similar segments"
          className="scrollbar-hide flex gap-4 overflow-x-auto scroll-smooth pb-2"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {segments.map((segment) => (
            <SimilarSegmentCard
              key={segment.customerAudienceId}
              segment={segment}
              isSelected={selectedForCompare.has(segment.customerAudienceId)}
              onSelect={
                onCompare ? () => toggleCompareSelection(segment.customerAudienceId) : undefined
              }
              onClick={() => onSegmentClick?.(segment.customerAudienceId)}
              canSelect={
                selectedForCompare.size < maxCompareCount ||
                selectedForCompare.has(segment.customerAudienceId)
              }
            />
          ))}
        </div>

        {/* Selection hint */}
        {onCompare && (
          <p className="text-muted-foreground mt-3 text-center text-xs">
            Select up to {maxCompareCount} segments to compare overlap
          </p>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Individual segment card in the carousel
 */
function SimilarSegmentCard({
  segment,
  isSelected,
  onSelect,
  onClick,
  canSelect,
}: {
  segment: SimilarSegmentReference;
  isSelected: boolean;
  onSelect?: () => void;
  onClick?: () => void;
  canSelect: boolean;
}) {
  const similarityPercent = Math.round(segment.similarityScore * 100);
  const overlapPercent = segment.overlapPercentage ? Math.round(segment.overlapPercentage) : null;

  // Color based on similarity score
  const getSimilarityColor = () => {
    if (segment.similarityScore >= 0.8) return "text-success-dark bg-success/10";
    if (segment.similarityScore >= 0.6) return "text-primary bg-primary/10";
    if (segment.similarityScore >= 0.4) return "text-accent bg-accent/10";
    return "text-muted-foreground bg-muted";
  };

  return (
    <div className="relative w-[260px] shrink-0">
      {/* Selection checkbox — outside the card button to avoid nested interactive elements */}
      {onSelect && (
        <Checkbox
          checked={isSelected}
          disabled={!canSelect && !isSelected}
          aria-label={`Select ${segment.name} for comparison`}
          className="absolute top-2 right-2 z-10 h-5 w-5"
          onCheckedChange={() => {
            if (canSelect) onSelect();
          }}
        />
      )}

      <Button
        variant="ghost"
        className={cn(
          "group h-auto w-full cursor-pointer rounded-lg border p-4 text-left transition-all",
          isSelected
            ? "border-primary bg-primary/5 ring-primary ring-1"
            : "border-border hover:border-primary/40 hover:bg-primary/5"
        )}
        onClick={onClick}
      >
        {/* Segment info */}
        <div className="space-y-3">
          <div className="flex items-start gap-2">
            {/* Type icon */}
            <div className="bg-primary/10 rounded-lg p-1.5">
              {segment.engine === "THREADS" ? (
                <Sparkles className="text-primary h-4 w-4" />
              ) : (
                <Users className="text-primary h-4 w-4" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{segment.name}</p>
              <p className="text-muted-foreground truncate font-mono text-xs">{segment.code}</p>
            </div>
          </div>

          {/* Stats */}
          <div className="flex items-center justify-between gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge className={cn("cursor-help", getSimilarityColor())}>
                    {similarityPercent}% similar
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Behavioral similarity score based on customer patterns</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {overlapPercent !== null && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="text-muted-foreground flex items-center gap-1 text-xs">
                      <Users className="h-3 w-3" />
                      {overlapPercent}% overlap
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Percentage of customers shared between segments</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>

          {/* View link */}
          <div className="flex items-center justify-end opacity-0 transition-opacity group-hover:opacity-100">
            <span className="text-muted-foreground flex items-center gap-1 text-xs">
              View segment
              <ArrowRight className="h-3 w-3" />
            </span>
          </div>
        </div>
      </Button>
    </div>
  );
}

/**
 * Compact list variant for smaller spaces
 */
export function SimilarSegmentsList({
  segments,
  onSegmentClick,
  maxItems = 5,
  className,
}: {
  segments: SimilarSegmentReference[];
  onSegmentClick?: (segmentId: string) => void;
  maxItems?: number;
  className?: string;
}) {
  const displayedSegments = segments.slice(0, maxItems);
  const hasMore = segments.length > maxItems;

  return (
    <div className={cn("space-y-2", className)}>
      {displayedSegments.map((segment) => (
        <Button
          key={segment.customerAudienceId}
          variant="ghost"
          className="h-auto w-full justify-start gap-3 p-2"
          onClick={() => onSegmentClick?.(segment.customerAudienceId)}
        >
          <div className="bg-primary/10 rounded-lg p-1.5">
            {segment.engine === "THREADS" ? (
              <Sparkles className="text-primary h-4 w-4" />
            ) : (
              <Users className="text-primary h-4 w-4" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{segment.name}</p>
            <p className="text-muted-foreground text-xs">
              {Math.round(segment.similarityScore * 100)}% similar
              {segment.overlapPercentage !== undefined &&
                ` \u2022 ${Math.round(segment.overlapPercentage)}% overlap`}
            </p>
          </div>
          <ArrowRight className="text-muted-foreground h-4 w-4 shrink-0" />
        </Button>
      ))}
      {hasMore && (
        <p className="text-muted-foreground py-1 text-center text-xs">
          + {segments.length - maxItems} more segments
        </p>
      )}
    </div>
  );
}
