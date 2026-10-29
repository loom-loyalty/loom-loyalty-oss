"use client";

import { Check } from "lucide-react";
import type { ComponentType, ReactNode } from "react";
import { useEffect, useState } from "react";

import { useReducedMotion } from "../a11y/use-reduced-motion";
import { cn } from "../lib/utils";

export interface SuccessBadgeProps {
  /** Custom icon component (default: Check) */
  icon?: ComponentType<{ className?: string }>;
  /** Title text */
  title?: string;
  /** Description text */
  description?: string;
  /** Whether to animate on mount (default: true) */
  animate?: boolean;
  /** Size variant */
  size?: "sm" | "md" | "lg";
  /** Additional class name */
  className?: string;
  /** Children content (alternative to title/description) */
  children?: ReactNode;
}

const sizeConfig = {
  sm: {
    container: "w-12 h-12",
    icon: "h-5 w-5",
    title: "text-sm",
    description: "text-xs",
    gap: "gap-2",
  },
  md: {
    container: "w-16 h-16",
    icon: "h-7 w-7",
    title: "text-base",
    description: "text-sm",
    gap: "gap-3",
  },
  lg: {
    container: "w-20 h-20",
    icon: "h-9 w-9",
    title: "text-lg",
    description: "text-base",
    gap: "gap-4",
  },
};

/**
 * Animated success badge with checkmark.
 * Displays a celebratory success indicator with optional title and description.
 * Respects prefers-reduced-motion.
 *
 * @example
 * ```tsx
 * // Basic usage
 * <SuccessBadge />
 *
 * // With title and description
 * <SuccessBadge
 *   title="Setup Complete!"
 *   description="Your program is ready to go"
 *   size="lg"
 * />
 *
 * // Custom icon
 * <SuccessBadge
 *   icon={Star}
 *   title="Achievement Unlocked"
 * />
 * ```
 */
export function SuccessBadge({
  icon: Icon = Check,
  title,
  description,
  animate = true,
  size = "md",
  className,
  children,
}: SuccessBadgeProps) {
  const prefersReducedMotion = useReducedMotion();
  const [isAnimated, setIsAnimated] = useState(!animate);
  const sizes = sizeConfig[size];
  const shouldAnimate = animate && !prefersReducedMotion;

  useEffect(() => {
    if (shouldAnimate) {
      // Small delay to ensure animation plays
      const timer = setTimeout(() => setIsAnimated(true), 50);
      return () => clearTimeout(timer);
    } else {
      // Use microtask to avoid synchronous setState in effect
      queueMicrotask(() => {
        setIsAnimated(true);
      });
    }
  }, [shouldAnimate]);

  return (
    <div
      className={cn("flex flex-col items-center text-center", sizes.gap, className)}
      role="status"
      aria-label={title || "Success"}
    >
      {/* Animated circle with icon */}
      <div
        className={cn(
          "relative flex items-center justify-center rounded-full",
          "bg-success text-white shadow-lg",
          sizes.container,
          shouldAnimate && [
            "transition-all duration-500 ease-out",
            isAnimated ? "scale-100 opacity-100" : "scale-75 opacity-0",
          ]
        )}
      >
        {/* Pulse ring animation */}
        {shouldAnimate && isAnimated && (
          <div
            className={cn("bg-success/30 absolute inset-0 rounded-full", "animate-ping")}
            style={{ animationIterationCount: 2, animationDuration: "1s" }}
          />
        )}

        {/* Icon */}
        <Icon
          className={cn(
            sizes.icon,
            shouldAnimate && [
              "transition-all delay-200 duration-300",
              isAnimated ? "scale-100 opacity-100" : "scale-0 opacity-0",
            ]
          )}
          aria-hidden="true"
        />
      </div>

      {/* Text content */}
      {(title || description || children) && (
        <div
          className={cn(
            "space-y-1",
            shouldAnimate && [
              "transition-all delay-300 duration-500",
              isAnimated ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0",
            ]
          )}
        >
          {title && <h3 className={cn("text-foreground font-semibold", sizes.title)}>{title}</h3>}
          {description && (
            <p className={cn("text-muted-foreground", sizes.description)}>{description}</p>
          )}
          {children}
        </div>
      )}
    </div>
  );
}

/**
 * Animated checkmark SVG with stroke animation.
 * Standalone component for custom layouts.
 */
