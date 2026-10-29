"use client";

import * as React from "react";

/** Tailwind lg breakpoint - sidebar collapses below this */
const MOBILE_BREAKPOINT = 1024;

/**
 * Hook to detect mobile viewport (below lg breakpoint: 1024px).
 * Uses matchMedia for performant viewport detection.
 * SSR-safe: Returns false during server render and until client hydration completes.
 */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = React.useState(false);
  const [hasMounted, setHasMounted] = React.useState(false);

  React.useEffect(() => {
    setHasMounted(true);
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };
    mql.addEventListener("change", onChange);
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  // Return false until mounted to match server render and prevent hydration mismatch
  if (!hasMounted) return false;
  return isMobile;
}
