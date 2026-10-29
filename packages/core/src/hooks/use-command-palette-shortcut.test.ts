import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { isEditableElement, useCommandPaletteShortcut } from "./use-command-palette-shortcut";

describe("useCommandPaletteShortcut", () => {
  it("toggles open state on Cmd+K", () => {
    const setOpen = vi.fn();
    renderHook(() => useCommandPaletteShortcut(setOpen));

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }));
    });

    expect(setOpen).toHaveBeenCalledTimes(1);
  });

  it("also toggles on Ctrl+K", () => {
    const setOpen = vi.fn();
    renderHook(() => useCommandPaletteShortcut(setOpen));

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true }));
    });

    expect(setOpen).toHaveBeenCalledTimes(1);
  });

  it("ignores plain k and editable elements", () => {
    const setOpen = vi.fn();
    renderHook(() => useCommandPaletteShortcut(setOpen));

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "k" }));
    });
    expect(setOpen).not.toHaveBeenCalled();

    const editable = document.createElement("div");
    editable.contentEditable = "true";
    expect(isEditableElement(editable)).toBe(true);
    expect(isEditableElement(document.createElement("input"))).toBe(false);
    expect(isEditableElement(null)).toBe(false);
  });

  it("does not toggle a shortcut that another handler already prevented", () => {
    const setOpen = vi.fn();
    renderHook(() => useCommandPaletteShortcut(setOpen));
    const event = new KeyboardEvent("keydown", { key: "k", metaKey: true, cancelable: true });
    event.preventDefault();

    act(() => window.dispatchEvent(event));

    expect(setOpen).not.toHaveBeenCalled();
  });

  it("does not toggle when Alt is held with Cmd/Ctrl+K", () => {
    const setOpen = vi.fn();
    renderHook(() => useCommandPaletteShortcut(setOpen));

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true, altKey: true }));
    });

    expect(setOpen).not.toHaveBeenCalled();
  });

  it("does not toggle from a contenteditable event target or active element", () => {
    const setOpen = vi.fn();
    const editable = document.createElement("div");
    editable.contentEditable = "true";
    document.body.appendChild(editable);
    renderHook(() => useCommandPaletteShortcut(setOpen));

    act(() => {
      editable.dispatchEvent(
        new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true })
      );
    });
    expect(setOpen).not.toHaveBeenCalled();

    const activeElement = Object.getOwnPropertyDescriptor(document, "activeElement");
    try {
      Object.defineProperty(document, "activeElement", { configurable: true, value: editable });
      act(() => {
        window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }));
      });
      expect(setOpen).not.toHaveBeenCalled();
    } finally {
      if (activeElement) Object.defineProperty(document, "activeElement", activeElement);
      else delete (document as { activeElement?: Element }).activeElement;
      document.body.removeChild(editable);
    }
  });

  it("still toggles when a plain input is focused", () => {
    const input = document.createElement("input");
    document.body.appendChild(input);
    input.focus();
    const setOpen = vi.fn();
    renderHook(() => useCommandPaletteShortcut(setOpen));

    act(() => {
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true }));
    });

    expect(setOpen).toHaveBeenCalledTimes(1);
    document.body.removeChild(input);
  });
});