export interface AnimatedCheckmarkProps {
  /** Size in pixels */
  size?: number;
  /** Stroke color */
  color?: string;
  /** Stroke width */
  strokeWidth?: number;
  /** Whether to animate */
  animate?: boolean;
  /** Animation delay in ms */
  delay?: number;
  /** Additional class name */
  className?: string;
}

export function AnimatedCheckmark({
  size = 48,
  color = "currentColor",
  strokeWidth = 3,
  animate = true,
  delay = 0,
  className,
}: AnimatedCheckmarkProps) {
  const prefersReducedMotion = useReducedMotion();
  const [isAnimated, setIsAnimated] = useState(!animate);
  const shouldAnimate = animate && !prefersReducedMotion;

  useEffect(() => {
    if (shouldAnimate) {
      const timer = setTimeout(() => setIsAnimated(true), delay);
      return () => clearTimeout(timer);
    } else {
      // Use microtask to avoid synchronous setState in effect
      queueMicrotask(() => {
        setIsAnimated(true);
      });
    }
  }, [shouldAnimate, delay]);

  // Checkmark path length for stroke-dasharray animation
  const pathLength = 30;

  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn(
        shouldAnimate && "transition-opacity duration-300",
        isAnimated ? "opacity-100" : "opacity-0",
        className
      )}
      role="img"
      aria-label="Checkmark"
    >
      <path
        d="M20 6L9 17L4 12"
        strokeDasharray={pathLength}
        strokeDashoffset={shouldAnimate && !isAnimated ? pathLength : 0}
        style={
          shouldAnimate
            ? {
                transition: `stroke-dashoffset 0.5s ease-out ${delay}ms`,
              }
            : undefined
        }
      />
    </svg>
  );
}

/**
 * Success badge variant with a circular progress ring
 */
export interface SuccessRingProps {
  /** Title text */
  title?: string;
  /** Description text */
  description?: string;
  /** Size variant */
  size?: "sm" | "md" | "lg";
  /** Whether to animate */
  animate?: boolean;
  /** Additional class name */
  className?: string;
}

const ringSizeConfig = {
  sm: { size: 48, stroke: 3, icon: 16 },
  md: { size: 64, stroke: 4, icon: 24 },
  lg: { size: 80, stroke: 5, icon: 32 },
};

export function SuccessRing({
  title,
  description,
  size = "md",
  animate = true,
  className,
}: SuccessRingProps) {
  const prefersReducedMotion = useReducedMotion();
  const [progress, setProgress] = useState(animate ? 0 : 100);
  const shouldAnimate = animate && !prefersReducedMotion;
  const config = ringSizeConfig[size];
  const sizes = sizeConfig[size];

  const radius = (config.size - config.stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (progress / 100) * circumference;

  useEffect(() => {
    if (shouldAnimate) {
      const timer = setTimeout(() => setProgress(100), 100);
      return () => clearTimeout(timer);
    }
  }, [shouldAnimate]);

  return (
    <div
      className={cn("flex flex-col items-center text-center", sizes.gap, className)}
      role="status"
      aria-label={title || "Success"}
    >
      {/* Ring with checkmark */}
      <div className="relative" style={{ width: config.size, height: config.size }}>
        {/* Background ring */}
        <svg width={config.size} height={config.size} className="absolute inset-0">
          <circle
            cx={config.size / 2}
            cy={config.size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={config.stroke}
            className="text-muted/30"
          />
        </svg>

        {/* Progress ring */}
        <svg width={config.size} height={config.size} className="absolute inset-0 -rotate-90">
          <circle
            cx={config.size / 2}
            cy={config.size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={config.stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="text-success-dark"
            style={shouldAnimate ? { transition: "stroke-dashoffset 0.8s ease-out" } : undefined}
          />
        </svg>

        {/* Center checkmark */}
        <div className="absolute inset-0 flex items-center justify-center">
          <AnimatedCheckmark
            size={config.icon}
            color="var(--success)"
            strokeWidth={config.stroke}
            animate={animate}
            delay={shouldAnimate ? 400 : 0}
          />
        </div>
      </div>

      {/* Text content */}
      {(title || description) && (
        <div
          className={cn(
            "space-y-1",
            shouldAnimate && [
              "transition-all delay-500 duration-500",
              progress === 100 ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0",
            ]
          )}
        >
          {title && <h3 className={cn("text-foreground font-semibold", sizes.title)}>{title}</h3>}
          {description && (
            <p className={cn("text-muted-foreground", sizes.description)}>{description}</p>
          )}
        </div>
      )}
    </div>
  );
}
