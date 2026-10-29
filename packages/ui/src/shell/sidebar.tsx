"use client";

import { ExternalLink, X } from "lucide-react";

import * as React from "react";
import { LoomIcon } from "../assets";

import { useIsMobile } from "../hooks/use-mobile";
import { cn } from "../lib/utils";
import { Sheet, SheetContent } from "../primitives/sheet";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../primitives/tooltip";
import { useSidebarOptional } from "./sidebar-context";
import type {
  OrgInfo,
  PrimaryNavSection,
  QuickAction,
  SecondaryNavGetter,
  SecondaryNavItem,
} from "./types";

/**
 * Props for the Link component adapter
 */
export interface LinkComponentProps {
  href: string;
  className?: string;
  title?: string;
  "aria-label"?: string;
  children: React.ReactNode;
  onClick?: (e: React.MouseEvent) => void;
}

export interface SidebarProps {
  /** Primary navigation sections (icon rail) */
  sections: PrimaryNavSection[];
  /** Getter function for secondary navigation content */
  getSecondaryNav: SecondaryNavGetter;
  /** Current URL pathname */
  pathname: string;
  /** Quick action items for sidebar footer */
  quickActions?: QuickAction[];
  /** Organization info for footer card */
  orgInfo?: OrgInfo;
  /** Brand name displayed in sidebar header */
  brandName?: string;
  /** Mark shown in the rail's home button in place of the Loom Loyalty icon, for a white-label brand */
  logo?: React.ReactNode;
  /** Link component to use (for framework-specific routing) */
  LinkComponent?: React.ComponentType<LinkComponentProps>;
  /** Callback when navigation item is clicked */
  onNavigate?: (href: string) => void;
  /** Optional content rendered between secondary nav and org info (e.g. recently viewed) */
  extras?: React.ReactNode;
  /**
   * Replaces the org info card at the foot of the secondary sidebar, e.g. a
   * status widget. It is rendered as-is: wrap visible content in
   * `SidebarFooterSection`, and render nothing to leave the foot empty.
   */
  footer?: React.ReactNode;
}

function matchesPath(pathname: string, href: string): boolean {
  return pathname === href || (href !== "/" && pathname.startsWith(href + "/"));
}

/**
 * Determines the active section ID based on pathname.
 *
 * The most specific href wins, whether it is a section's own href or one of
 * its secondary nav items, so a section can own pages that live under another
 * section's URL prefix (e.g. "Engage" owning `/programs/offers` while
 * "Program" owns `/programs`). On a tie, a section's own href beats a
 * secondary item, then the earlier section wins. The root section (`href: "/"`)
 * owns `/` itself; its secondary items are shortcuts into other sections and
 * only claim a page no other section does. Falls back to the first section.
 */
function getActiveSectionId(
  sections: PrimaryNavSection[],
  pathname: string,
  getSecondaryNav: SecondaryNavGetter
): string | undefined {
  const exact = sections.find((s) => pathname === s.href);
  if (exact) return exact.id;

  let best: { id: string; length: number; primary: boolean } | undefined;
  let rootShortcut: string | undefined;

  for (const section of sections) {
    const isRoot = section.href === "/";
    if (!isRoot && matchesPath(pathname, section.href)) {
      const length = section.href.length;
      if (!best || length > best.length || (length === best.length && !best.primary)) {
        best = { id: section.id, length, primary: true };
      }
    }

    for (const group of getSecondaryNav(section.id, pathname)) {
      for (const item of group.items) {
        if (item.external || !matchesPath(pathname, item.href)) continue;
        if (isRoot) {
          rootShortcut ??= section.id;
          continue;
        }
        if (!best || item.href.length > best.length) {
          best = { id: section.id, length: item.href.length, primary: false };
        }
      }
    }
  }

  return best?.id ?? rootShortcut ?? sections[0]?.id;
}

/**
 * Two-tier sidebar component with independent navigation levels.
 * Responsive: Shows Sheet drawer on mobile, static sidebar on desktop.
 *
 * - **Icon Rail (Tier 1)**: Primary sections displayed as icons (64px)
 * - **Primary Sidebar (Tier 2)**: Context-sensitive sub-navigation (224px)
 */
