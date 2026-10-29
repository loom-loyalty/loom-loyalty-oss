"use client";

import { Check } from "lucide-react";

import { cn } from "../lib/utils";

export interface Step {
  /** Step identifier */
  id: string;
  /** Step title */
  title: string;
  /** Optional description */
  description?: string;
}

export interface StepsProps {
  /** List of steps */
  steps: Step[];
  /** Current step (0-indexed) */
  currentStep: number;
  /** Orientation */
  orientation?: "horizontal" | "vertical";
  /** Size variant */
  size?: "sm" | "md" | "lg";
  /** Accessible label for the step list */
  ariaLabel?: string;
  /** Additional className */
  className?: string;
}

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
 * Steps component for multi-step wizards and progress indicators.
 * Used for onboarding flows and multi-step forms.
 * Includes ARIA attributes for accessibility (WCAG 2.1 AA).
 */
export function Steps({
  steps,
  currentStep,
  orientation = "horizontal",
  size = "md",
  ariaLabel = "Progress steps",
  className,
}: StepsProps) {
  const sizes = sizeClasses[size];

  if (orientation === "vertical") {
    return (
      <ol role="list" aria-label={ariaLabel} className={cn("flex flex-col", className)}>
        {steps.map((step, index) => {
          const isCompleted = index < currentStep;
          const isCurrent = index === currentStep;
          const isLast = index === steps.length - 1;

          return (
            <li key={step.id} className="flex gap-3" aria-current={isCurrent ? "step" : undefined}>
              {/* Circle and connector */}
              <div className="flex flex-col items-center" aria-hidden="true">
                <div
                  className={cn(
                    "flex items-center justify-center rounded-full border-2 font-medium transition-colors",
                    sizes.circle,
                    isCompleted
                      ? "border-primary bg-primary text-primary-foreground"
                      : isCurrent
                        ? "border-primary bg-background text-primary"
                        : "border-muted bg-background text-muted-foreground"
                  )}
                >
                  {isCompleted ? <Check className={sizes.icon} /> : <span>{index + 1}</span>}
                </div>
                {!isLast && (
                  <div
                    className={cn(
                      "my-2 min-h-8 flex-1",
                      sizes.connectorVertical,
                      isCompleted ? "bg-primary" : "bg-muted"
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
                  {isCurrent && <span className="sr-only">Current step: </span>}
                  {step.title}
                </p>
                {step.description && (
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
    <ol role="list" aria-label={ariaLabel} className={cn("flex items-start", className)}>
      {steps.map((step, index) => {
        const isCompleted = index < currentStep;
        const isCurrent = index === currentStep;
        const isLast = index === steps.length - 1;

        return (
          <li
            key={step.id}
            className={cn("flex items-center", !isLast && "flex-1")}
            aria-current={isCurrent ? "step" : undefined}
          >
            {/* Step */}
            <div className="flex flex-col items-center">
              <div
                aria-hidden="true"
                className={cn(
                  "flex items-center justify-center rounded-full border-2 font-medium transition-colors",
                  sizes.circle,
                  isCompleted
                    ? "border-primary bg-primary text-primary-foreground"
                    : isCurrent
                      ? "border-primary bg-background text-primary"
                      : "border-muted bg-background text-muted-foreground"
                )}
              >
                {isCompleted ? <Check className={sizes.icon} /> : <span>{index + 1}</span>}
              </div>
              <p
                className={cn(
                  "mt-2 text-center font-medium",
                  sizes.title,
                  isCurrent || isCompleted ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {isCompleted && <span className="sr-only">Completed: </span>}
                {isCurrent && <span className="sr-only">Current step: </span>}
                {step.title}
              </p>
              {step.description && (
                <p
                  className={cn(
                    "mt-0.5 max-w-[120px] text-center",
                    sizes.description,
                    "text-muted-foreground"
                  )}
                >
                  {step.description}
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
                  isCompleted ? "bg-primary" : "bg-muted"
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
