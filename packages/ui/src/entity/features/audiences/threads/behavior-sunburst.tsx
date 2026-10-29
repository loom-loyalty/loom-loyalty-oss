import * as d3 from "d3";
import { ChevronLeft, Layers, RotateCcw } from "lucide-react";
import * as React from "react";
import { cn } from "../../../../lib/utils.js";
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
import type { ContributingBehavior } from "../types.js";
import { getCategoryColors, getVizColor, prefersReducedMotion } from "./viz-utils.js";

interface SunburstNode {
  name: string;
  value?: number;
  children?: SunburstNode[];
  behaviorTag?: string;
  category?: string;
  description?: string;
  sampleCount?: number;
}

export interface BehaviorSunburstProps {
  behaviors: ContributingBehavior[];
  className?: string;
}

function getNodeColor(d: d3.HierarchyRectangularNode<SunburstNode>): string {
  const categoryColors = getCategoryColors();
  const fallback = getVizColor("--viz-neutral", "#6b7280");
  if (d.depth === 0) return getVizColor("--viz-primary", "#0E7490");
  if (d.depth === 1) {
    const category = d.data.name.toLowerCase();
    return categoryColors[category] ?? fallback;
  }
  const parent = d.parent;
  if (parent) {
    const parentCategory = parent.data.name.toLowerCase();
    const baseColor = categoryColors[parentCategory] ?? fallback;
    return d3.color(baseColor)?.brighter(0.5)?.toString() ?? baseColor;
  }
  return fallback;
}

/**
 * Hierarchical sunburst visualization of behaviors grouped by category.
 * Click to drill down into categories, click center to zoom out.
 */
