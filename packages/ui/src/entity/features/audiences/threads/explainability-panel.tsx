import { Brain, ChevronDown, Clock, FileText, Lightbulb, Sparkles } from "lucide-react";
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../../../../primitives/collapsible.js";
import type { ThreadsConfig } from "../types.js";
import { formatLastUpdate } from "../utils.js";
import { BehaviorRuleList, BehaviorTag } from "./behavior-rule-display.js";
import { ConfidenceScoreGauge } from "./confidence-score-gauge.js";

export interface ExplainabilityPanelProps {
  config: ThreadsConfig;
  maxBehaviors?: number;
  className?: string;
}

/**
 * Main explainability panel for THREADS segments.
 * Displays confidence score, contributing behaviors, and AI-generated rules.
 */
export function ExplainabilityPanel({
  config,
  maxBehaviors = 5,
  className,
}: ExplainabilityPanelProps) {
  const [showAllBehaviors, setShowAllBehaviors] = React.useState(false);
  const [rulesExpanded, setRulesExpanded] = React.useState(false);

  const displayedBehaviors = showAllBehaviors
    ? config.contributingBehaviors
    : config.contributingBehaviors.slice(0, maxBehaviors);

  const hasMoreBehaviors = config.contributingBehaviors.length > maxBehaviors;

  return (
    <Card className={cn("glass border-border", className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="text-primary h-5 w-5" />
          Why This Segment Exists
        </CardTitle>
        <CardDescription>
          AI-generated explanation of how this segment was discovered
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Confidence Score and Metadata */}
        <div className="flex flex-wrap items-start justify-between gap-6">
          <ConfidenceScoreGauge score={config.confidenceScore} size="md" />

          <div className="text-muted-foreground space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              <span>Last analyzed: {formatLastUpdate(config.lastClusterUpdate)}</span>
            </div>
            {config.clusterVersion && (
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                <span>Cluster version: {config.clusterVersion}</span>
              </div>
            )}
            {config.aiGeneratedName && (
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                <span>AI name: &quot;{config.aiGeneratedName}&quot;</span>
              </div>
            )}
          </div>
        </div>

        {/* Seed Behaviors */}
        {config.seedBehaviors && config.seedBehaviors.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-muted-foreground text-sm font-medium">Seed Behaviors</h4>
            <div className="flex flex-wrap gap-2">
              {config.seedBehaviors.map((behavior) => (
                <Badge key={behavior} variant="outline" className="border-primary/30">
                  {behavior}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Contributing Behaviors */}
        {config.contributingBehaviors && config.contributingBehaviors.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium">Contributing Behaviors</h4>
              <span className="text-muted-foreground text-xs">
                {config.contributingBehaviors.length} behaviors identified
              </span>
            </div>

            <BehaviorRuleList behaviors={displayedBehaviors} showDescription showExamples />

            {hasMoreBehaviors && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAllBehaviors(!showAllBehaviors)}
                className="w-full"
              >
                {showAllBehaviors
                  ? "Show less"
                  : `Show ${config.contributingBehaviors.length - maxBehaviors} more`}
              </Button>
            )}
          </div>
        )}

        {/* Explainability Rules */}
        {config.explainabilityRules && config.explainabilityRules.length > 0 && (
          <Collapsible open={rulesExpanded} onOpenChange={setRulesExpanded}>
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                className="hover:bg-primary/5 h-auto w-full justify-between p-3"
              >
                <div className="flex items-center gap-2">
                  <Lightbulb className="text-accent h-4 w-4" />
                  <span className="font-medium">Plain-English Rules</span>
                  <Badge variant="secondary" className="ml-2">
                    {config.explainabilityRules.length}
                  </Badge>
                </div>
                <ChevronDown
                  className={cn("h-4 w-4 transition-transform", rulesExpanded && "rotate-180")}
                />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="space-y-2 px-3 pt-2">
                {config.explainabilityRules.map((rule, index) => (
                  <div key={index} className="bg-muted/30 flex items-start gap-2 rounded-lg p-3">
                    <span className="text-muted-foreground shrink-0 font-medium">{index + 1}.</span>
                    <p className="text-sm leading-relaxed">{rule}</p>
                  </div>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Compact summary variant for dashboards
 */
export function ExplainabilitySummary({
  config,
  maxBehaviors = 3,
  className,
}: {
  config: ThreadsConfig;
  maxBehaviors?: number;
  className?: string;
}) {
  const topBehaviors = config.contributingBehaviors
    .slice(0, maxBehaviors)
    .sort((a, b) => b.contributionWeight - a.contributionWeight);

  return (
    <div className={cn("space-y-3", className)}>
      {/* Confidence and AI name */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="text-primary h-4 w-4" />
          <span className="text-sm font-medium">{config.aiGeneratedName}</span>
        </div>
        <Badge
          variant="outline"
          className={cn(
            config.confidenceScore >= 0.8
              ? "border-success/30 text-success-dark"
              : config.confidenceScore >= 0.6
                ? "border-primary/30 text-primary"
                : "border-accent/30 text-accent"
          )}
        >
          {Math.round(config.confidenceScore * 100)}% confidence
        </Badge>
      </div>

      {/* Top behaviors */}
      <div className="space-y-1.5">
        <p className="text-muted-foreground text-xs font-medium">Top Behaviors</p>
        <div className="flex flex-wrap gap-1.5">
          {topBehaviors.map((behavior) => (
            <BehaviorTag
              key={behavior.behaviorTag}
              tag={behavior.behaviorTag}
              category={behavior.behaviorCategory}
              weight={behavior.contributionWeight}
            />
          ))}
        </div>
      </div>

      {/* First rule */}
      {config.explainabilityRules && config.explainabilityRules.length > 0 && (
        <div className="bg-muted/30 rounded-lg p-2">
          <p className="text-muted-foreground text-xs italic">
            &quot;{config.explainabilityRules[0]}&quot;
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * Inline behavior list for quick reference
 */
export function TopBehaviorsBadges({
  behaviors,
  maxItems = 3,
  showWeights = false,
  className,
}: {
  behaviors: ThreadsConfig["contributingBehaviors"];
  maxItems?: number;
  showWeights?: boolean;
  className?: string;
}) {
  const sortedBehaviors = [...behaviors]
    .sort((a, b) => b.contributionWeight - a.contributionWeight)
    .slice(0, maxItems);

  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {sortedBehaviors.map((behavior) => (
        <BehaviorTag
          key={behavior.behaviorTag}
          tag={behavior.behaviorTag}
          category={behavior.behaviorCategory}
          weight={showWeights ? behavior.contributionWeight : undefined}
        />
      ))}
      {behaviors.length > maxItems && (
        <Badge variant="secondary" className="text-xs">
          +{behaviors.length - maxItems} more
        </Badge>
      )}
    </div>
  );
}
