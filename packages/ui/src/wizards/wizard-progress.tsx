"use client";

import { Check, SkipForward } from "lucide-react";

import { cn } from "../lib/utils";

import type { WizardProgressProps } from "./types";
import { useWizard } from "./use-wizard";

const sizeClasses = {
  sm: {
    circle: "h-6 w-6 text-xs",
    icon: "h-3 w-3",
    title: "text-xs",
    description: "text-xs",
    connector: "h-px",
    connectorVertical: "w-px",
  },
  md: {
    circle: "h-8 w-8 text-sm",
    icon: "h-4 w-4",
    title: "text-sm",
    description: "text-xs",
    connector: "h-0.5",
    connectorVertical: "w-0.5",
  },
  lg: {
    circle: "h-10 w-10 text-base",
    icon: "h-5 w-5",
    title: "text-base",
    description: "text-sm",
    connector: "h-0.5",
    connectorVertical: "w-0.5",
  },
};

/**
 * Progress indicator for wizards that syncs with WizardProvider state.
 * Shows completed, skipped, and current steps with appropriate visual states.
 *
 * @example
 * ```tsx
 * function MyWizard() {
 *   return (
 *     <WizardProvider {...}>
 *       <WizardProgress orientation="horizontal" size="md" />
 *       <WizardSteps />
 *       <WizardNavigation />
 *     </WizardProvider>
 *   );
 * }
 * ```
 */
export function WizardProgress({
  orientation = "horizontal",
  size = "md",
  showDescriptions = true,
  clickable = true,
  className,
}: WizardProgressProps) {
  const { steps, state, goToStep } = useWizard();
  const sizes = sizeClasses[size];

  const handleStepClick = (index: number) => {
    if (!clickable) return;

    // Only allow clicking on completed steps or current step
    const isCompleted = state.completedSteps.has(index);
    const isSkipped = state.skippedSteps.has(index);
    const isCurrent = index === state.currentStep;
    const isPrevious = index < state.currentStep;

    if (isCompleted || isSkipped || isCurrent || isPrevious) {
      goToStep(index);
    }
  };

  if (orientation === "vertical") {
    return (
      <ol role="list" aria-label="Wizard progress" className={cn("flex flex-col", className)}>
        {steps.map((step, index) => {
          const isCompleted = state.completedSteps.has(index);
          const isSkipped = state.skippedSteps.has(index);
          const isCurrent = index === state.currentStep;
          const isLast = index === steps.length - 1;
          const isClickable =
            clickable && (isCompleted || isSkipped || isCurrent || index < state.currentStep);

          return (
            <li key={step.id} className="flex gap-3" aria-current={isCurrent ? "step" : undefined}>
              {/* Circle and connector */}
              <div className="flex flex-col items-center" aria-hidden="true">
                <button
                  type="button"
                  disabled={!isClickable}
                  onClick={() => handleStepClick(index)}
                  className={cn(
                    "flex items-center justify-center rounded-full border-2 font-medium transition-all",
                    sizes.circle,
                    isCompleted
                      ? "border-primary bg-primary text-primary-foreground"
                      : isSkipped
                        ? "border-muted bg-muted text-muted-foreground"
                        : isCurrent
                          ? "border-primary bg-background text-primary"
                          : "border-muted bg-background text-muted-foreground",
                    isClickable &&
                      "focus:ring-primary cursor-pointer hover:scale-105 hover:shadow-md focus:ring-2 focus:ring-offset-2 focus:outline-none",
                    !isClickable && "cursor-default"
                  )}
                  aria-label={`${isCompleted ? "Completed: " : isSkipped ? "Skipped: " : isCurrent ? "Current: " : ""}${step.title}`}
                >
                  {isCompleted ? (
                    <Check className={sizes.icon} />
                  ) : isSkipped ? (
                    <SkipForward className={sizes.icon} />
                  ) : (
                    <span>{index + 1}</span>
                  )}
                </button>
                {!isLast && (
                  <div
                    className={cn(
                      "my-2 min-h-8 flex-1",
                      sizes.connectorVertical,
                      isCompleted || isSkipped ? "bg-primary" : "bg-muted"
                    )}
                  />
                )}
              </div>

              {/* Content */}
              <div className="pb-8">
                <p
                  className={cn(
                    "font-medium",
                    sizes.title,
                    isCurrent || isCompleted ? "text-foreground" : "text-muted-foreground"
                  )}
                >
                  {isCompleted && <span className="sr-only">Completed: </span>}
                  {isSkipped && <span className="sr-only">Skipped: </span>}
                  {isCurrent && <span className="sr-only">Current step: </span>}
                  {step.title}
                  {isSkipped && (
                    <span className="text-muted-foreground ml-2 text-xs">(skipped)</span>
                  )}
                </p>
                {showDescriptions && step.description && (
                  <p className={cn("mt-0.5", sizes.description, "text-muted-foreground")}>
                    {step.description}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    );
  }

  // Horizontal orientation
  return (
    <ol role="list" aria-label="Wizard progress" className={cn("flex items-start", className)}>
      {steps.map((step, index) => {
        const isCompleted = state.completedSteps.has(index);
        const isSkipped = state.skippedSteps.has(index);
        const isCurrent = index === state.currentStep;
        const isLast = index === steps.length - 1;
        const isClickable =
          clickable && (isCompleted || isSkipped || isCurrent || index < state.currentStep);

        return (
          <li
            key={step.id}
            className={cn("flex items-center", !isLast && "flex-1")}
            aria-current={isCurrent ? "step" : undefined}
          >
            {/* Step */}
            <div className="flex flex-col items-center">
              <button
                type="button"
                disabled={!isClickable}
                onClick={() => handleStepClick(index)}
                aria-hidden="true"
                className={cn(
                  "flex items-center justify-center rounded-full border-2 font-medium transition-all",
                  sizes.circle,
                  isCompleted
                    ? "border-primary bg-primary text-primary-foreground"
                    : isSkipped
                      ? "border-muted bg-muted text-muted-foreground"
                      : isCurrent
                        ? "border-primary bg-background text-primary"
                        : "border-muted bg-background text-muted-foreground",
                  isClickable &&
                    "focus:ring-primary cursor-pointer hover:scale-105 hover:shadow-md focus:ring-2 focus:ring-offset-2 focus:outline-none",
                  !isClickable && "cursor-default"
                )}
                aria-label={`Go to ${step.title}`}
              >
                {isCompleted ? (
                  <Check className={sizes.icon} />
                ) : isSkipped ? (
                  <SkipForward className={sizes.icon} />
                ) : (
                  <span>{index + 1}</span>
                )}
              </button>
              <p
                className={cn(
                  "mt-2 text-center font-medium",
                  sizes.title,
                  isCurrent || isCompleted ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {isCompleted && <span className="sr-only">Completed: </span>}
                {isSkipped && <span className="sr-only">Skipped: </span>}
                {isCurrent && <span className="sr-only">Current step: </span>}
                {step.title}
              </p>
              {showDescriptions && step.description && (
                <p
                  className={cn(
                    "mt-0.5 max-w-[120px] text-center",
                    sizes.description,
                    "text-muted-foreground"
                  )}
                >
                  {step.description}
                  {isSkipped && " (skipped)"}
                </p>
              )}
            </div>

            {/* Connector */}
            {!isLast && (
              <div
                aria-hidden="true"
                className={cn(
                  "mx-2 mt-4 flex-1 self-start",
                  sizes.connector,
                  isCompleted || isSkipped ? "bg-primary" : "bg-muted"
                )}
                style={{
                  marginTop: size === "sm" ? "12px" : size === "lg" ? "20px" : "16px",
                }}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
