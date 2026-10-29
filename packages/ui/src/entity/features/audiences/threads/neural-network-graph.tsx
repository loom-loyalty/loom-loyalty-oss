import * as d3 from "d3";
import { Maximize2, Minimize2, Network, RefreshCw, ZoomIn, ZoomOut } from "lucide-react";
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

type NodeType = "segment" | "behavior" | "customer_cluster";

interface GraphNode extends d3.SimulationNodeDatum {
  id: string;
  type: NodeType;
  label: string;
  value?: number;
  category?: string;
}

interface GraphLink extends d3.SimulationLinkDatum<GraphNode> {
  source: string | GraphNode;
  target: string | GraphNode;
  strength: number;
}

export interface NeuralNetworkGraphProps {
  segmentName: string;
  behaviors: ContributingBehavior[];
  clusterCount?: number;
  className?: string;
}

/**
 * Simple deterministic pseudo-random number generator (mulberry32).
 * Used instead of Math.random() to keep useMemo pure.
 */
function createSeededRandom(seed: number) {
  let state = seed;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Interactive force-directed graph showing segment, behaviors, and customer clusters.
 * Uses D3.js for physics simulation and rendering.
 */
export function NeuralNetworkGraph({
  segmentName,
  behaviors,
  clusterCount = 5,
  className,
}: NeuralNetworkGraphProps) {
  const svgRef = React.useRef<SVGSVGElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const zoomRef = React.useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const [dimensions, setDimensions] = React.useState({ width: 600, height: 400 });
  const [isFullscreen, setIsFullscreen] = React.useState(false);
  const [hoveredNode, setHoveredNode] = React.useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = React.useState(1);

  const graphData = React.useMemo(() => {
    const nodes: GraphNode[] = [];
    const links: GraphLink[] = [];
    const random = createSeededRandom(42);

    nodes.push({ id: "segment", type: "segment", label: segmentName, value: 1 });

    behaviors.forEach((behavior) => {
      nodes.push({
        id: `behavior-${behavior.behaviorTag}`,
        type: "behavior",
        label: behavior.behaviorTag,
        value: behavior.contributionWeight,
        category: behavior.behaviorCategory?.toLowerCase(),
      });
      links.push({
        source: "segment",
        target: `behavior-${behavior.behaviorTag}`,
        strength: behavior.contributionWeight,
      });
    });

    for (let i = 0; i < clusterCount; i++) {
      const clusterId = `cluster-${i}`;
      nodes.push({
        id: clusterId,
        type: "customer_cluster",
        label: `Cluster ${i + 1}`,
        value: random() * 0.5 + 0.3,
      });
      const linkedBehaviors = behaviors.filter(() => random() > 0.5).slice(0, 3);
      linkedBehaviors.forEach((behavior) => {
        links.push({
          source: clusterId,
          target: `behavior-${behavior.behaviorTag}`,
          strength: random() * 0.5 + 0.2,
        });
      });
    }

    return { nodes, links };
  }, [segmentName, behaviors, clusterCount]);

  React.useEffect(() => {
    if (!svgRef.current || graphData.nodes.length === 0) return;

    const { width, height } = dimensions;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 3])
      .on("zoom", (event) => {
        container.attr("transform", event.transform);
        setZoomLevel(event.transform.k);
      });

    svg.call(zoom);
    zoomRef.current = zoom;
    const container = svg.append("g").attr("class", "graph-container");

    const simulation = d3
      .forceSimulation<GraphNode>(graphData.nodes)
      .force(
        "link",
        d3
          .forceLink<GraphNode, GraphLink>(graphData.links)
          .id((d) => d.id)
          .distance((d) => 100 - (d.strength || 0.5) * 50)
          .strength((d) => d.strength || 0.5)
      )
      .force("charge", d3.forceManyBody().strength(-200))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide().radius(40));

    const drawnLinks = container
      .append("g")
      .selectAll("line")
      .data(graphData.links)
      .enter()
      .append("line")
      .attr("stroke", getVizColor("--viz-border", "#e7e5e0"))
      .attr("stroke-opacity", 0.6)
      .attr("stroke-width", (d) => Math.max(1, (d.strength || 0.5) * 3));

    const nodeGroups = container
      .append("g")
      .selectAll("g")
      .data(graphData.nodes)
      .enter()
      .append("g")
      .style("cursor", "pointer")
      .call(
        d3
          .drag<SVGGElement, GraphNode>()
          .on("start", (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on("drag", (event, d) => {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on("end", (event, d) => {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          })
      )
      .on("mouseenter", (_, d) => setHoveredNode(d.id))
      .on("mouseleave", () => setHoveredNode(null));

    nodeGroups
      .append("circle")
      .attr("r", (d) => {
        if (d.type === "segment") return 30;
        if (d.type === "behavior") return 15 + (d.value || 0.5) * 15;
        return 10;
      })
      .attr("fill", (d): string => {
        const colors = getCategoryColors();
        if (d.type === "segment") return colors.segment ?? "#0E7490";
        if (d.type === "customer_cluster") return getVizColor("--viz-neutral-light", "#a8a29e");
        return colors[d.category || "default"] ?? "#6b7280";
      })
      .attr("stroke", getVizColor("--viz-border", "#e7e5e0"))
      .attr("stroke-width", 2)
      .attr("opacity", 0.9);

    nodeGroups
      .append("text")
      .attr("text-anchor", "middle")
      .attr("dy", (d) => (d.type === "segment" ? 45 : 30))
      .attr("class", "fill-foreground text-xs font-medium")
      .text((d) => (d.label.length > 12 ? d.label.slice(0, 10) + "..." : d.label));

    simulation.on("tick", () => {
      drawnLinks
        .attr("x1", (d) => (d.source as GraphNode).x || 0)
        .attr("y1", (d) => (d.source as GraphNode).y || 0)
        .attr("x2", (d) => (d.target as GraphNode).x || 0)
        .attr("y2", (d) => (d.target as GraphNode).y || 0);
      nodeGroups.attr("transform", (d) => `translate(${d.x || 0},${d.y || 0})`);
    });

    // Respect prefers-reduced-motion: run simulation to steady state instantly
    if (prefersReducedMotion()) {
      simulation.alpha(1);
      simulation.tick(300);
      simulation.stop();
    } else {
      simulation.alpha(1).restart();
    }
    return () => {
      simulation.stop();
      svg.selectAll("*").interrupt();
      svg.selectAll("*").remove();
    };
  }, [graphData, dimensions]);

  React.useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setDimensions({
          width: Math.max(400, rect.width),
          height: isFullscreen ? window.innerHeight - 200 : Math.max(300, rect.height),
        });
      }
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [isFullscreen]);

  const handleZoom = (direction: "in" | "out" | "reset") => {
    if (!svgRef.current || !zoomRef.current) return;
    const svg = d3.select(svgRef.current);
    const zoomBehavior = zoomRef.current;
    if (direction === "reset") {
      svg.transition().duration(300).call(zoomBehavior.transform, d3.zoomIdentity);
    } else {
      svg
        .transition()
        .duration(300)
        .call(zoomBehavior.scaleBy, direction === "in" ? 1.3 : 0.7);
    }
  };

  if (behaviors.length === 0) {
    return (
      <Card className={cn("border-border", className)}>
        <CardContent className="flex flex-col items-center justify-center py-8 text-center">
          <div className="bg-primary/10 rounded-full p-3">
            <Network className="text-primary h-6 w-6" />
          </div>
          <p className="text-muted-foreground mt-3 text-sm">
            No behavior data available to visualize.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      className={cn(
        "border-border flex h-full flex-col transition-all",
        isFullscreen && "fixed inset-4 z-50",
        className
      )}
    >
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Network className="text-primary h-5 w-5" />
              Behavior Network
            </CardTitle>
            <CardDescription>
              Interactive visualization of segment behaviors and customer clusters
            </CardDescription>
          </div>
          <div className="flex items-center gap-1">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    aria-label="Zoom out"
                    onClick={() => handleZoom("out")}
                  >
                    <ZoomOut className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Zoom out</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <span className="text-muted-foreground min-w-[3ch] text-center text-xs">
              {Math.round(zoomLevel * 100)}%
            </span>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    aria-label="Zoom in"
                    onClick={() => handleZoom("in")}
                  >
                    <ZoomIn className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Zoom in</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    aria-label="Reset view"
                    onClick={() => handleZoom("reset")}
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Reset view</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
                    onClick={() => setIsFullscreen(!isFullscreen)}
                  >
                    {isFullscreen ? (
                      <Minimize2 className="h-4 w-4" />
                    ) : (
                      <Maximize2 className="h-4 w-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{isFullscreen ? "Exit fullscreen" : "Fullscreen"}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col">
        <div
          ref={containerRef}
          className={cn(
            "bg-muted relative flex-1 overflow-hidden rounded-lg border",
            isFullscreen ? "h-[calc(100vh-250px)]" : "min-h-[350px]"
          )}
        >
          <svg
            ref={svgRef}
            width={dimensions.width}
            height={dimensions.height}
            className="w-full"
            role="img"
            aria-label={`Behavior network visualization for ${segmentName} segment with ${behaviors.length} behaviors and ${clusterCount} customer clusters`}
          />
          {hoveredNode &&
            (() => {
              const node = graphData.nodes.find((n) => n.id === hoveredNode);
              return node ? (
                <div className="bg-background/95 absolute bottom-4 left-4 rounded-lg border p-3 shadow-lg backdrop-blur">
                  <p className="text-sm font-medium">{node.label}</p>
                  <p className="text-muted-foreground text-xs">
                    {node.type === "behavior"
                      ? `Weight: ${((node.value || 0) * 100).toFixed(0)}%`
                      : "Drag to reposition"}
                  </p>
                </div>
              ) : null;
            })()}
        </div>
        <div className="mt-4 flex flex-wrap justify-center gap-4">
          <div className="flex items-center gap-2">
            <div className="bg-primary h-4 w-4 rounded-full" />
            <span className="text-xs">Segment</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="bg-success h-3 w-3 rounded-full" />
            <span className="text-xs">Purchase</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="bg-accent h-3 w-3 rounded-full" />
            <span className="text-xs">Engagement</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="bg-primary/50 h-3 w-3 rounded-full" />
            <span className="text-xs">Loyalty</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="bg-muted-foreground h-2 w-2 rounded-full" />
            <span className="text-xs">Clusters</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
