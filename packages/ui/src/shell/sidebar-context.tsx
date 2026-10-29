"use client";

import * as React from "react";

interface SidebarContextValue {
  /** Whether the sidebar is open (mobile only) */
  isOpen: boolean;
  /** Set the sidebar open state */
  setIsOpen: (open: boolean) => void;
  /** Toggle the sidebar open state */
  toggle: () => void;
}

const SidebarContext = React.createContext<SidebarContextValue | undefined>(undefined);

export interface SidebarProviderProps {
  children: React.ReactNode;
  /** Initial open state (default: false) */
  defaultOpen?: boolean;
}

/**
 * Provider for sidebar state management.
 * Used to control mobile sidebar open/close state across components.
 */
export function SidebarProvider({ children, defaultOpen = false }: SidebarProviderProps) {
  const [isOpen, setIsOpen] = React.useState(defaultOpen);

  const toggle = React.useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  const value = React.useMemo(() => ({ isOpen, setIsOpen, toggle }), [isOpen, toggle]);

  return <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>;
}

/**
 * Hook to access sidebar state.
 * Must be used within a SidebarProvider.
 */
export function useSidebar() {
  const context = React.useContext(SidebarContext);
  if (context === undefined) {
    throw new Error("useSidebar must be used within a SidebarProvider");
  }
  return context;
}

/**
 * Optional hook that doesn't throw if used outside provider.
 * Useful for components that may or may not be in a provider.
 */
export function useSidebarOptional() {
  return React.useContext(SidebarContext);
}
