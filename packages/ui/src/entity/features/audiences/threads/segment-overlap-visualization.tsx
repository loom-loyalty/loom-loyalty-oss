import * as d3 from "d3";
import { BarChart3, Circle, PieChart, Users } from "lucide-react";
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
import type { SegmentOverlapData, SegmentOverlapEntry } from "../types.js";
import { formatMemberCount } from "../utils.js";
import { getVizColor, prefersReducedMotion } from "./viz-utils.js";

export interface SegmentOverlapVisualizationProps {
  data: SegmentOverlapData;
  currentSegmentName?: string;
  onSegmentClick?: (segmentId: string) => void;
  className?: string;
}

type ChartType = "venn" | "bar";

/**
 * Visualizes overlap between segments using D3-powered Venn diagram or bar chart.
 */
export function SegmentOverlapVisualization({
  data,
  currentSegmentName = "This Segment",
  onSegmentClick,
  className,
}: SegmentOverlapVisualizationProps) {
  const [chartType, setChartType] = React.useState<ChartType>("venn");
  const [hoveredSegment, setHoveredSegment] = React.useState<string | null>(null);

  const sortedSegments = React.useMemo(
    () => [...data.segments].sort((a, b) => b.overlapPercentage - a.overlapPercentage),
    [data.segments]
  );

  if (data.segments.length === 0) {
    return (
      <Card className={cn("border-border", className)}>
        <CardContent className="flex flex-col items-center justify-center py-8 text-center">
          <div className="bg-primary/10 rounded-full p-3">
            <PieChart className="text-primary h-6 w-6" />
          </div>
          <p className="text-muted-foreground mt-3 text-sm">No overlap data available yet.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("border-border flex h-full flex-col", className)}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="text-primary h-5 w-5" />
              Segment Overlap
            </CardTitle>
            <CardDescription>
              Customer overlap with {data.segments.length} related segments
            </CardDescription>
          </div>
          <div className="flex rounded-lg border p-1">
            <Button
              variant={chartType === "venn" ? "secondary" : "ghost"}
              size="sm"
              className="h-7 px-2"
              onClick={() => setChartType("venn")}
            >
              <Circle className="h-4 w-4" />
            </Button>
            <Button
              variant={chartType === "bar" ? "secondary" : "ghost"}
              size="sm"
              className="h-7 px-2"
              onClick={() => setChartType("bar")}
            >
              <BarChart3 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col">
        {chartType === "venn" ? (
          <D3VennDiagram
            segments={sortedSegments.slice(0, 3)}
            currentSegmentName={currentSegmentName}
            onHover={setHoveredSegment}
            onSegmentClick={onSegmentClick}
          />
        ) : (
          <BarChartView
            segments={sortedSegments}
            hoveredSegment={hoveredSegment}
            onHover={setHoveredSegment}
            onSegmentClick={onSegmentClick}
          />
        )}
        <div className="mt-4 flex items-center justify-center gap-2 text-sm">
          <Users className="text-muted-foreground h-4 w-4" />
          <span className="text-muted-foreground">Total unique customers:</span>
          <span className="font-medium">{formatMemberCount(data.totalCustomers)}</span>
        </div>
      </CardContent>
    </Card>
  );
}

