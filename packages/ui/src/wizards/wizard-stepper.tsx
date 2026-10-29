"use client";

import { Check, SkipForward } from "lucide-react";

import { cn } from "../lib/utils";

import type { WizardStep } from "./types";

/**
 * Visual state for a wizard step
 */
type StepState = "completed" | "current" | "optional" | "future" | "skipped";

/**
 * Props for WizardStepper component
 */
export interface WizardStepperProps {
  /** Step configurations */
  steps: WizardStep[];
  /** Current step index (0-based) */
  currentStep: number;
  /** Set of completed step indices */
  completedSteps: Set<number>;
  /** Set of skipped step indices */
  skippedSteps: Set<number>;
  /** Callback when a step is clicked */
  onStepClick?: (index: number) => void;
  /** Whether steps are clickable */
  clickable?: boolean;
  /** Orientation - vertical for desktop sidebar, horizontal for mobile */
  orientation?: "vertical" | "horizontal";
  /** Show progress bar at top */
  showProgress?: boolean;
  /** Show step icons */
  showIcons?: boolean;
  /** Show step descriptions */
  showDescriptions?: boolean;
  /** Show optional badges */
  showOptionalBadges?: boolean;
  /** Size variant */
  size?: "sm" | "md" | "lg";
  /** Additional className */
  className?: string;
}

const sizeConfig = {
  sm: {
    circle: "h-6 w-6 text-xs",
    icon: "h-3 w-3",
    stepIcon: "h-3.5 w-3.5",
    title: "text-xs",
    description: "text-xs",
    badge: "text-xs px-1.5 py-0.5",
    connector: "min-h-4",
    connectorWidth: "w-px",
    gap: "gap-2",
    padding: "pb-4",
  },
  md: {
    circle: "h-8 w-8 text-sm",
    icon: "h-4 w-4",
    stepIcon: "h-4 w-4",
    title: "text-sm",
    description: "text-xs",
    badge: "text-xs px-1.5 py-0.5",
    connector: "min-h-6",
    connectorWidth: "w-0.5",
    gap: "gap-3",
    padding: "pb-6",
  },
  lg: {
    circle: "h-10 w-10 text-base",
    icon: "h-5 w-5",
    stepIcon: "h-5 w-5",
    title: "text-sm font-medium",
    description: "text-xs",
    badge: "text-xs px-2 py-0.5",
    connector: "min-h-8",
    connectorWidth: "w-0.5",
    gap: "gap-4",
    padding: "pb-8",
  },
};

/**
 * Get the visual state for a step
 */
function getStepState(
  index: number,
  currentStep: number,
  completedSteps: Set<number>,
  skippedSteps: Set<number>,
  isOptional: boolean
): StepState {
  if (completedSteps.has(index)) return "completed";
  if (skippedSteps.has(index)) return "skipped";
  if (index === currentStep) return "current";
  if (isOptional && index > currentStep) return "optional";
  return "future";
}

/**
 * Enhanced vertical stepper for wizard navigation.
 *
 * Features:
 * - Progress indicator at top
 * - Optional step badges
 * - Smooth completion animations
 * - Better visual hierarchy
 * - Both vertical and horizontal orientations
 *
 * @example
 * ```tsx
 * <WizardStepper
 *   steps={wizardSteps}
 *   currentStep={1}
 *   completedSteps={new Set([0])}
 *   skippedSteps={new Set()}
 *   onStepClick={(index) => goToStep(index)}
 * />
 * ```
 */