export function BehaviorSunburst({ behaviors, className }: BehaviorSunburstProps) {
  const svgRef = React.useRef<SVGSVGElement>(null);
  const resetZoomRef = React.useRef<(() => void) | null>(null);
  const [dimensions] = React.useState({ width: 400, height: 400 });
  const [currentRoot, setCurrentRoot] = React.useState<string | null>(null);
  const [hoveredNode, setHoveredNode] = React.useState<SunburstNode | null>(null);

  const hierarchyData = React.useMemo((): SunburstNode => {
    const categoryMap = new Map<string, ContributingBehavior[]>();
    behaviors.forEach((behavior) => {
      const category = behavior.behaviorCategory || "Other";
      if (!categoryMap.has(category)) categoryMap.set(category, []);
      categoryMap.get(category)!.push(behavior);
    });

    const children: SunburstNode[] = [];
    categoryMap.forEach((categoryBehaviors, categoryName) => {
      children.push({
        name: categoryName,
        children: categoryBehaviors.map((b) => ({
          name: b.behaviorTag,
          value: b.contributionWeight * 100,
          behaviorTag: b.behaviorTag,
          category: categoryName,
          description: b.description,
          sampleCount: b.sampleCount,
        })),
        category: categoryName,
      });
    });

    return { name: "Behaviors", children };
  }, [behaviors]);

  type PartitionedNode = d3.HierarchyRectangularNode<SunburstNode>;

  React.useEffect(() => {
    if (!svgRef.current || behaviors.length === 0) return;

    const { width, height } = dimensions;
    const radius = Math.min(width, height) / 2;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").interrupt();
    svg.selectAll("*").remove();

    const hierarchy = d3
      .hierarchy<SunburstNode>(hierarchyData)
      .sum((d) => d.value || 0)
      .sort((a, b) => (b.value || 0) - (a.value || 0));

    const partition = d3.partition<SunburstNode>().size([2 * Math.PI, radius]);
    const root = partition(hierarchy);

    const arc = d3
      .arc<PartitionedNode>()
      .startAngle((d) => d.x0)
      .endAngle((d) => d.x1)
      .padAngle((d) => Math.min((d.x1 - d.x0) / 2, 0.005))
      .padRadius(radius / 2)
      .innerRadius((d) => d.y0)
      .outerRadius((d) => d.y1 - 1);

    const container = svg.append("g").attr("transform", `translate(${width / 2},${height / 2})`);
    const nodes = root.descendants().filter((d) => d.depth > 0);

    const paths = container
      .selectAll("path")
      .data(nodes)
      .enter()
      .append("path")
      .attr("fill", (d) => getNodeColor(d))
      .attr("fill-opacity", 0.8)
      .attr("d", (d) => arc(d))
      .style("cursor", "pointer")
      .on("mouseenter", function (_, d) {
        d3.select(this).attr("fill-opacity", 1);
        setHoveredNode(d.data);
      })
      .on("mouseleave", function () {
        d3.select(this).attr("fill-opacity", 0.8);
        setHoveredNode(null);
      })
      .on("click", (_, d) => {
        if (d.depth === 1) {
          setCurrentRoot(d.data.name);
          zoomToNode(d);
        }
      });

    const reducedMotion = prefersReducedMotion();
    if (reducedMotion) {
      paths.attr("opacity", 1);
    } else {
      paths
        .attr("opacity", 0)
        .transition()
        .duration(500)
        .delay((_, i) => i * 30)
        .attr("opacity", 1);
    }

    const labelArc = d3
      .arc<PartitionedNode>()
      .startAngle((d) => d.x0)
      .endAngle((d) => d.x1)
      .innerRadius((d) => (d.y0 + d.y1) / 2)
      .outerRadius((d) => (d.y0 + d.y1) / 2);

    const categoryNodes = nodes.filter((d) => d.depth === 1 && d.x1 - d.x0 > 0.3);

    container
      .selectAll("text")
      .data(categoryNodes)
      .enter()
      .append("text")
      .attr("transform", (d) => {
        const pos = labelArc.centroid(d);
        const angle = ((d.x0 + d.x1) / 2) * (180 / Math.PI) - 90;
        return `translate(${pos}) rotate(${angle > 90 ? angle - 180 : angle})`;
      })
      .attr("text-anchor", "middle")
      .attr("dy", "0.35em")
      .attr("class", "fill-background text-xs font-medium pointer-events-none")
      .text((d) => (d.data.name.length > 10 ? d.data.name.slice(0, 8) + "..." : d.data.name));

    container
      .append("circle")
      .attr("r", radius * 0.2)
      .attr("fill", getVizColor("--viz-primary", "#0E7490"))
      .attr("fill-opacity", 0.9)
      .style("cursor", "pointer")
      .on("mouseenter", function () {
        d3.select(this).attr("fill-opacity", 1);
      })
      .on("mouseleave", function () {
        d3.select(this).attr("fill-opacity", 0.9);
      })
      .on("click", () => {
        setCurrentRoot(null);
        resetZoom();
      });

    container
      .append("text")
      .attr("text-anchor", "middle")
      .attr("dy", "0.35em")
      .attr("class", "fill-background text-sm font-semibold pointer-events-none")
      .text("All");

    function zoomToNode(clickedNode: PartitionedNode) {
      paths
        .transition()
        .duration(500)
        .attrTween("d", function (node) {
          const current = { x0: node.x0, x1: node.x1, y0: node.y0, y1: node.y1 };
          const xScale = d3
            .scaleLinear()
            .domain([clickedNode.x0, clickedNode.x1])
            .range([0, 2 * Math.PI]);
          const yScale = d3.scaleLinear().domain([clickedNode.y0, radius]).range([0, radius]);
          const target = {
            x0: node.depth > clickedNode.depth ? xScale(node.x0) : 0,
            x1: node.depth > clickedNode.depth ? xScale(node.x1) : 2 * Math.PI,
            y0: node.depth > clickedNode.depth ? yScale(node.y0) : 0,
            y1: node.depth > clickedNode.depth ? yScale(node.y1) : radius * 0.2,
          };
          const interpolate = d3.interpolate(current, target);
          return function (t: number) {
            const i = interpolate(t);
            return (
              arc({ ...node, x0: i.x0, x1: i.x1, y0: i.y0, y1: i.y1 } as PartitionedNode) || ""
            );
          };
        })
        .attr("fill-opacity", function (node) {
          return node.depth > clickedNode.depth ? 0.8 : 0;
        });
    }

    function resetZoom() {
      paths
        .transition()
        .duration(500)
        .attr("d", (d) => arc(d))
        .attr("fill-opacity", 0.8);
    }

    resetZoomRef.current = resetZoom;

    return () => {
      svg.selectAll("*").interrupt();
      svg.selectAll("*").remove();
    };
  }, [hierarchyData, behaviors, dimensions]);

  if (behaviors.length === 0) {
    return (
      <Card className={cn("border-border", className)}>
        <CardContent className="flex flex-col items-center justify-center py-8 text-center">
          <div className="bg-primary/10 rounded-full p-3">
            <Layers className="text-primary h-6 w-6" />
          </div>
          <p className="text-muted-foreground mt-3 text-sm">
            No behavior data available to visualize.
          </p>
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
              <Layers className="text-primary h-5 w-5" />
              Behavior Categories
            </CardTitle>
            <CardDescription>Hierarchical view of behaviors grouped by category</CardDescription>
          </div>
          <div className="flex items-center gap-1">
            {currentRoot && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      aria-label="Back to all categories"
                      onClick={() => {
                        setCurrentRoot(null);
                        resetZoomRef.current?.();
                      }}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Back to all</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    aria-label="Reset view"
                    onClick={() => {
                      setCurrentRoot(null);
                      resetZoomRef.current?.();
                    }}
                  >
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Reset view</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
        {currentRoot && (
          <div className="mt-2 flex items-center gap-2">
            <span className="text-muted-foreground text-sm">Viewing:</span>
            <span className="bg-primary/10 text-primary rounded-full px-2 py-0.5 text-xs font-medium">
              {currentRoot}
            </span>
          </div>
        )}
      </CardHeader>
      <CardContent className="flex flex-1 flex-col">
        <div className="bg-muted relative flex min-h-[350px] flex-1 items-center justify-center rounded-lg border">
          <svg
            ref={svgRef}
            width={dimensions.width}
            height={dimensions.height}
            className="overflow-visible"
            role="img"
            aria-label={`Behavior sunburst visualization showing ${behaviors.length} behaviors grouped by category`}
          />
          {hoveredNode && (
            <div className="bg-background/95 absolute bottom-4 left-4 max-w-[200px] rounded-lg border p-3 shadow-lg backdrop-blur">
              <p className="text-sm font-medium">{hoveredNode.name}</p>
              {hoveredNode.value !== undefined && (
                <p className="text-muted-foreground text-xs">
                  Weight: {hoveredNode.value.toFixed(0)}%
                </p>
              )}
              {hoveredNode.sampleCount !== undefined && (
                <p className="text-muted-foreground text-xs">
                  Samples: {hoveredNode.sampleCount.toLocaleString()}
                </p>
              )}
              {hoveredNode.description && (
                <p className="text-muted-foreground mt-1 line-clamp-2 text-xs">
                  {hoveredNode.description}
                </p>
              )}
            </div>
          )}
        </div>
        <div className="mt-4 flex flex-wrap justify-center gap-4">
          {Object.entries(getCategoryColors()).map(([category, color]) => (
            <div key={category} className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full" style={{ backgroundColor: color }} />
              <span className="text-xs capitalize">{category}</span>
            </div>
          ))}
        </div>
        {/* Keyboard-accessible category list for drill-down */}
        <nav aria-label="Drill down by category" className="mt-3">
          <ul className="flex flex-wrap justify-center gap-2">
            {Object.entries(getCategoryColors())
              .filter(([cat]) => hierarchyData.children?.some((c) => c.name.toLowerCase() === cat))
              .map(([category, color]) => (
                <li key={category}>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1.5 px-2 text-xs capitalize"
                    aria-pressed={currentRoot?.toLowerCase() === category}
                    onClick={() => {
                      if (currentRoot?.toLowerCase() === category) {
                        setCurrentRoot(null);
                        resetZoomRef.current?.();
                      } else {
                        setCurrentRoot(
                          hierarchyData.children?.find((c) => c.name.toLowerCase() === category)
                            ?.name ?? category
                        );
                      }
                    }}
                  >
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: color }}
                    />
                    {category}
                  </Button>
                </li>
              ))}
          </ul>
        </nav>
        <p className="text-muted-foreground mt-2 text-center text-xs">
          Click a category to zoom in &bull; Click center to reset
        </p>
      </CardContent>
    </Card>
  );
}
