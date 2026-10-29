/**
 * Wizard components for multi-step flows.
 *
 * Usage:
 * ```tsx
 * import {
 *   WizardProvider,
 *   WizardProgress,
 *   WizardNavigation,
 *   useWizard,
 * } from "@loom-loyalty/ui/wizards";
 *
 * function MyWizard() {
 *   return (
 *     <WizardProvider
 *       steps={steps}
 *       initialData={{}}
 *       storageKey="my-wizard"
 *       onComplete={handleComplete}
 *     >
 *       <WizardProgress />
 *       <WizardStepContent />
 *       <WizardNavigation />
 *     </WizardProvider>
 *   );
 * }
 * ```
 */

// Provider
export { WizardContext, WizardProvider } from "./wizard-provider";

// Hooks
export {
  useWizard,
  useWizardData,
  useWizardFieldError,
  useWizardNavigation,
  useWizardProgress,
  useWizardStep,
} from "./use-wizard";

// Components
export { WizardLayout, type WizardLayoutProps } from "./wizard-layout";
export { WizardNavigation } from "./wizard-navigation";
export { WizardProgress } from "./wizard-progress";
export { WizardStepper, type WizardStepperProps } from "./wizard-stepper";
export {
  WizardStepperWithContext,
  type WizardStepperWithContextProps,
} from "./wizard-stepper-context";

// Types
export type {
  ValidationResult,
  WizardContextValue,
  WizardNavigationProps,
  WizardProgressProps,
  WizardProviderProps,
  WizardState,
  WizardStep,
} from "./types";
