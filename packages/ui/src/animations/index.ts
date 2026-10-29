/**
 * Animations - Celebration and feedback animations
 *
 * Components for milestone celebrations, success indicators, and
 * visual feedback in wizard flows and other interactive UIs.
 */

// Confetti celebrations
export {
  Confetti,
  fireConfetti,
  useConfetti,
  type ConfettiProps,
  type UseConfettiOptions,
} from "./confetti";

// Success badges and indicators
export {
  AnimatedCheckmark,
  SuccessBadge,
  SuccessRing,
  type AnimatedCheckmarkProps,
  type SuccessBadgeProps,
  type SuccessRingProps,
} from "./success-badge";

// Progress celebrations
export {
  CompletionCelebration,
  ProgressCelebration,
  StepCelebration,
  useCelebration,
  type CelebrationState,
  type CompletionCelebrationProps,
  type ProgressCelebrationProps,
  type StepCelebrationProps,
  type UseCelebrationOptions,
} from "./progress-celebration";

// Loading splash screen
export { LoadingSplash, type LoadingSplashProps } from "./loading-splash";
