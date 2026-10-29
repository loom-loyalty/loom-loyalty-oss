"use client";

import { createContext, useCallback, useEffect, useMemo, useReducer, useRef } from "react";

import type {
  ValidationResult,
  WizardContextValue,
  WizardProviderProps,
  WizardState,
  WizardStep,
} from "./types";

// ============================================
// Context
// ============================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const WizardContext = createContext<WizardContextValue<any> | null>(null);

// ============================================
// Reducer Actions
// ============================================

type WizardAction<TData extends Record<string, unknown>> =
  | { type: "GO_TO_STEP"; step: number }
  | { type: "NEXT_STEP" }
  | { type: "PREV_STEP" }
  | { type: "SKIP_STEP" }
  | { type: "UPDATE_DATA"; data: Partial<TData> }
  | { type: "SET_ERROR"; field: string; message: string }
  | { type: "CLEAR_ERROR"; field: string }
  | { type: "CLEAR_ALL_ERRORS" }
  | { type: "SET_SUBMITTING"; isSubmitting: boolean }
  | { type: "MARK_COMPLETED"; step: number }
  | { type: "RESET"; initialData: Partial<TData> }
  | { type: "HYDRATE"; state: WizardState<TData> };

function wizardReducer<TData extends Record<string, unknown>>(
  state: WizardState<TData>,
  action: WizardAction<TData>
): WizardState<TData> {
  switch (action.type) {
    case "GO_TO_STEP":
      return {
        ...state,
        currentStep: action.step,
        errors: {},
      };

    case "NEXT_STEP":
      return {
        ...state,
        currentStep: state.currentStep + 1,
        errors: {},
      };

    case "PREV_STEP":
      return {
        ...state,
        currentStep: Math.max(0, state.currentStep - 1),
        errors: {},
      };

    case "SKIP_STEP": {
      const newSkipped = new Set(state.skippedSteps);
      newSkipped.add(state.currentStep);
      return {
        ...state,
        currentStep: state.currentStep + 1,
        skippedSteps: newSkipped,
        errors: {},
      };
    }

    case "UPDATE_DATA":
      return {
        ...state,
        data: { ...state.data, ...action.data },
      };

    case "SET_ERROR":
      return {
        ...state,
        errors: { ...state.errors, [action.field]: action.message },
      };

    case "CLEAR_ERROR": {
      const { [action.field]: _, ...remainingErrors } = state.errors;
      return {
        ...state,
        errors: remainingErrors,
      };
    }

    case "CLEAR_ALL_ERRORS":
      return {
        ...state,
        errors: {},
      };

    case "SET_SUBMITTING":
      return {
        ...state,
        isSubmitting: action.isSubmitting,
      };

    case "MARK_COMPLETED": {
      const newCompleted = new Set(state.completedSteps);
      newCompleted.add(action.step);
      return {
        ...state,
        completedSteps: newCompleted,
      };
    }

    case "RESET":
      return createInitialState(action.initialData);

    case "HYDRATE":
      return action.state;

    default:
      return state;
  }
}

function createInitialState<TData extends Record<string, unknown>>(
  initialData?: Partial<TData>
): WizardState<TData> {
  return {
    currentStep: 0,
    completedSteps: new Set(),
    skippedSteps: new Set(),
    data: initialData ?? ({} as Partial<TData>),
    errors: {},
    isSubmitting: false,
  };
}

// ============================================
// Storage Helpers
// ============================================

interface StorageState<TData> {
  currentStep: number;
  completedSteps: number[];
  skippedSteps: number[];
  data: Partial<TData>;
}

function serializeState<TData extends Record<string, unknown>>(state: WizardState<TData>): string {
  const storageState: StorageState<TData> = {
    currentStep: state.currentStep,
    completedSteps: Array.from(state.completedSteps),
    skippedSteps: Array.from(state.skippedSteps),
    data: state.data,
  };
  return JSON.stringify(storageState);
}

