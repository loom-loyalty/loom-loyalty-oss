import type { ComponentType, ReactNode } from "react";

/**
 * Result of step validation
 */
export interface ValidationResult {
  /** Whether the step data is valid */
  valid: boolean;
  /** Field-specific error messages (keyed by field name) */
  errors?: Record<string, string>;
}

/**
 * Configuration for a single wizard step
 */
export interface WizardStep {
  /** Unique step identifier */
  id: string;
  /** Step title displayed in progress indicator */
  title: string;
  /** Optional description for the step */
  description?: string;
  /** Optional icon component for the step */
  icon?: ComponentType<{ className?: string }>;
  /** Whether this step can be skipped */
  optional?: boolean;
  /** Whether this step renders its own completion action instead of the shared one */
  hideCompleteButton?: boolean;
  /**
   * Validation function for the step.
   * Called before navigation to the next step.
   * @param data - The current wizard data
   * @returns Validation result with errors if invalid
   */
  validate?: (data: unknown) => ValidationResult | Promise<ValidationResult>;
}

/**
 * Internal wizard state managed by WizardProvider
 */
export interface WizardState<TData extends Record<string, unknown>> {
  /** Current step index (0-based) */
  currentStep: number;
  /** Set of step indices that have been completed */
  completedSteps: Set<number>;
  /** Set of step indices that have been skipped */
  skippedSteps: Set<number>;
  /** Accumulated wizard data from all steps */
  data: Partial<TData>;
  /** Field-level error messages */
  errors: Record<string, string>;
  /** Whether the wizard is currently submitting */
  isSubmitting: boolean;
}

/**
 * Context value provided by WizardProvider
 */
export interface WizardContextValue<TData extends Record<string, unknown>> {
  // ============================================
  // State (read-only)
  // ============================================

  /** Current wizard state */
  state: WizardState<TData>;
  /** All step configurations */
  steps: WizardStep[];
  /** Configuration for the current step */
  currentStepConfig: WizardStep;
  /** Whether currently on the first step */
  isFirstStep: boolean;
  /** Whether currently on the last step */
  isLastStep: boolean;
  /** Progress percentage (0-100) */
  progress: number;
  /**
   * Whether the current step's validator returns valid for the current data.
   * For async validators, defaults to true (gate enforced on Next click instead).
   */
  currentStepIsValid: boolean;

  // ============================================
  // Navigation
  // ============================================

  /**
   * Navigate to a specific step by index.
   * Only allows navigation to completed steps or the next available step.
   */
  goToStep: (step: number) => void;

  /**
   * Attempt to advance to the next step.
   * Validates the current step first.
   * @returns true if navigation succeeded, false if validation failed
   */
  nextStep: () => Promise<boolean>;

  /** Navigate to the previous step */
  prevStep: () => void;

  /**
   * Skip the current step (if optional).
   * Marks the step as skipped and advances to the next.
   */
  skipStep: () => void;

  // ============================================
  // Data Management
  // ============================================

  /**
   * Update a single field in the wizard data
   * @param key - The data field key
   * @param value - The new value
   */
  updateData: <K extends keyof TData>(key: K, value: TData[K]) => void;

  /**
   * Update multiple fields in the wizard data at once
   * @param data - Partial data to merge
   */
  updateStepData: (data: Partial<TData>) => void;

  /**
   * Set an error message for a specific field
   * @param field - The field name (can use dot notation for nested fields)
   * @param message - The error message
   */
  setError: (field: string, message: string) => void;

  /**
   * Clear the error message for a specific field
   * @param field - The field name
   */
  clearError: (field: string) => void;

  /**
   * Clear all errors
   */
  clearAllErrors: () => void;

  // ============================================
  // Lifecycle
  // ============================================

  /** Reset the wizard to its initial state */
  reset: () => void;

  /**
   * Complete the wizard.
   * Calls the onComplete callback with the final data.
   */
  complete: () => Promise<void>;
}

/**
 * Props for WizardProvider component
 */
export interface WizardProviderProps<TData extends Record<string, unknown>> {
  /** Step configurations */
  steps: WizardStep[];

  /** Initial wizard data */
  initialData?: Partial<TData>;

  /**
   * localStorage key for persistence.
   * If provided, wizard state will be saved and restored across sessions.
   */
  storageKey?: string;

  /**
   * Callback fired when navigating between steps
   * @param step - The new step index
   * @param direction - Whether navigating forward or backward
   */
  onStepChange?: (step: number, direction: "forward" | "backward") => void;

  /**
   * Callback fired when the wizard is completed.
   * This is where you typically submit data to your API.
   * @param data - The complete wizard data
   */
  onComplete: (data: TData) => Promise<void>;

  /** React children to render within the provider */
  children: ReactNode;
}

/**
 * Props for WizardNavigation component
 */
export interface WizardNavigationProps {
  /** Override default button labels */
  labels?: {
    back?: string;
    next?: string;
    skip?: string;
    complete?: string;
  };
  /** Show skip button for optional steps (defaults to true) */
  showSkip?: boolean;
  /** Custom content between back and next buttons */
  children?: ReactNode;
  /** Additional className */
  className?: string;
}

/**
 * Props for WizardProgress component
 */
export interface WizardProgressProps {
  /** Orientation of the step indicator */
  orientation?: "horizontal" | "vertical";
  /** Size variant */
  size?: "sm" | "md" | "lg";
  /** Show step descriptions */
  showDescriptions?: boolean;
  /** Allow clicking on completed/current steps to navigate */
  clickable?: boolean;
  /** Additional className */
  className?: string;
}