export function Sidebar({
  sections,
  getSecondaryNav,
  pathname,
  quickActions = [],
  orgInfo,
  brandName = "Loom Loyalty",
  logo,
  LinkComponent = "a" as unknown as React.ComponentType<LinkComponentProps>,
  onNavigate,
  extras,
  footer,
}: SidebarProps) {
  const isMobile = useIsMobile();
  const sidebar = useSidebarOptional();
  const Link = LinkComponent;

  const handleClick = (href: string, e?: React.MouseEvent) => {
    if (onNavigate) {
      e?.preventDefault();
      onNavigate(href);
    }
    // Close sidebar on mobile after navigation
    if (isMobile && sidebar) {
      sidebar.setIsOpen(false);
    }
  };

  // Determine active section from pathname
  const activeSectionId = getActiveSectionId(sections, pathname, getSecondaryNav);
  const activeSectionLabel = sections.find((s) => s.id === activeSectionId)?.label;

  // Get secondary nav content for active section
  const secondaryContent = activeSectionId ? getSecondaryNav(activeSectionId, pathname) : [];

  // The actual sidebar content - extracted for reuse between desktop and mobile.
  // Wrap once in TooltipProvider so the per-Tooltip auto-wrap inside the
  // primitive becomes a no-op (sentinel context skips it).
  const sidebarContent = (
    <TooltipProvider>
      <div className={cn("flex h-full", isMobile && "w-full")}>
        {/* Icon Rail - Tier 1 (Primary Sections) */}
        <aside
          className="from-sidebar-rail-from to-sidebar-rail-to flex w-16 flex-col bg-gradient-to-b"
          aria-label="Primary navigation"
        >
          {/* Logo Icon — links to dashboard root. 44x44 hit area, 40x40 visual pill. */}
          <div className="flex h-16 items-center justify-center border-b border-white/10">
            <Link
              href="/"
              aria-label="Return to dashboard"
              className="group flex h-11 w-11 cursor-pointer items-center justify-center rounded-lg"
              onClick={(e: React.MouseEvent) => handleClick("/", e)}
            >
              <span className="bg-background flex h-10 w-10 items-center justify-center rounded-lg shadow-lg transition-shadow group-hover:shadow-xl">
                {logo ?? <LoomIcon className="h-10 w-10" />}
              </span>
            </Link>
          </div>

          {/* Section Icons */}
          <nav className="flex flex-1 flex-col items-center gap-2 py-4">
            {sections.map((section) => {
              const isActive = section.id === activeSectionId;
              const Icon = section.icon;
              return (
                <Link
                  key={section.id}
                  href={section.href}
                  className={cn(
                    "flex size-11 items-center justify-center rounded-lg transition-all",
                    isActive
                      ? "bg-primary text-white shadow-md"
                      : "text-white/50 hover:bg-white/10 hover:text-white",
                    section.disabled && "pointer-events-none opacity-50"
                  )}
                  title={section.label}
                  onClick={(e: React.MouseEvent) => handleClick(section.href, e)}
                >
                  <Icon className="h-5 w-5" aria-hidden="true" />
                  <span className="sr-only">{section.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Quick Actions at Bottom */}
          {quickActions.length > 0 && (
            <div className="flex flex-col items-center gap-2 border-t border-white/10 py-4">
              {quickActions.map((action) => {
                const Icon = action.icon;
                const iconClasses =
                  "flex size-11 items-center justify-center rounded-lg text-white/50 transition-all hover:bg-white/10 hover:text-white";
                if (action.href && action.external) {
                  return (
                    <Tooltip key={action.label}>
                      <TooltipTrigger asChild>
                        <a
                          href={action.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`${action.label} (opens in new tab)`}
                          className={cn(iconClasses, "relative")}
                        >
                          <Icon className="h-5 w-5" aria-hidden="true" />
                          <ExternalLink
                            className="absolute right-1 bottom-1 h-2.5 w-2.5 opacity-60"
                            aria-hidden="true"
                          />
                        </a>
                      </TooltipTrigger>
                      <TooltipContent>{action.label}</TooltipContent>
                    </Tooltip>
                  );
                }
                return action.href ? (
                  <Tooltip key={action.label}>
                    <TooltipTrigger asChild>
                      <Link
                        href={action.href}
                        aria-label={action.label}
                        className={iconClasses}
                        onClick={(e: React.MouseEvent) => handleClick(action.href!, e)}
                      >
                        <Icon className="h-5 w-5" aria-hidden="true" />
                      </Link>
                    </TooltipTrigger>
                    <TooltipContent>{action.label}</TooltipContent>
                  </Tooltip>
                ) : (
                  <Tooltip key={action.label}>
                    <TooltipTrigger asChild>
                      <button
                        onClick={action.onClick}
                        className={iconClasses}
                        aria-label={action.label}
                      >
                        <Icon className="h-5 w-5" aria-hidden="true" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>{action.label}</TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          )}
        </aside>

        {/* Primary Sidebar - Tier 2 (Secondary Navigation) */}
        <aside
          className={cn(
            "from-sidebar-main-from to-sidebar-main-to flex flex-col bg-gradient-to-b",
            isMobile ? "flex-1" : "w-60"
          )}
          aria-label="Secondary navigation"
        >
          {/* Brand Name with close button on mobile */}
          <div className="flex h-16 items-center justify-between border-b border-white/10 px-5">
            <span className="text-lg font-semibold tracking-tight text-white">
              {activeSectionLabel ?? brandName}
            </span>
            {isMobile && sidebar && (
              <button
                onClick={() => sidebar.setIsOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-white/70 transition-colors hover:bg-white/10 hover:text-white"
                aria-label="Close navigation menu"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            )}
          </div>

          {/* Secondary Navigation Content */}
          <nav className="flex flex-1 flex-col gap-4 overflow-y-auto p-3">
            {secondaryContent.map((group, groupIdx) => (
              <div key={groupIdx} className="flex flex-col gap-1">
                {group.header && (
                  <h3 className="px-3 py-2 text-xs font-semibold tracking-wider text-white/80 uppercase">
                    {group.header}
                  </h3>
                )}
                <div className="flex flex-col gap-1">
                  {group.items.map((item) => (
                    <SecondaryNavLink
                      key={item.href}
                      item={item}
                      isActive={pathname === item.href}
                      Link={Link}
                      onNavigate={handleClick}
                    />
                  ))}
                </div>
              </div>
            ))}
          </nav>

          {/* Optional extras slot (e.g. recently-viewed rail) */}
          {extras}

          {/* Footer: a custom status widget, else the org info card */}
          {footer !== undefined
            ? footer
            : orgInfo && (
                <SidebarFooterSection>
                  <SidebarOrgInfoCard orgInfo={orgInfo} />
                </SidebarFooterSection>
              )}
        </aside>
      </div>
    </TooltipProvider>
  );

  // Mobile with provider: render in Sheet (full-screen)
  if (isMobile && sidebar) {
    return (
      <Sheet open={sidebar.isOpen} onOpenChange={sidebar.setIsOpen}>
        <SheetContent side="fullscreen" className="p-0" hideCloseButton>
          {sidebarContent}
        </SheetContent>
      </Sheet>
    );
  }

  // Desktop or mobile without provider: render static sidebar
  return sidebarContent;
}

/**
 * Org plan and usage card shown at the foot of the secondary sidebar.
 */
/** The bordered area at the foot of the secondary sidebar; wrap a custom `footer` in it. */
export function SidebarFooterSection({ children }: { children: React.ReactNode }) {
  return <div className="border-t border-white/10 p-4">{children}</div>;
}

export function SidebarOrgInfoCard({ orgInfo }: { orgInfo: OrgInfo }) {
  const percent = Math.min(100, Math.max(0, orgInfo.usagePercent));
  return (
    <div className="bg-primary/40 rounded-lg p-3">
      <p className="text-xs font-medium text-white/90">{orgInfo.planName}</p>
      <p className="text-xs text-white/80">{orgInfo.usageLabel}</p>
      <div
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Plan usage"
        className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/20"
      >
        <div
          className="bg-accent h-full rounded-full transition-all"
          style={{ width: `${percent}%` }}
        />
      </div>
      {orgInfo.limitLabel && <p className="mt-1 text-xs text-white/80">{orgInfo.limitLabel}</p>}
    </div>
  );
}

/**
 * Secondary navigation link component
 */
interface SecondaryNavLinkProps {
  item: SecondaryNavItem;
  isActive: boolean;
  Link: React.ComponentType<LinkComponentProps>;
  onNavigate: (href: string, e?: React.MouseEvent) => void;
}

function SecondaryNavLink({ item, isActive, Link, onNavigate }: SecondaryNavLinkProps) {
  const handleClick = (e: React.MouseEvent) => {
    onNavigate(item.href, e);
  };

  const Icon = item.icon;

  const className = cn(
    "flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-all",
    isActive
      ? "bg-primary text-white shadow-md"
      : "hover:bg-primary/50 text-white/80 hover:text-white",
    item.disabled && "pointer-events-none opacity-50"
  );

  const content = (
    <>
      {Icon && <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />}
      <span className={cn(!Icon && "pl-8")}>{item.label}</span>
      {item.external && (
        <ExternalLink className="ml-auto h-3.5 w-3.5 opacity-60" aria-hidden="true" />
      )}
      {!item.external && item.badge !== undefined && (
        <span
          className="ml-auto rounded-full bg-white/20 px-2 py-0.5 text-xs"
          aria-label={`${item.badge} items`}
        >
          {item.badge}
        </span>
      )}
    </>
  );

  if (item.external) {
    return (
      <a href={item.href} target="_blank" rel="noopener noreferrer" className={className}>
        {content}
      </a>
    );
  }

  return (
    <Link href={item.href} className={className} onClick={handleClick}>
      {content}
    </Link>
  );
}
