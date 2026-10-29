"use client";

import * as React from "react";

/** Registers a window-level Cmd/Ctrl+K listener that toggles the palette. */
export function useCommandPaletteShortcut(setOpen: (updater: (prev: boolean) => boolean) => void) {
  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented) return;
      const isShortcut =
        event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey) && !event.altKey;
      if (!isShortcut) return;

      const target = event.target as HTMLElement | null;
      const focused = document.activeElement as HTMLElement | null;
      if (isEditableElement(target) || isEditableElement(focused)) return;

      event.preventDefault();
      setOpen((previous) => !previous);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [setOpen]);
}

/** Returns whether an element is an editable surface that owns Cmd/Ctrl+K. */
export function isEditableElement(element: HTMLElement | null): boolean {
  if (!element) return false;
  return element.isContentEditable || element.contentEditable === "true";
}
