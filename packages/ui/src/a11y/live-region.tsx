"use client";

export interface LiveRegionProps {
  /** Message to announce to screen readers */
  message: string;
  /** Politeness level: "polite" waits for user idle, "assertive" interrupts immediately */
  politeness?: "polite" | "assertive";
  /** Whether the entire region should be announced (default: true) */
  atomic?: boolean;
}

/**
 * Live region component for announcing dynamic content changes to screen readers.
 * Use "polite" for non-critical updates and "assertive" for important alerts.
 */
export function LiveRegion({ message, politeness = "polite", atomic = true }: LiveRegionProps) {
  return (
    <div role="status" aria-live={politeness} aria-atomic={atomic} className="sr-only">
      {message}
    </div>
  );
}
