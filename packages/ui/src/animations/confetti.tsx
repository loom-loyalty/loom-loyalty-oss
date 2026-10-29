"use client";

import confetti from "canvas-confetti";
import { useCallback, useEffect, useRef } from "react";

import { useReducedMotion } from "../a11y/use-reduced-motion";

export interface ConfettiProps {
  /** Trigger confetti when this changes to true */
  trigger: boolean;
  /** Duration in milliseconds (default: 3000) */
  duration?: number;
  /** Number of particles per burst (default: 100) */
  particleCount?: number;
  /** Spread angle in degrees (default: 70) */
  spread?: number;
  /** Colors for confetti (defaults to brand colors) */
  colors?: string[];
  /** Origin point (default: center bottom) */
  origin?: { x: number; y: number };
  /** Callback when animation completes */
  onComplete?: () => void;
}

// Brand colors for confetti
const DEFAULT_COLORS = [
  "#0e7490", // primary (teal)
  "#0c5f74", // primary-dark
  "#d4a017", // accent (gold)
  "#10b981", // success (emerald)
  "#fbbf24", // amber
  "#f472b6", // pink
];

/**
 * Confetti celebration animation using canvas-confetti.
 * Respects prefers-reduced-motion.
 *
 * @example
 * ```tsx
 * const [showConfetti, setShowConfetti] = useState(false);
 *
 * // Trigger on success
 * <Confetti
 *   trigger={showConfetti}
 *   onComplete={() => setShowConfetti(false)}
 * />
 * ```
 */
export function Confetti({
  trigger,
  duration = 3000,
  particleCount = 100,
  spread = 70,
  colors = DEFAULT_COLORS,
  origin = { x: 0.5, y: 0.9 },
  onComplete,
}: ConfettiProps) {
  const prefersReducedMotion = useReducedMotion();
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevTriggerRef = useRef(trigger);

  const fireConfetti = useCallback(() => {
    // Skip animation if user prefers reduced motion
    if (prefersReducedMotion) {
      onComplete?.();
      return;
    }

    const end = Date.now() + duration;

    // Fire multiple bursts for a full effect
    const frame = () => {
      confetti({
        particleCount: Math.floor(particleCount / 5),
        angle: 60,
        spread,
        origin: { x: 0, y: origin.y },
        colors,
        disableForReducedMotion: true,
      });

      confetti({
        particleCount: Math.floor(particleCount / 5),
        angle: 120,
        spread,
        origin: { x: 1, y: origin.y },
        colors,
        disableForReducedMotion: true,
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    };

    // Initial center burst
    confetti({
      particleCount,
      spread,
      origin,
      colors,
      disableForReducedMotion: true,
    });

    // Side bursts
    frame();

    // Call onComplete after duration
    timeoutRef.current = setTimeout(() => {
      onComplete?.();
    }, duration);
  }, [duration, particleCount, spread, origin, colors, onComplete, prefersReducedMotion]);

  useEffect(() => {
    // Only fire when trigger changes from false to true
    if (trigger && !prevTriggerRef.current) {
      fireConfetti();
    }
    prevTriggerRef.current = trigger;

    // Cleanup timeout on unmount
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [trigger, fireConfetti]);

  // This component doesn't render anything - confetti uses global canvas
  return null;
}

/**
 * Hook for programmatic confetti control
 *
 * @example
 * ```tsx
 * const { fire, reset } = useConfetti();
 *
 * const handleSuccess = () => {
 *   fire({ particleCount: 150 });
 * };
 * ```
 */
export interface UseConfettiOptions {
  /** Duration in milliseconds */
  duration?: number;
  /** Number of particles */
  particleCount?: number;
  /** Spread angle */
  spread?: number;
  /** Confetti colors */
  colors?: string[];
  /** Origin point */
  origin?: { x: number; y: number };
}

export function useConfetti(defaultOptions: UseConfettiOptions = {}) {
  const prefersReducedMotion = useReducedMotion();

  const fire = useCallback(
    (options: UseConfettiOptions = {}) => {
      if (prefersReducedMotion) return;

      const {
        duration = defaultOptions.duration ?? 3000,
        particleCount = defaultOptions.particleCount ?? 100,
        spread = defaultOptions.spread ?? 70,
        colors = defaultOptions.colors ?? DEFAULT_COLORS,
        origin = defaultOptions.origin ?? { x: 0.5, y: 0.9 },
      } = options;

      const end = Date.now() + duration;

      // Initial burst
      confetti({
        particleCount,
        spread,
        origin,
        colors,
        disableForReducedMotion: true,
      });

      // Side bursts
      const frame = () => {
        confetti({
          particleCount: Math.floor(particleCount / 5),
          angle: 60,
          spread,
          origin: { x: 0, y: origin.y },
          colors,
          disableForReducedMotion: true,
        });

        confetti({
          particleCount: Math.floor(particleCount / 5),
          angle: 120,
          spread,
          origin: { x: 1, y: origin.y },
          colors,
          disableForReducedMotion: true,
        });

        if (Date.now() < end) {
          requestAnimationFrame(frame);
        }
      };

      frame();
    },
    [defaultOptions, prefersReducedMotion]
  );

  const reset = useCallback(() => {
    confetti.reset();
  }, []);

  return { fire, reset };
}

/**
 * Fire a one-off confetti burst
 * Useful for simple celebrations without component state
 */
export function fireConfetti(options: UseConfettiOptions = {}) {
  const {
    particleCount = 100,
    spread = 70,
    colors = DEFAULT_COLORS,
    origin = { x: 0.5, y: 0.9 },
  } = options;

  confetti({
    particleCount,
    spread,
    origin,
    colors,
    disableForReducedMotion: true,
  });
}
