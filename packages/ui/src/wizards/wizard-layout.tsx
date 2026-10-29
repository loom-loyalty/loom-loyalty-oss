"use client";

import { RotateCcw } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";

import { useReducedMotion } from "../a11y/use-reduced-motion";
import { cn } from "../lib/utils";
import { Button } from "../primitives/button";
import { useWizard } from "./use-wizard";

/**
 * Props for WizardLayout component
 */
export interface WizardLayoutProps {
  /** Content for the steps/navigation column (left side) */
  stepsSlot: ReactNode;
  /** Main form content (center) */
  contentSlot: ReactNode;
  /** Preview panel content (right side) */
  previewSlot?: ReactNode;
  /** Footer with navigation buttons */
  footerSlot?: ReactNode;
  /** Title shown above content area */
  title?: string;
  /** Description shown below title */
  description?: string;
  /** Show the "Start Over" button */
  showStartOver?: boolean;
  /** Callback when "Start Over" is clicked */
  onStartOver?: () => void;
  /** Whether the wizard is in a completed state */
  isComplete?: boolean;
  /** Optional right-aligned actions in the step header (e.g., "Save as template"). */
  headerActions?: ReactNode;
  /** Additional className for the container */
  className?: string;
}

/**
 * 3-column wizard layout with responsive behavior.
 *
 * Desktop (lg+): Steps (in card) | Form Content | Preview
 * Mobile/Tablet (<lg): Horizontal stepper + Form Content (no preview)
 *
 * Must be rendered inside a `WizardProvider` — consumes `useWizard()` to
 * scroll the content viewport to top on step change.
 *
 * @example
 * ```tsx
 * <WizardProvider steps={steps} initialData={data} onComplete={onComplete}>
 *   <WizardLayout
 *     stepsSlot={<WizardStepper steps={steps} currentStep={0} />}
 *     contentSlot={<ProgramStep />}
 *     previewSlot={<ProgramPreview data={wizardData} />}
 *     footerSlot={<WizardNavigation />}
 *     title="Create Program"
 *     description="Define your loyalty program identity"
 *   />
 * </WizardProvider>
 * ```
 */
export function WizardLayout({
  stepsSlot,
  contentSlot,
  previewSlot,
  footerSlot,
  title,
  description,
  showStartOver = false,
  onStartOver,
  isComplete = false,
  headerActions,
  className,
}: WizardLayoutProps) {
  const { state } = useWizard();
  const prefersReducedMotion = useReducedMotion();
  const contentScrollRef = useRef<HTMLDivElement>(null);
  // Track the last step we scrolled for so an async re-render (e.g. when
  // useReducedMotion flips its state post-mount) doesn't snap users to top.
  const lastScrolledStepRef = useRef<number | null>(null);

  // Scroll to top only when the step itself changes — not on motion-pref updates.
  useEffect(() => {
    if (lastScrolledStepRef.current === state.currentStep) return;
    if (lastScrolledStepRef.current === null) {
      lastScrolledStepRef.current = state.currentStep;
      return;
    }
    contentScrollRef.current?.scrollTo({
      top: 0,
      behavior: prefersReducedMotion ? "instant" : "smooth",
    });
    lastScrolledStepRef.current = state.currentStep;
  }, [state.currentStep, prefersReducedMotion]);

  return (
    <div className={cn("flex min-h-full flex-col", className)}>
      {/* Mobile Stepper - Show on mobile/tablet only */}
      <div className="bg-background border-border flex-shrink-0 border-b px-4 py-3 lg:hidden">
        {stepsSlot}
      </div>

      {/* Main 3-column grid */}
      <div className="flex flex-1 items-start">
        {/* Steps Column - Desktop only */}
        <aside className="hidden w-[280px] flex-shrink-0 flex-col pr-4 lg:flex">
          {/* Header area with title - h-14 to align with content header */}
          <div className="border-border flex h-14 flex-shrink-0 items-center border-b">
            <h1 className="text-foreground text-lg font-semibold">Program Setup</h1>
          </div>

          {/* Steps navigation */}
          <nav aria-label="Wizard steps" className="pt-4">
            {stepsSlot}
          </nav>

          {/* Start Over button with divider */}
          {showStartOver && !isComplete && (
            <div className="border-border flex-shrink-0 border-t pt-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={onStartOver}
                className="text-muted-foreground hover:text-foreground w-full justify-start"
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                Start Over
              </Button>
            </div>
          )}
        </aside>

        {/* Content Column */}
        <main className="flex min-w-0 flex-1 items-start gap-4 pr-4">
          {/* Form Content Area - natural height, scrolls internally if needed */}
          <div className="bg-card border-border flex max-h-[calc(100vh-8rem)] min-w-0 flex-1 flex-col rounded-lg border">
            {/* Content Header - h-14 to align with steps header */}
            {title && (
              <header className="border-border flex h-14 flex-shrink-0 items-center justify-between border-b px-6 lg:px-8">
                <h2 className="text-foreground text-lg font-semibold">{title}</h2>

                <div className="flex items-center gap-2">
                  {headerActions}
                  {/* Mobile Start Over */}
                  {showStartOver && !isComplete && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={onStartOver}
                      className="text-muted-foreground hover:text-foreground lg:hidden"
                    >
                      <RotateCcw className="mr-1 h-4 w-4" />
                      Start Over
                    </Button>
                  )}
                </div>
              </header>
            )}

            {/* Form Content - scrollable when content overflows */}
            <div
              ref={contentScrollRef}
              className="scrollbar-thin flex-1 overflow-y-auto px-6 py-6 lg:px-8"
            >
              {description && <p className="text-muted-foreground mb-6 text-sm">{description}</p>}
              {contentSlot}
            </div>

            {/* Footer with Navigation */}
            {footerSlot && (
              <footer className="border-border flex-shrink-0 border-t px-6 py-4 lg:px-8">
                {footerSlot}
              </footer>
            )}
          </div>

          {/* Preview Column - Desktop */}
          {previewSlot && (
            <aside className="hidden w-[320px] flex-shrink-0 xl:block">
              {/* Preview Header - h-14 to align with other headers */}
              <div className="border-border flex h-14 flex-shrink-0 flex-col justify-center border-b">
                <h3 className="text-foreground text-sm font-medium">Preview</h3>
                <p className="text-muted-foreground text-xs">See how your program will look</p>
              </div>
              {previewSlot}
            </aside>
          )}
        </main>
      </div>
    </div>
  );
}
