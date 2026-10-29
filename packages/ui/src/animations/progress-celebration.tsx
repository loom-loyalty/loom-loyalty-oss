"use client";

import { PartyPopper, Rocket, Sparkles, Star, Trophy } from "lucide-react";
import type { ComponentType, ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";

import { useReducedMotion } from "../a11y/use-reduced-motion";
import { cn } from "../lib/utils";
import { Confetti, useConfetti } from "./confetti";
import { SuccessBadge, SuccessRing } from "./success-badge";

export interface ProgressCelebrationProps {
  /** Trigger celebration when this changes to true */
  trigger: boolean;
  /** Title text */
  title: string;
  /** Description text */
  description?: string;
  /** Milestone number (e.g., step 1 of 5) */
  milestone?: {
    current: number;
    total: number;
  };
  /** Celebration variant */
  variant?: "badge" | "ring" | "full";
  /** Icon to display */
  icon?: ComponentType<{ className?: string }>;
  /** Show confetti (default: true for "full" variant) */
  showConfetti?: boolean;
  /** Callback when celebration completes */
  onComplete?: () => void;
  /** Additional class name */
  className?: string;
  /** Children for custom content */
  children?: ReactNode;
}

/**
 * Combined celebration component for milestone achievements.
 * Optionally includes confetti with success badge/ring.
 *
 * @example
 * ```tsx
 * // Basic celebration
 * <ProgressCelebration
 *   trigger={stepComplete}
 *   title="Step Complete!"
 *   description="Moving on to the next step"
 *   onComplete={() => setStepComplete(false)}
 * />
 *
 * // With milestone progress
 * <ProgressCelebration
 *   trigger={isComplete}
 *   title="Program Basics Complete"
 *   milestone={{ current: 1, total: 5 }}
 *   variant="full"
 * />
 * ```
 */
export function ProgressCelebration({
  trigger,
  title,
  description,
  milestone,
  variant = "badge",
  icon,
  showConfetti,
  onComplete,
  className,
  children,
}: ProgressCelebrationProps) {
  const prefersReducedMotion = useReducedMotion();
  const [isVisible, setIsVisible] = useState(false);
  const [confettiTrigger, setConfettiTrigger] = useState(false);

  // Default showConfetti to true for full variant
  const shouldShowConfetti = showConfetti ?? variant === "full";

  // Select appropriate icon based on milestone
  const getDefaultIcon = useCallback(() => {
    if (icon) return icon;
    if (!milestone) return Sparkles;

    // Special icons for milestones
    if (milestone.current === milestone.total) return Trophy;
    if (milestone.current === 1) return Rocket;
    if (milestone.current >= milestone.total / 2) return Star;
    return PartyPopper;
  }, [icon, milestone]);

  const Icon = getDefaultIcon();

  useEffect(() => {
    if (trigger && !isVisible) {
      // Use microtask to avoid synchronous setState in effect
      queueMicrotask(() => {
        setIsVisible(true);
      });

      // Trigger confetti slightly after badge appears
      if (shouldShowConfetti && !prefersReducedMotion) {
        const confettiTimer = setTimeout(() => {
          setConfettiTrigger(true);
        }, 200);
        return () => clearTimeout(confettiTimer);
      }
    }
  }, [trigger, isVisible, shouldShowConfetti, prefersReducedMotion]);

  const handleConfettiComplete = useCallback(() => {
    setConfettiTrigger(false);
    // Only call onComplete after both animations finish
    if (variant === "full" && onComplete) {
      const completeTimer = setTimeout(onComplete, 500);
      return () => clearTimeout(completeTimer);
    }
  }, [variant, onComplete]);

  if (!trigger && !isVisible) {
    return null;
  }

  const milestoneText = milestone ? `Step ${milestone.current} of ${milestone.total}` : undefined;

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center",
        variant === "full" && "min-h-[200px] py-8",
        className
      )}
      role="status"
      aria-live="polite"
    >
      {/* Confetti */}
      {shouldShowConfetti && (
        <Confetti
          trigger={confettiTrigger}
          onComplete={handleConfettiComplete}
          duration={variant === "full" ? 3000 : 2000}
          particleCount={variant === "full" ? 150 : 80}
        />
      )}

      {/* Success indicator */}
      {variant === "badge" && (
        <SuccessBadge
          icon={Icon}
          title={title}
          description={description || milestoneText}
          size="md"
          animate={trigger}
        >
          {children}
        </SuccessBadge>
      )}

      {variant === "ring" && (
        <SuccessRing
          title={title}
          description={description || milestoneText}
          size="lg"
          animate={trigger}
        />
      )}

      {variant === "full" && (
        <div className="flex flex-col items-center gap-6">
          <SuccessBadge
            icon={Icon}
            title={title}
            description={description}
            size="lg"
            animate={trigger}
          />

          {/* Milestone indicator */}
          {milestone && (
            <MilestoneProgress
              current={milestone.current}
              total={milestone.total}
              animate={trigger}
            />
          )}

          {children}
        </div>
      )}
    </div>
  );
}

/**
 * Visual milestone progress indicator
 */
