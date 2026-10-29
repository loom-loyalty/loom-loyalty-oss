"use client";

import { ArrowLeft, ArrowRight, Loader2, SkipForward } from "lucide-react";

import { cn } from "../lib/utils";
import { Button } from "../primitives/button";

import type { WizardNavigationProps } from "./types";
import { useWizard } from "./use-wizard";

/**
 * Navigation component for wizard footer.
 * Provides Back, Skip (for optional steps), and Continue/Complete buttons.
 *
 * @example
 * ```tsx
 * function MyWizard() {
 *   return (
 *     <WizardProvider {...}>
 *       <WizardSteps />
 *       <WizardNavigation
 *         labels={{ complete: "Finish Setup" }}
 *         showSkip
 *       />
 *     </WizardProvider>
 *   );
 * }
 * ```
 */
export function WizardNavigation({
  labels = {},
  showSkip = true,
  children,
  className,
}: WizardNavigationProps) {
  const {
    state,
    currentStepConfig,
    isFirstStep,
    isLastStep,
    currentStepIsValid,
    nextStep,
    prevStep,
    skipStep,
    complete,
  } = useWizard();

  const {
    back = "Back",
    next = "Continue",
    skip = "Skip this step",
    complete: completeLabel = "Complete Setup",
  } = labels;

  const canSkip = showSkip && currentStepConfig.optional && !isLastStep;

  const handleNext = async () => {
    if (isLastStep) {
      await complete();
    } else {
      await nextStep();
    }
  };

  return (
    <nav
      className={cn(
        "flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between",
        className
      )}
      aria-label="Wizard navigation"
    >
      {/* Back button - left side on desktop, bottom on mobile */}
      <div className="flex justify-center sm:justify-start">
        <Button
          type="button"
          variant="outline"
          onClick={prevStep}
          disabled={isFirstStep || state.isSubmitting}
          className="w-full sm:w-auto"
          aria-label={back}
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          <span>{back}</span>
        </Button>
      </div>

      {/* Center content - custom children or skip button */}
      <div className="flex items-center justify-center gap-3">
        {children}
        {canSkip && !children && (
          <Button
            type="button"
            variant="ghost"
            onClick={skipStep}
            disabled={state.isSubmitting}
            className="text-muted-foreground hover:text-foreground"
            aria-label={skip}
          >
            <SkipForward className="h-4 w-4" aria-hidden="true" />
            <span>{skip}</span>
          </Button>
        )}
      </div>

      {/* Next/Complete button - right side on desktop, top on mobile */}
      {!(isLastStep && currentStepConfig.hideCompleteButton) && (
        <div className="flex justify-center sm:justify-end">
          <Button
            type="button"
            variant="primary-gradient"
            onClick={handleNext}
            disabled={state.isSubmitting || !currentStepIsValid}
            className="w-full sm:w-auto"
            aria-label={isLastStep ? completeLabel : next}
          >
            {state.isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                <span>Processing...</span>
              </>
            ) : (
              <>
                <span>{isLastStep ? completeLabel : next}</span>
                {!isLastStep && <ArrowRight className="h-4 w-4" aria-hidden="true" />}
              </>
            )}
          </Button>
        </div>
      )}
    </nav>
  );
}
