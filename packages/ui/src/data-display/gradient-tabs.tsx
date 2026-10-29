"use client";

import * as React from "react";

import { cn } from "../lib/utils";

export interface TabItem {
  /** Unique tab identifier */
  id: string;
  /** Display label */
  label: string;
  /** Optional count badge */
  count?: number;
}

export interface GradientTabsProps {
  /** Tab items to display */
  tabs: TabItem[];
  /** Currently active tab id */
  activeTab: string;
  /** Callback when tab changes */
  onTabChange: (tabId: string) => void;
  /** Color variant */
  variant?: "primary" | "success";
  /** Accessible label for the tablist */
  ariaLabel?: string;
  /** Additional className */
  className?: string;
}

const variantStyles = {
  primary: {
    active: "bg-gradient-to-r from-primary to-primary-dark text-white",
    badge: "bg-white/20",
    inactiveBadge: "bg-muted-foreground/20",
  },
  success: {
    active: "bg-gradient-to-r from-success to-success-dark text-white",
    badge: "bg-white/20",
    inactiveBadge: "bg-muted-foreground/20",
  },
};

/**
 * Tabs component with gradient active state styling.
 * Used for filtering and navigation in both Dashboard and Hub.
 * Includes full ARIA tablist pattern for accessibility (WCAG 2.1 AA).
 *
 * @example
 * // Tab buttons reference aria-controls, so implement corresponding tabpanels:
 * <GradientTabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />
 * {tabs.map((tab) => (
 *   <div
 *     key={tab.id}
 *     role="tabpanel"
 *     id={`tabpanel-${tab.id}`}
 *     aria-labelledby={`tab-${tab.id}`}
 *     hidden={activeTab !== tab.id}
 *   >
 *     {tab content}
 *   </div>
 * ))}
 */
export function GradientTabs({
  tabs,
  activeTab,
  onTabChange,
  variant = "primary",
  ariaLabel = "Navigation tabs",
  className,
}: GradientTabsProps) {
  const styles = variantStyles[variant];

  const handleKeyDown = (e: React.KeyboardEvent, currentIndex: number) => {
    const tabCount = tabs.length;
    let newIndex = currentIndex;

    switch (e.key) {
      case "ArrowRight":
        newIndex = (currentIndex + 1) % tabCount;
        break;
      case "ArrowLeft":
        newIndex = (currentIndex - 1 + tabCount) % tabCount;
        break;
      case "Home":
        newIndex = 0;
        break;
      case "End":
        newIndex = tabCount - 1;
        break;
      default:
        return;
    }

    e.preventDefault();
    const targetTab = tabs[newIndex];
    if (targetTab) {
      onTabChange(targetTab.id);
    }
  };

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn("bg-muted inline-flex rounded-xl p-1", className)}
    >
      {tabs.map((tab, index) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            id={`tab-${tab.id}`}
            role="tab"
            aria-selected={isActive}
            aria-controls={`tabpanel-${tab.id}`}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onTabChange(tab.id)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            className={cn(
              "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all",
              isActive ? styles.active : "text-muted-foreground hover:bg-white/50"
            )}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span
                aria-label={`${tab.count} items`}
                className={cn(
                  "rounded-full px-2 py-0.5 text-xs",
                  isActive ? styles.badge : styles.inactiveBadge
                )}
              >
                {tab.count.toLocaleString()}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
