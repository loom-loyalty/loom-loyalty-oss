import type { LucideIcon } from "lucide-react";

// =============================================================================
// PRIMARY NAVIGATION (Icon Rail - Tier 1)
// =============================================================================

/**
 * Primary navigation section displayed in the icon rail.
 * Each section represents a top-level area of the application.
 */
export interface PrimaryNavSection {
  /** Unique identifier for the section */
  id: string;
  /** Lucide icon component */
  icon: LucideIcon;
  /** Display label (shown as tooltip and in expanded state) */
  label: string;
  /** Route href for direct navigation */
  href: string;
  /** Optional badge count or indicator */
  badge?: number | string;
  /** Whether this section is disabled */
  disabled?: boolean;
}

// =============================================================================
// SECONDARY NAVIGATION (Primary Sidebar - Tier 2)
// =============================================================================

/**
 * Secondary navigation item displayed in the primary sidebar.
 * These items appear within a section when that section is active.
 */
export interface SecondaryNavItem {
  /** Display label */
  label: string;
  /** Route href */
  href: string;
  /** Optional Lucide icon component */
  icon?: LucideIcon;
  /** Optional badge count or indicator */
  badge?: number | string;
  /** Whether this item is disabled */
  disabled?: boolean;
  /** Whether this link opens an external URL (renders as <a> with target="_blank") */
  external?: boolean;
}

/**
 * Group of secondary navigation items with an optional header.
 * Used to organize related items under a section label.
 */
export interface SecondaryNavGroup {
  /** Optional section header (e.g., "Quick Actions", "Views") */
  header?: string;
  /** Items in this group */
  items: SecondaryNavItem[];
}

/**
 * Complete secondary navigation content for a section.
 * Array of groups, each with optional header and items.
 */
export type SecondaryNavContent = SecondaryNavGroup[];

/**
 * Function type for retrieving secondary navigation content.
 * Called whenever the active section or pathname changes.
 *
 * @param sectionId - The ID of the currently active primary section
 * @param pathname - The current URL pathname
 * @returns Array of nav groups to display in the secondary sidebar
 */
export type SecondaryNavGetter = (sectionId: string, pathname: string) => SecondaryNavContent;

/**
 * Quick action item for sidebar footer
 */
export interface QuickAction {
  /** Lucide icon component */
  icon: LucideIcon;
  /** Display label (used for tooltip) */
  label: string;
  /** Route href or action handler */
  href?: string;
  /** Click handler (alternative to href) */
  onClick?: () => void;
  /** Whether this link opens an external URL (renders as <a> with target="_blank") */
  external?: boolean;
}

/**
 * Organization info displayed in sidebar
 */
export interface OrgInfo {
  /** Plan name (e.g., "Pro Plan", "Enterprise") */
  planName: string;
  /** Usage label (e.g., "24,580 members") */
  usageLabel: string;
  /** Usage percentage (0-100) */
  usagePercent: number;
  /** Usage limit label (e.g., "75% of limit") */
  limitLabel?: string;
}

/**
 * User info for header/sidebar
 */
export interface UserInfo {
  /** User display name */
  name: string;
  /** User email */
  email: string;
  /** Avatar URL (optional) */
  avatarUrl?: string;
  /** Avatar fallback initials */
  initials?: string;
}