export function WizardStepper({
  steps,
  currentStep,
  completedSteps,
  skippedSteps,
  onStepClick,
  clickable = true,
  orientation = "vertical",
  showProgress = true,
  showIcons = true,
  showDescriptions = true,
  showOptionalBadges = true,
  size = "md",
  className,
}: WizardStepperProps) {
  const config = sizeConfig[size];

  // Calculate progress percentage
  const totalSteps = steps.length;
  const completedCount = completedSteps.size + skippedSteps.size;
  const progressPercent = Math.round((completedCount / totalSteps) * 100);

  const handleStepClick = (index: number) => {
    if (!clickable || !onStepClick) return;

    // Only allow clicking on completed, skipped, current, or previous steps
    const isCompleted = completedSteps.has(index);
    const isSkipped = skippedSteps.has(index);
    const isCurrent = index === currentStep;
    const isPrevious = index < currentStep;

    if (isCompleted || isSkipped || isCurrent || isPrevious) {
      onStepClick(index);
    }
  };

  if (orientation === "horizontal") {
    return (
      <div className={cn("w-full", className)}>
        {/* Progress bar for horizontal */}
        {showProgress && (
          <div className="bg-muted mb-2 h-1 w-full overflow-hidden rounded-full">
            <div
              className="bg-primary h-full transition-all duration-500 ease-out"
              style={{ width: `${progressPercent}%` }}
              role="progressbar"
              aria-valuenow={progressPercent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Wizard progress: ${progressPercent}% complete`}
            />
          </div>
        )}

        {/* Horizontal steps */}
        <ol role="list" aria-label="Wizard steps" className="flex items-center justify-between">
          {steps.map((step, index) => {
            const state = getStepState(
              index,
              currentStep,
              completedSteps,
              skippedSteps,
              step.optional ?? false
            );
            const isClickable =
              clickable &&
              (state === "completed" ||
                state === "skipped" ||
                state === "current" ||
                index < currentStep);
            const isLast = index === steps.length - 1;
            const StepIcon = step.icon;

            return (
              <li
                key={step.id}
                className={cn("flex items-center", !isLast && "flex-1")}
                aria-current={state === "current" ? "step" : undefined}
              >
                {/* Step circle */}
                <button
                  type="button"
                  disabled={!isClickable}
                  onClick={() => handleStepClick(index)}
                  className={cn(
                    "flex flex-shrink-0 items-center justify-center rounded-full border-2 font-medium transition-all duration-200",
                    config.circle,
                    // State-based styling
                    state === "completed" && "border-primary bg-primary text-primary-foreground",
                    state === "skipped" && "border-muted bg-muted text-muted-foreground",
                    state === "current" && "border-primary bg-primary/10 text-primary",
                    state === "optional" && "border-muted text-muted-foreground",
                    state === "future" && "border-muted text-muted-foreground",
                    // Interactive states
                    isClickable &&
                      "focus:ring-primary cursor-pointer hover:scale-105 hover:shadow-md focus:ring-2 focus:ring-offset-2 focus:outline-none",
                    !isClickable && "cursor-default"
                  )}
                  aria-label={`${state === "completed" ? "Completed: " : state === "skipped" ? "Skipped: " : state === "current" ? "Current: " : ""}${step.title}`}
                >
                  {state === "completed" ? (
                    <Check className={cn(config.icon, "animate-in zoom-in-50 duration-200")} />
                  ) : state === "skipped" ? (
                    <SkipForward className={config.icon} />
                  ) : showIcons && StepIcon ? (
                    <StepIcon className={config.stepIcon} />
                  ) : (
                    <span>{index + 1}</span>
                  )}
                </button>

                {/* Step title below circle on mobile */}
                <span className="sr-only">
                  {state === "completed" && "Completed: "}
                  {state === "skipped" && "Skipped: "}
                  {state === "current" && "Current step: "}
                  {step.title}
                </span>

                {/* Connector line */}
                {!isLast && (
                  <div
                    aria-hidden="true"
                    className={cn(
                      "mx-2 h-0.5 flex-1 transition-colors duration-300",
                      state === "completed" || state === "skipped" ? "bg-primary" : "bg-muted"
                    )}
                  />
                )}
              </li>
            );
          })}
        </ol>
      </div>
    );
  }

  // Vertical orientation (default)
  return (
    <div className={className}>
      {/* Progress indicator */}
      {showProgress && (
        <div className="mb-6">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-muted-foreground text-xs font-medium">Progress</span>
            <span className="text-foreground text-xs font-semibold">{progressPercent}%</span>
          </div>
          <div className="border-border bg-muted h-1.5 w-full overflow-hidden rounded-full border">
            <div
              className="bg-primary h-full transition-all duration-500 ease-out"
              style={{ width: `${progressPercent}%` }}
              role="progressbar"
              aria-valuenow={progressPercent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Wizard progress: ${progressPercent}% complete`}
            />
          </div>
        </div>
      )}

      {/* Steps list */}
      <ol role="list" aria-label="Wizard steps" className="flex flex-col">
        {steps.map((step, index) => {
          const state = getStepState(
            index,
            currentStep,
            completedSteps,
            skippedSteps,
            step.optional ?? false
          );
          const isClickable =
            clickable &&
            (state === "completed" ||
              state === "skipped" ||
              state === "current" ||
              index < currentStep);
          const isLast = index === steps.length - 1;
          const StepIcon = step.icon;

          return (
            <li
              key={step.id}
              className={cn("flex", config.gap)}
              aria-current={state === "current" ? "step" : undefined}
            >
              {/* Circle and connector column */}
              <div className="flex flex-col items-center" aria-hidden="true">
                {/* Step circle */}
                <button
                  type="button"
                  disabled={!isClickable}
                  onClick={() => handleStepClick(index)}
                  className={cn(
                    "flex flex-shrink-0 items-center justify-center rounded-full border-2 font-medium transition-all duration-200",
                    config.circle,
                    // State-based styling
                    state === "completed" && "border-primary bg-primary text-primary-foreground",
                    state === "skipped" && "border-muted bg-muted text-muted-foreground",
                    state === "current" &&
                      "border-primary bg-primary/10 text-primary ring-primary/20 ring-4",
                    state === "optional" && "border-muted/60 text-muted-foreground",
                    state === "future" && "border-muted text-muted-foreground",
                    // Interactive states
                    isClickable &&
                      "focus:ring-primary cursor-pointer hover:scale-105 hover:shadow-md focus:ring-2 focus:ring-offset-2 focus:outline-none",
                    !isClickable && "cursor-default"
                  )}
                  aria-label={`Go to ${step.title}`}
                >
                  {state === "completed" ? (
                    <Check className={cn(config.icon, "animate-in zoom-in-50 duration-200")} />
                  ) : state === "skipped" ? (
                    <SkipForward className={config.icon} />
                  ) : showIcons && StepIcon ? (
                    <StepIcon className={config.stepIcon} />
                  ) : (
                    <span>{index + 1}</span>
                  )}
                </button>

                {/* Connector line */}
                {!isLast && (
                  <div
                    className={cn(
                      "my-2 flex-1 transition-colors duration-300",
                      config.connector,
                      config.connectorWidth,
                      state === "completed" || state === "skipped" ? "bg-primary" : "bg-muted"
                    )}
                  />
                )}
              </div>

              {/* Content column */}
              <div className={cn("flex-1", config.padding)}>
                {/* Title row */}
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "font-medium transition-colors duration-200",
                      config.title,
                      state === "current" && "text-primary font-semibold",
                      state === "completed" && "text-foreground",
                      (state === "optional" || state === "future") && "text-muted-foreground",
                      state === "skipped" && "text-muted-foreground"
                    )}
                  >
                    {state === "completed" && <span className="sr-only">Completed: </span>}
                    {state === "skipped" && <span className="sr-only">Skipped: </span>}
                    {state === "current" && <span className="sr-only">Current step: </span>}
                    {step.title}
                  </span>

                  {/* Optional badge */}
                  {showOptionalBadges &&
                    step.optional &&
                    state !== "completed" &&
                    state !== "skipped" && (
                      <span
                        className={cn(
                          "bg-muted text-muted-foreground rounded-full font-medium",
                          config.badge
                        )}
                      >
                        Optional
                      </span>
                    )}

                  {/* Skipped indicator */}
                  {state === "skipped" && (
                    <span className={cn("text-muted-foreground", config.badge)}>(skipped)</span>
                  )}
                </div>

                {/* Description */}
                {showDescriptions && step.description && (
                  <p
                    className={cn(
                      "mt-0.5 transition-colors duration-200",
                      config.description,
                      state === "current" ? "text-muted-foreground" : "text-muted-foreground/70"
                    )}
                  >
                    {step.description}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/**
 * Wrapper component that integrates with WizardProvider context
 */
export { WizardStepperWithContext } from "./wizard-stepper-context";