function deserializeState<TData extends Record<string, unknown>>(
  json: string
): WizardState<TData> | null {
  try {
    const parsed = JSON.parse(json) as StorageState<TData>;
    return {
      currentStep: parsed.currentStep,
      completedSteps: new Set(parsed.completedSteps),
      skippedSteps: new Set(parsed.skippedSteps),
      data: parsed.data,
      errors: {},
      isSubmitting: false,
    };
  } catch {
    return null;
  }
}

function loadFromStorage<TData extends Record<string, unknown>>(
  key: string
): WizardState<TData> | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem(key);
    if (!stored) return null;
    return deserializeState<TData>(stored);
  } catch {
    return null;
  }
}

function saveToStorage<TData extends Record<string, unknown>>(
  key: string,
  state: WizardState<TData>
): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, serializeState(state));
  } catch {
    // Storage full or unavailable - silently fail
  }
}

function clearStorage(key: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(key);
  } catch {
    // Storage unavailable - silently fail
  }
}

// ============================================
// Validation Helper
// ============================================

async function validateStep(step: WizardStep, data: unknown): Promise<ValidationResult> {
  if (!step.validate) {
    return { valid: true };
  }
  const result = step.validate(data);
  // Handle both sync and async validation
  return result instanceof Promise ? result : result;
}

// ============================================
// Provider Component
// ============================================

