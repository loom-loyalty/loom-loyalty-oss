"use client";

import { ChevronDown } from "lucide-react";
import * as React from "react";

import { cn } from "../lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../primitives/dropdown-menu";

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
  /**
   * Tabs kept out of the row and listed under a "More" menu. Picking one opens
   * it and shows it at the end of the row until another tab is chosen.
   */
  overflowTabs?: TabItem[];
  /** Accessible name of the More button. */
  moreLabel?: string;
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
  overflowTabs,
  moreLabel = "More tabs",
  className,
}: GradientTabsProps) {
  const styles = variantStyles[variant];
  const openOverflowTab = overflowTabs?.find((tab) => tab.id === activeTab);
  const rowTabs = openOverflowTab ? [...tabs, openOverflowTab] : tabs;
  const menuTabs = overflowTabs?.filter((tab) => tab.id !== activeTab) ?? [];
  const rowRef = React.useRef<HTMLDivElement>(null);
  // Set by the arrow keys; focus follows the selection once the row has re-rendered, since an
  // opened overflow tab leaves the row when another tab is chosen and would otherwise drop focus.
  const focusAfterRenderRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    const tabId = focusAfterRenderRef.current;
    if (tabId === null) return;
    focusAfterRenderRef.current = null;
    rowRef.current?.querySelector<HTMLElement>(`[data-tab-id="${CSS.escape(tabId)}"]`)?.focus();
  }, [activeTab]);

  const handleKeyDown = (e: React.KeyboardEvent, currentIndex: number) => {
    const tabCount = rowTabs.length;
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
    const targetTab = rowTabs[newIndex];
    if (targetTab) {
      focusAfterRenderRef.current = targetTab.id;
      onTabChange(targetTab.id);
    }
  };

  const tablist = (
    <div
      ref={rowRef}
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        "inline-flex",
        overflowTabs === undefined && "bg-muted rounded-xl p-1",
        overflowTabs === undefined && className
      )}
    >
      {rowTabs.map((tab, index) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            id={`tab-${tab.id}`}
            data-tab-id={tab.id}
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

  if (overflowTabs === undefined) return tablist;

  return (
    <div className={cn("bg-muted inline-flex items-center gap-1 rounded-xl p-1", className)}>
      {tablist}
      {menuTabs.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label={moreLabel}
            className="text-muted-foreground focus-visible:ring-ring flex min-h-11 items-center gap-1 rounded-lg px-4 py-2 text-sm font-medium transition-all hover:bg-white/50 focus-visible:ring-2 focus-visible:outline-none"
          >
            More
            <ChevronDown className="size-4" aria-hidden="true" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {menuTabs.map((tab) => (
              <DropdownMenuItem
                key={tab.id}
                className="min-h-11"
                onSelect={() => onTabChange(tab.id)}
              >
                {tab.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
