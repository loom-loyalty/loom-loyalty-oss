"use client";

import { useWizard } from "./use-wizard";
import { WizardStepper, type WizardStepperProps } from "./wizard-stepper";

/**
 * Props for WizardStepperWithContext
 * Omits props that are provided by the wizard context
 */
export type WizardStepperWithContextProps = Omit<
  WizardStepperProps,
  "steps" | "currentStep" | "completedSteps" | "skippedSteps" | "onStepClick"
>;

/**
 * WizardStepper that automatically syncs with WizardProvider context.
 *
 * Use this when the stepper is inside a WizardProvider and should
 * automatically reflect the wizard's current state.
 *
 * @example
 * ```tsx
 * <WizardProvider steps={steps} {...}>
 *   <WizardStepperWithContext orientation="vertical" size="md" />
 *   <WizardStepContent />
 *   <WizardNavigation />
 * </WizardProvider>
 * ```
 */
export function WizardStepperWithContext(props: WizardStepperWithContextProps) {
  const { steps, state, goToStep } = useWizard();

  return (
    <WizardStepper
      steps={steps}
      currentStep={state.currentStep}
      completedSteps={state.completedSteps}
      skippedSteps={state.skippedSteps}
      onStepClick={goToStep}
      {...props}
    />
  );
}
