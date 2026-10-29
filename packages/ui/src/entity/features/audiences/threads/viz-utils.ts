/**
 * Shared visualization utilities for THREADS D3 components.
 * Reads CSS custom properties from the :root element for theme-aware colors.
 */

/**
 * Read a CSS custom property value from the document root.
 * Falls back to the provided value when running server-side or if the variable is unset.
 */
export const getVizColor = (varName: string, fallback: string): string => {
  if (typeof window !== "undefined") {
    const value = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
    return value || fallback;
  }
  return fallback;
};

/**
 * Standard category→color mapping for D3 visualizations.
 * Uses --viz-* CSS tokens defined in globals.css.
 */
export const getCategoryColors = (): Record<string, string> => ({
  purchase: getVizColor("--viz-secondary", "#059669"),
  engagement: getVizColor("--viz-accent", "#F59E0B"),
  loyalty: getVizColor("--viz-primary", "#0E7490"),
  demographics: getVizColor("--viz-info", "#3B82F6"),
  behavior: getVizColor("--viz-highlight", "#F43F5E"),
  segment: getVizColor("--viz-primary", "#0E7490"),
  default: getVizColor("--viz-neutral", "#6b7280"),
});

/**
 * Check if the user prefers reduced motion.
 * D3 transitions should use duration 0 when this returns true.
 */
export const prefersReducedMotion = (): boolean => {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
};
