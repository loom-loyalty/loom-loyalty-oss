"use client";

import { useLayoutEffect } from "react";

/**
 * Removes the default content padding from AppLayout's `<main id="main-content">`.
 * Call this in any page component that needs edge-to-edge layout (e.g., Customer 360).
 *
 * Works by toggling CSS classes on the `#main-content` element via useLayoutEffect
 * so the change happens before paint (no flash).
 */
export function useFullBleedLayout(): void {
  useLayoutEffect(() => {
    const main = document.getElementById("main-content");
    if (!main) return;

    // Remove default AppLayout padding classes directly
    main.classList.remove("p-4", "lg:p-6");

    return () => {
      // Restore default padding on unmount
      main.classList.add("p-4", "lg:p-6");
    };
  }, []);
}