interface MilestoneProgressProps {
  current: number;
  total: number;
  animate?: boolean;
  className?: string;
}

function MilestoneProgress({ current, total, animate = true, className }: MilestoneProgressProps) {
  const prefersReducedMotion = useReducedMotion();
  const [isAnimated, setIsAnimated] = useState(!animate);
  const shouldAnimate = animate && !prefersReducedMotion;

  useEffect(() => {
    if (shouldAnimate) {
      const timer = setTimeout(() => setIsAnimated(true), 600);
      return () => clearTimeout(timer);
    } else {
      // Use microtask to avoid synchronous setState in effect
      queueMicrotask(() => {
        setIsAnimated(true);
      });
    }
  }, [shouldAnimate]);

  const progress = (current / total) * 100;

  return (
    <div
      className={cn(
        "flex flex-col items-center gap-2",
        shouldAnimate && [
          "transition-all delay-500 duration-500",
          isAnimated ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0",
        ],
        className
      )}
    >
      {/* Progress bar */}
      <div className="flex items-center gap-2">
        <div className="bg-muted h-2 w-32 overflow-hidden rounded-full">
          <div
            className="bg-primary h-full rounded-full"
            style={{
              width: shouldAnimate ? (isAnimated ? `${progress}%` : "0%") : `${progress}%`,
              transition: shouldAnimate ? "width 0.8s ease-out 0.2s" : undefined,
            }}
          />
        </div>
        <span className="text-muted-foreground text-sm font-medium">
          {current}/{total}
        </span>
      </div>

      {/* Completion message */}
      {current === total && <p className="text-primary text-sm font-medium">All steps complete!</p>}
    </div>
  );
}

/**
 * Hook for programmatic celebration control
 */
export interface UseCelebrationOptions {
  /** Default title */
  title?: string;
  /** Default description */
  description?: string;
  /** Default variant */
  variant?: "badge" | "ring" | "full";
  /** Show confetti */
  showConfetti?: boolean;
  /** Celebration duration in ms */
  duration?: number;
}

export interface CelebrationState {
  isActive: boolean;
  title: string;
  description?: string;
  milestone?: { current: number; total: number };
}

export function useCelebration(defaultOptions: UseCelebrationOptions = {}) {
  const [state, setState] = useState<CelebrationState>({
    isActive: false,
    title: defaultOptions.title || "",
    description: defaultOptions.description,
  });

  const confetti = useConfetti();

  const celebrate = useCallback(
    (
      options: {
        title?: string;
        description?: string;
        milestone?: { current: number; total: number };
      } = {}
    ) => {
      setState({
        isActive: true,
        title: options.title || defaultOptions.title || "Success!",
        description: options.description || defaultOptions.description,
        milestone: options.milestone,
      });

      // Also fire confetti if enabled
      if (defaultOptions.showConfetti !== false) {
        confetti.fire();
      }
    },
    [defaultOptions, confetti]
  );

  const reset = useCallback(() => {
    setState((prev) => ({ ...prev, isActive: false }));
    confetti.reset();
  }, [confetti]);

  return {
    ...state,
    celebrate,
    reset,
    trigger: state.isActive,
  };
}

/**
 * Pre-configured celebration for step completion
 */
export interface StepCelebrationProps {
  /** Current step number */
  currentStep: number;
  /** Total steps */
  totalSteps: number;
  /** Step name */
  stepName: string;
  /** Trigger celebration */
  trigger: boolean;
  /** Callback when complete */
  onComplete?: () => void;
  /** Additional class name */
  className?: string;
}

export function StepCelebration({
  currentStep,
  totalSteps,
  stepName,
  trigger,
  onComplete,
  className,
}: StepCelebrationProps) {
  const isLastStep = currentStep === totalSteps;

  return (
    <ProgressCelebration
      trigger={trigger}
      title={isLastStep ? "All Done!" : `${stepName} Complete`}
      description={isLastStep ? "You've completed all steps" : `Moving to step ${currentStep + 1}`}
      milestone={{ current: currentStep, total: totalSteps }}
      variant={isLastStep ? "full" : "badge"}
      showConfetti={isLastStep}
      onComplete={onComplete}
      className={className}
    />
  );
}

/**
 * Final completion celebration with extra fanfare
 */
export interface CompletionCelebrationProps {
  /** Trigger celebration */
  trigger: boolean;
  /** Title text */
  title?: string;
  /** Description text */
  description?: string;
  /** Callback when complete */
  onComplete?: () => void;
  /** Call to action button */
  action?: ReactNode;
  /** Additional class name */
  className?: string;
}

export function CompletionCelebration({
  trigger,
  title = "Congratulations!",
  description = "You've completed the setup",
  onComplete,
  action,
  className,
}: CompletionCelebrationProps) {
  return (
    <ProgressCelebration
      trigger={trigger}
      title={title}
      description={description}
      variant="full"
      icon={Trophy}
      showConfetti
      onComplete={onComplete}
      className={className}
    >
      {action && <div className="mt-4">{action}</div>}
    </ProgressCelebration>
  );
}