export function WizardProvider<TData extends Record<string, unknown>>({
  steps,
  initialData,
  storageKey,
  onStepChange,
  onComplete,
  children,
}: WizardProviderProps<TData>) {
  // Guard against empty steps array
  if (!steps || steps.length === 0) {
    throw new Error("WizardProvider requires at least one step");
  }

  // Initialize state - try to load from storage first
  const [state, dispatch] = useReducer(wizardReducer<TData>, initialData, (init) => {
    if (storageKey) {
      const stored = loadFromStorage<TData>(storageKey);
      if (stored) return stored;
    }
    return createInitialState(init);
  });

  // Track if we've hydrated from storage
  const hasHydrated = useRef(false);

  // Hydrate from storage on mount (client-side only)
  useEffect(() => {
    if (hasHydrated.current || !storageKey) return;
    hasHydrated.current = true;

    const stored = loadFromStorage<TData>(storageKey);
    if (stored) {
      dispatch({ type: "HYDRATE", state: stored });
    }
  }, [storageKey]);

  // Debounced save to storage
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!storageKey) return;

    // Clear any pending save
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Debounce storage writes by 300ms
    saveTimeoutRef.current = setTimeout(() => {
      saveToStorage(storageKey, state);
    }, 300);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [storageKey, state]);

  // Derived values
  // Clamp currentStep to valid bounds in case steps array changed dynamically
  const clampedStep = Math.min(state.currentStep, Math.max(0, steps.length - 1));
  // We've guaranteed steps.length > 0 above, so this is safe
  const currentStepConfig = steps[clampedStep] as WizardStep;
  const isFirstStep = clampedStep === 0;
  const isLastStep = clampedStep === steps.length - 1;
  const progress = Math.round(((state.currentStep + 1) / steps.length) * 100);

  const currentStepIsValid = useMemo(() => {
    if (!currentStepConfig.validate) return true;
    try {
      const result = currentStepConfig.validate(state.data);
      if (result instanceof Promise) return true;
      return result.valid;
    } catch {
      return false;
    }
  }, [currentStepConfig, state.data]);

  // Navigation handlers
  const goToStep = useCallback(
    (step: number) => {
      // Only allow navigation to completed steps or the next available step
      const canNavigate =
        step <= state.currentStep ||
        state.completedSteps.has(step - 1) ||
        state.skippedSteps.has(step - 1);

      if (canNavigate && step >= 0 && step < steps.length) {
        const direction = step > state.currentStep ? "forward" : "backward";
        dispatch({ type: "GO_TO_STEP", step });
        onStepChange?.(step, direction);
      }
    },
    [state.currentStep, state.completedSteps, state.skippedSteps, steps.length, onStepChange]
  );

  const nextStep = useCallback(async (): Promise<boolean> => {
    // Validate current step
    const validationResult = await validateStep(currentStepConfig, state.data);

    if (!validationResult.valid) {
      // Set errors from validation
      if (validationResult.errors) {
        Object.entries(validationResult.errors).forEach(([field, message]) => {
          dispatch({ type: "SET_ERROR", field, message });
        });
      }
      return false;
    }

    // Mark current step as completed
    dispatch({ type: "MARK_COMPLETED", step: state.currentStep });

    // If last step, don't advance (use complete() instead)
    if (isLastStep) {
      return true;
    }

    // Advance to next step
    dispatch({ type: "NEXT_STEP" });
    onStepChange?.(state.currentStep + 1, "forward");
    return true;
  }, [currentStepConfig, state.data, state.currentStep, isLastStep, onStepChange]);

  const prevStep = useCallback(() => {
    if (!isFirstStep) {
      dispatch({ type: "PREV_STEP" });
      onStepChange?.(state.currentStep - 1, "backward");
    }
  }, [isFirstStep, state.currentStep, onStepChange]);

  const skipStep = useCallback(() => {
    if (currentStepConfig.optional && !isLastStep) {
      dispatch({ type: "SKIP_STEP" });
      onStepChange?.(state.currentStep + 1, "forward");
    }
  }, [currentStepConfig.optional, isLastStep, state.currentStep, onStepChange]);

  // Data management
  const updateData = useCallback(<K extends keyof TData>(key: K, value: TData[K]) => {
    dispatch({ type: "UPDATE_DATA", data: { [key]: value } as unknown as Partial<TData> });
  }, []);

  const updateStepData = useCallback((data: Partial<TData>) => {
    dispatch({ type: "UPDATE_DATA", data });
  }, []);

  const setError = useCallback((field: string, message: string) => {
    dispatch({ type: "SET_ERROR", field, message });
  }, []);

  const clearError = useCallback((field: string) => {
    dispatch({ type: "CLEAR_ERROR", field });
  }, []);

  const clearAllErrors = useCallback(() => {
    dispatch({ type: "CLEAR_ALL_ERRORS" });
  }, []);

  // Lifecycle
  const reset = useCallback(() => {
    dispatch({ type: "RESET", initialData: initialData ?? {} });
    if (storageKey) {
      clearStorage(storageKey);
    }
  }, [initialData, storageKey]);

  const complete = useCallback(async () => {
    dispatch({ type: "SET_SUBMITTING", isSubmitting: true });

    try {
      // Validate final step
      const validationResult = await validateStep(currentStepConfig, state.data);

      if (!validationResult.valid) {
        if (validationResult.errors) {
          Object.entries(validationResult.errors).forEach(([field, message]) => {
            dispatch({ type: "SET_ERROR", field, message });
          });
        }
        dispatch({ type: "SET_SUBMITTING", isSubmitting: false });
        return;
      }

      // Mark final step as completed
      dispatch({ type: "MARK_COMPLETED", step: state.currentStep });

      // Call completion handler
      await onComplete(state.data as TData);

      // Clear storage on successful completion
      if (storageKey) {
        clearStorage(storageKey);
      }
    } finally {
      dispatch({ type: "SET_SUBMITTING", isSubmitting: false });
    }
  }, [currentStepConfig, state.data, state.currentStep, onComplete, storageKey]);

  // Memoize context value to prevent unnecessary re-renders
  const contextValue = useMemo<WizardContextValue<TData>>(
    () => ({
      // State
      state,
      steps,
      currentStepConfig,
      isFirstStep,
      isLastStep,
      progress,
      currentStepIsValid,
      // Navigation
      goToStep,
      nextStep,
      prevStep,
      skipStep,
      // Data
      updateData,
      updateStepData,
      setError,
      clearError,
      clearAllErrors,
      // Lifecycle
      reset,
      complete,
    }),
    [
      state,
      steps,
      currentStepConfig,
      isFirstStep,
      isLastStep,
      progress,
      currentStepIsValid,
      goToStep,
      nextStep,
      prevStep,
      skipStep,
      updateData,
      updateStepData,
      setError,
      clearError,
      clearAllErrors,
      reset,
      complete,
    ]
  );

  return <WizardContext.Provider value={contextValue}>{children}</WizardContext.Provider>;
}