function D3VennDiagram({
  segments,
  currentSegmentName,
  onHover,
  onSegmentClick,
}: {
  segments: SegmentOverlapEntry[];
  currentSegmentName: string;
  onHover: (id: string | null) => void;
  onSegmentClick?: (id: string) => void;
}) {
  const svgRef = React.useRef<SVGSVGElement>(null);
  const [dimensions, setDimensions] = React.useState({ width: 400, height: 280 });

  const colors = React.useMemo(
    () => [
      {
        fill: `color-mix(in srgb, ${getVizColor("--viz-primary", "#0E7490")} 30%, transparent)`,
        stroke: getVizColor("--viz-primary", "#0E7490"),
      },
      {
        fill: `color-mix(in srgb, ${getVizColor("--viz-info", "#3B82F6")} 30%, transparent)`,
        stroke: getVizColor("--viz-info", "#3B82F6"),
      },
      {
        fill: `color-mix(in srgb, ${getVizColor("--viz-secondary", "#059669")} 30%, transparent)`,
        stroke: getVizColor("--viz-secondary", "#059669"),
      },
    ],
    []
  );

  React.useEffect(() => {
    if (!svgRef.current || segments.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").interrupt();
    svg.selectAll("*").remove();

    const { width, height } = dimensions;
    const centerX = width / 2;
    const centerY = height / 2;
    const baseRadius = Math.min(width, height) * 0.28;

    const defs = svg.append("defs");
    colors.forEach((color, i) => {
      const gradient = defs
        .append("radialGradient")
        .attr("id", `venn-gradient-${i}`)
        .attr("cx", "30%")
        .attr("cy", "30%");
      gradient
        .append("stop")
        .attr("offset", "0%")
        .attr("stop-color", color.stroke)
        .attr("stop-opacity", 0.4);
      gradient
        .append("stop")
        .attr("offset", "100%")
        .attr("stop-color", color.stroke)
        .attr("stop-opacity", 0.15);
    });

    interface VennCircle {
      x: number;
      y: number;
      r: number;
      id: string;
      name: string;
      color: { fill: string; stroke: string };
    }
    const circles: VennCircle[] = [];
    circles.push({
      x: centerX - baseRadius * 0.4,
      y: centerY,
      r: baseRadius,
      id: "current",
      name: currentSegmentName,
      color: colors[0]!,
    });

    segments.forEach((segment, i) => {
      const overlapFactor = segment.overlapPercentage / 100;
      const distance = baseRadius * (2 - overlapFactor * 1.2);
      const angle = (i * 2 * Math.PI) / Math.max(segments.length, 1) - Math.PI / 4;
      circles.push({
        x: centerX - baseRadius * 0.4 + Math.cos(angle) * distance * 0.5,
        y: centerY + Math.sin(angle) * distance * 0.5,
        r: baseRadius * (0.7 + overlapFactor * 0.3),
        id: segment.customerAudienceId,
        name: segment.name,
        color: colors[(i + 1) % colors.length]!,
      });
    });

    const circleGroups = svg
      .selectAll("g.venn-circle")
      .data(circles)
      .enter()
      .append("g")
      .attr("class", "venn-circle")
      .style("cursor", (d) => (d.id !== "current" ? "pointer" : "default"));

    const circleEls = circleGroups
      .append("circle")
      .attr("cx", (d) => d.x)
      .attr("cy", (d) => d.y)
      .attr("r", 0)
      .attr("fill", (_, i) => `url(#venn-gradient-${i % colors.length})`)
      .attr("stroke", (d) => d.color.stroke)
      .attr("stroke-width", 2)
      .on("mouseenter", function (_, d) {
        d3.select(this).attr("stroke-width", 3);
        onHover(d.id);
      })
      .on("mouseleave", function () {
        d3.select(this).attr("stroke-width", 2);
        onHover(null);
      })
      .on("click", (_, d) => {
        if (d.id !== "current" && onSegmentClick) onSegmentClick(d.id);
      });

    const reducedMotion = prefersReducedMotion();

    if (reducedMotion) {
      circleEls.attr("r", (d) => d.r);
    } else {
      circleEls
        .transition()
        .duration(600)
        .ease(d3.easeElasticOut.amplitude(1).period(0.5))
        .attr("r", (d) => d.r);
    }

    const labels = circleGroups
      .append("text")
      .attr("x", (d, i) => (i === 0 ? d.x - d.r * 0.5 : d.x + d.r * 0.3))
      .attr("y", (d, i) => (i === 0 ? d.y - d.r * 0.3 : d.y - d.r * 0.5))
      .attr("text-anchor", "middle")
      .attr("class", "fill-foreground text-xs font-medium")
      .text((d) => (d.name.length > 15 ? d.name.slice(0, 12) + "..." : d.name));

    if (reducedMotion) {
      labels.attr("opacity", 1);
    } else {
      labels.attr("opacity", 0).transition().delay(400).duration(300).attr("opacity", 1);
    }

    if (segments.length > 0) {
      const countText = svg
        .append("text")
        .attr("x", centerX)
        .attr("y", centerY + 5)
        .attr("text-anchor", "middle")
        .attr("class", "fill-foreground text-sm font-bold")
        .text(formatMemberCount(segments[0]!.overlapCount));

      const sharedText = svg
        .append("text")
        .attr("x", centerX)
        .attr("y", centerY + 20)
        .attr("text-anchor", "middle")
        .attr("class", "fill-muted-foreground text-xs")
        .text("shared");

      if (reducedMotion) {
        countText.attr("opacity", 1);
        sharedText.attr("opacity", 1);
      } else {
        countText.attr("opacity", 0).transition().delay(600).duration(300).attr("opacity", 1);
        sharedText.attr("opacity", 0).transition().delay(700).duration(300).attr("opacity", 1);
      }
    }
    return () => {
      svg.selectAll("*").interrupt();
      svg.selectAll("*").remove();
    };
  }, [segments, dimensions, currentSegmentName, onHover, onSegmentClick, colors]);

  React.useEffect(() => {
    const handleResize = () => {
      if (svgRef.current?.parentElement) {
        const { width } = svgRef.current.parentElement.getBoundingClientRect();
        setDimensions({ width: Math.max(300, width), height: 280 });
      }
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  if (segments.length === 0) {
    return (
      <div className="text-muted-foreground py-8 text-center text-sm">
        Select segments to visualize overlap
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center py-4">
      <svg
        ref={svgRef}
        width={dimensions.width}
        height={dimensions.height}
        className="overflow-visible"
        role="img"
        aria-label={`Venn diagram showing segment overlap between ${currentSegmentName} and ${segments.length} other segment${segments.length !== 1 ? "s" : ""}`}
      />
      <div className="mt-4 flex flex-wrap justify-center gap-4">
        <div className="flex items-center gap-2">
          <div
            className="h-3 w-3 rounded-full"
            style={{ backgroundColor: colors[0]!.stroke, opacity: 0.5 }}
          />
          <span className="text-sm">{currentSegmentName}</span>
        </div>
        {segments.map((segment, i) => (
          <div key={segment.customerAudienceId} className="flex items-center gap-2">
            <div
              className="h-3 w-3 rounded-full"
              style={{ backgroundColor: colors[(i + 1) % colors.length]!.stroke, opacity: 0.5 }}
            />
            <span className="text-sm">
              {segment.name} ({segment.overlapPercentage.toFixed(0)}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function BarChartView({
  segments,
  hoveredSegment,
  onHover,
  onSegmentClick,
}: {
  segments: SegmentOverlapEntry[];
  hoveredSegment: string | null;
  onHover: (id: string | null) => void;
  onSegmentClick?: (id: string) => void;
}) {
  const barsRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!barsRef.current) return;
    const reducedMotion = prefersReducedMotion();
    const timers: ReturnType<typeof setTimeout>[] = [];
    const bars = barsRef.current.querySelectorAll(".overlap-bar-fill");
    bars.forEach((bar, i) => {
      const el = bar as HTMLElement;
      const targetWidth = el.dataset.width || "0";
      if (reducedMotion) {
        el.style.width = targetWidth;
      } else {
        el.style.width = "0%";
        timers.push(
          setTimeout(() => {
            el.style.width = targetWidth;
          }, i * 100)
        );
      }
    });
    return () => {
      timers.forEach(clearTimeout);
    };
  }, [segments]);

  return (
    <div ref={barsRef} className="space-y-3 py-2">
      {segments.map((segment) => (
        <Button
          key={segment.customerAudienceId}
          variant="ghost"
          className={cn(
            "group h-auto w-full flex-col items-stretch rounded-lg p-2",
            hoveredSegment === segment.customerAudienceId && "bg-primary/5"
          )}
          onMouseEnter={() => onHover(segment.customerAudienceId)}
          onMouseLeave={() => onHover(null)}
          onClick={() => onSegmentClick?.(segment.customerAudienceId)}
        >
          <div className="mb-1 flex items-center justify-between">
            <span className="text-sm font-medium">{segment.name}</span>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                {formatMemberCount(segment.overlapCount)} shared
              </Badge>
              <span className="text-primary font-mono text-sm font-bold">
                {segment.overlapPercentage.toFixed(1)}%
              </span>
            </div>
          </div>
          <div className="bg-muted h-3 overflow-hidden rounded-full">
            <div
              className={cn(
                "overlap-bar-fill bg-primary h-full rounded-full transition-all duration-500 ease-out",
                segment.overlapPercentage >= 50
                  ? "opacity-100"
                  : segment.overlapPercentage >= 25
                    ? "opacity-80"
                    : "opacity-60"
              )}
              data-width={`${segment.overlapPercentage}%`}
              style={{ width: `${segment.overlapPercentage}%` }}
            />
          </div>
        </Button>
      ))}
    </div>
  );
}

/**
 * Compact overlap badge for inline display
 */
export function OverlapBadge({
  overlapCount,
  overlapPercentage,
  className,
}: {
  overlapCount: number;
  overlapPercentage: number;
  className?: string;
}) {
  return (
    <Badge variant="outline" className={cn("border-primary/30 text-primary", className)}>
      <Users className="mr-1 h-3 w-3" />
      {overlapPercentage.toFixed(0)}% overlap ({formatMemberCount(overlapCount)})
    </Badge>
  );
}

/**
 * Mini overlap indicator for tables/lists
 */
export function OverlapIndicator({
  percentage,
  className,
}: {
  percentage: number;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="bg-muted h-1.5 w-12 overflow-hidden rounded-full">
        <div
          className="bg-primary h-full rounded-full transition-all duration-300"
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className="text-muted-foreground text-xs">{percentage.toFixed(0)}%</span>
    </div>
  );
}
