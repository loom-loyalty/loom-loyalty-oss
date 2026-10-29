import * as React from "react";

import { cn } from "../lib/utils";

export interface LoadingSplashProps {
  /** Message displayed below the loading indicator */
  message?: string;
  /** Additional CSS classes for the outer container */
  className?: string;
  /**
   * Replaces the animated Loom Loyalty icon, for a white-label brand: a node shows that mark, and
   * `null` shows no mark at all. Omit it for the Loom Loyalty icon.
   */
  logo?: React.ReactNode;
}

/**
 * Animated Loom Icon — each bar/dot fades + slides in with staggered timing,
 * evoking threads being woven on a loom.
 */
function AnimatedLoomIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="18 15 112 112"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0", className)}
      aria-hidden="true"
    >
      {/* Amber bars — fill set via CSS (.loom-color-accent) */}
      <rect
        className="loom-bar loom-bar-1 loom-color-accent"
        x="75.76"
        y="25.03"
        width="12.63"
        height="54.76"
        rx="6.32"
        transform="rotate(48.36 82.07 52.41)"
      />
      <rect
        className="loom-bar loom-bar-6 loom-color-accent"
        x="37.51"
        y="70.94"
        width="12.63"
        height="30.94"
        rx="6.32"
        transform="rotate(48.36 43.83 86.42)"
      />
      {/* Teal bars — fill set via CSS (.loom-color-primary) */}
      <rect
        className="loom-bar loom-bar-3 loom-color-primary"
        x="99.01"
        y="46.22"
        width="12.63"
        height="27.97"
        rx="6.32"
        transform="rotate(48.36 105.33 60.21)"
      />
      <rect
        className="loom-bar loom-bar-2 loom-color-primary"
        x="61.38"
        y="65.04"
        width="12.63"
        height="57.21"
        rx="6.32"
        transform="rotate(48.36 67.69 93.66)"
      />
      <rect
        className="loom-bar loom-bar-5 loom-color-primary"
        x="65.58"
        y="29.87"
        width="12.89"
        height="12.89"
        rx="6.45"
        transform="rotate(-41.64 72.02 36.31)"
      />
      <rect
        className="loom-bar loom-bar-8 loom-color-primary"
        x="73.95"
        y="103.14"
        width="12.89"
        height="12.89"
        rx="6.45"
        transform="rotate(138.36 80.40 109.60)"
      />
      {/* Orange dots — fill set via CSS (.loom-color-accent-dark) */}
      <rect
        className="loom-bar loom-bar-7 loom-color-accent-dark"
        x="33.87"
        y="58.06"
        width="12.89"
        height="12.89"
        rx="6.45"
        transform="rotate(-41.64 40.31 64.50)"
      />
      <rect
        className="loom-bar loom-bar-10 loom-color-accent-dark"
        x="105.66"
        y="74.95"
        width="12.89"
        height="12.89"
        rx="6.45"
        transform="rotate(138.36 112.11 81.40)"
      />
      {/* Emerald bars — fill set via CSS (.loom-color-success) */}
      <rect
        className="loom-bar loom-bar-4 loom-color-success"
        x="44.93"
        y="31.63"
        width="12.89"
        height="26.4"
        rx="6.45"
        transform="rotate(-41.64 51.37 44.82)"
      />
      <rect
        className="loom-bar loom-bar-9 loom-color-success"
        x="94.42"
        y="87.29"
        width="12.89"
        height="26.4"
        rx="6.45"
        transform="rotate(138.36 100.86 100.50)"
      />
    </svg>
  );
}

/**
 * LoadingSplash — a premium full-screen loading state for Loom Loyalty apps.
 *
 * Features:
 * - Animated Loom icon with staggered bar reveals (weaving metaphor)
 * - Smooth gradient progress bar with a shimmer sweep
 * - Soft pulse on the icon after reveal completes
 * - Respects `prefers-reduced-motion`
 *
 * @example
 * ```tsx
 * <LoadingSplash message="Loading your dashboard..." />
 * ```
 */
export function LoadingSplash({
  message = "Loading...",
  className,
  logo,
}: LoadingSplashProps): React.ReactNode {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={message}
      className={cn(
        "loading-splash bg-background flex min-h-screen items-center justify-center",
        className
      )}
    >
      <div className="flex flex-col items-center gap-8 lg:gap-10">
        {/* Animated Loom Icon — scales up with viewport */}
        {logo === undefined ? (
          <div className="loom-icon-container flex h-40 w-40 items-center justify-center sm:h-52 sm:w-52 md:h-60 md:w-60">
            <AnimatedLoomIcon className="h-36 w-36 sm:h-48 sm:w-48 md:h-56 md:w-56" />
          </div>
        ) : (
          logo !== null && <div className="flex items-center justify-center">{logo}</div>
        )}

        {/* Gradient progress bar with shimmer */}
        <div className="loom-progress-track" aria-hidden="true">
          <div className="loom-progress-fill" />
        </div>

        {/* Message */}
        <p className="text-muted-foreground text-base font-semibold tracking-wide lg:text-lg">
          {message}
        </p>
      </div>
    </div>
  );
}
