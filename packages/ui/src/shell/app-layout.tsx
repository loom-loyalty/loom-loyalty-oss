"use client";

import * as React from "react";

import { SkipLink } from "../a11y/skip-link";
import { cn } from "../lib/utils";
import { SidebarProvider } from "./sidebar-context";

export interface AppLayoutProps {
  /** Sidebar component */
  sidebar: React.ReactNode;
  /** Header component (optional - if not provided, no header is rendered) */
  header?: React.ReactNode;
  /** Main content */
  children: React.ReactNode;
  /** Additional className for the main content area */
  contentClassName?: string;
  /** Additional className for the root container */
  className?: string;
}

/**
 * Main application layout component used by both Dashboard and Hub.
 * Provides consistent structure with sidebar, optional header, and main content area.
 * Includes accessibility features: skip link, proper landmarks, and SidebarProvider for mobile.
 */
export function AppLayout({
  sidebar,
  header,
  children,
  contentClassName,
  className,
}: AppLayoutProps) {
  return (
    <SidebarProvider>
      <SkipLink targetId="main-content" />
      <div className={cn("bg-background flex h-screen overflow-hidden", className)}>
        {sidebar}
        <div className="flex flex-1 flex-col overflow-hidden">
          {header}
          <main
            id="main-content"
            tabIndex={-1}
            className={cn("flex-1 overflow-y-auto p-4 lg:p-6", contentClassName)}
          >
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
