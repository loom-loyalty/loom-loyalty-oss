"use client";

import { useContext, useMemo } from "react";

import type { WizardContextValue, WizardStep } from "./types";
import { WizardContext } from "./wizard-provider";

/**
 * Hook to access the wizard context.
 * Must be used within a WizardProvider.
 *
 * @example
 * ```tsx
 * function MyWizardStep() {
 *   const { state, nextStep, updateData } = useWizard<MyWizardData>();
 *
 *   return (
 *     <form onSubmit={() => nextStep()}>
 *       <input
 *         value={state.data.name ?? ''}
 *         onChange={(e) => updateData('name', e.target.value)}
 *       />
 *     </form>
 *   );
 * }
 * ```
 */
export function useWizard<TData extends Record<string, unknown>>(): WizardContextValue<TData> {
  const context = useContext(WizardContext);

  if (!context) {
    throw new Error(
      "useWizard must be used within a WizardProvider. " +
        "Make sure your component is wrapped with <WizardProvider>."
    );
  }

  return context as WizardContextValue<TData>;
}

/**
 * Hook to access a specific field from wizard data.
 * Returns undefined if the field hasn't been set.
 *
 * @example
 * ```tsx
 * function NameDisplay() {
 *   const name = useWizardData<MyWizardData, 'name'>('name');
 *   return <span>{name ?? 'Not set'}</span>;
 * }
 * ```
 */
export function useWizardData<TData extends Record<string, unknown>, K extends keyof TData>(
  key: K
): TData[K] | undefined {
  const { state } = useWizard<TData>();
  return state.data[key];
}

/**
 * Hook to access the current step configuration.
 *
 * @example
 * ```tsx
 * function StepHeader() {
 *   const step = useWizardStep();
 *   return (
 *     <header>
 *       <h1>{step.title}</h1>
 *       {step.description && <p>{step.description}</p>}
 *     </header>
 *   );
 * }
 * ```
 */
export function useWizardStep(): WizardStep {
  const { currentStepConfig } = useWizard();
  return currentStepConfig;
}

/**
 * Hook to access wizard navigation functions only.
 * Useful when you only need navigation and want to minimize re-renders.
 *
 * @example
 * ```tsx
 * function WizardFooter() {
 *   const { nextStep, prevStep, skipStep } = useWizardNavigation();
 *   return (
 *     <footer>
 *       <Button onClick={prevStep}>Back</Button>
 *       <Button onClick={skipStep}>Skip</Button>
 *       <Button onClick={nextStep}>Continue</Button>
 *     </footer>
 *   );
 * }
 * ```
 */
export function useWizardNavigation(): Pick<
  WizardContextValue<Record<string, unknown>>,
  "nextStep" | "prevStep" | "skipStep" | "goToStep"
> {
  const { nextStep, prevStep, skipStep, goToStep } = useWizard();

  return useMemo(
    () => ({ nextStep, prevStep, skipStep, goToStep }),
    [nextStep, prevStep, skipStep, goToStep]
  );
}

/**
 * Hook to access wizard progress information.
 *
 * @example
 * ```tsx
 * function ProgressBar() {
 *   const { progress, currentStep, totalSteps } = useWizardProgress();
 *   return (
 *     <div>
 *       <progress value={progress} max={100} />
 *       <span>Step {currentStep + 1} of {totalSteps}</span>
 *     </div>
 *   );
 * }
 * ```
 */
export function useWizardProgress(): {
  progress: number;
  currentStep: number;
  totalSteps: number;
  isFirstStep: boolean;
  isLastStep: boolean;
} {
  const { progress, state, steps, isFirstStep, isLastStep } = useWizard();

  return useMemo(
    () => ({
      progress,
      currentStep: state.currentStep,
      totalSteps: steps.length,
      isFirstStep,
      isLastStep,
    }),
    [progress, state.currentStep, steps.length, isFirstStep, isLastStep]
  );
}

/**
 * Hook to access wizard errors for a specific field.
 *
 * @example
 * ```tsx
 * function EmailField() {
 *   const { error, setError, clearError } = useWizardFieldError('email');
 *   return (
 *     <div>
 *       <input onBlur={() => clearError()} />
 *       {error && <span className="text-destructive">{error}</span>}
 *     </div>
 *   );
 * }
 * ```
 */
export function useWizardFieldError(field: string): {
  error: string | undefined;
  setError: (message: string) => void;
  clearError: () => void;
} {
  const { state, setError, clearError } = useWizard();

  return useMemo(
    () => ({
      error: state.errors[field],
      setError: (message: string) => setError(field, message),
      clearError: () => clearError(field),
    }),
    [state.errors, field, setError, clearError]
  );
}
