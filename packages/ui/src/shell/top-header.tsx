"use client";

import { Bell, ChevronDown, HelpCircle, Menu, Search, X } from "lucide-react";
import * as React from "react";

import { useIsMobile } from "../hooks/use-mobile";
import { cn } from "../lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "../primitives/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../primitives/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "../primitives/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../primitives/tooltip";
import { useSidebarOptional } from "./sidebar-context";
import type { UserInfo } from "./types";

export interface TopHeaderProps {
  /** Current user info */
  user?: UserInfo;
  /** Search placeholder text */
  searchPlaceholder?: string;
  /** Whether to show search input */
  showSearch?: boolean;
  /** Whether to show notifications */
  showNotifications?: boolean;
  /** Number of unread notifications */
  notificationCount?: number;
  /** Whether to show the help/AI chat trigger button */
  showHelp?: boolean;
  /** Callback when help button is clicked (typically opens the AI chat panel) */
  onHelpClick?: () => void;
  /** aria-label and tooltip text for the help button */
  helpLabel?: string;
  /** When set, renders the help control as an external link instead of a button */
  helpHref?: string;
  /** Custom actions to render in header */
  actions?: React.ReactNode;
  /** Callback when search value changes */
  onSearchChange?: (value: string) => void;
  /** Callback when search is submitted (for mobile) */
  onSearchSubmit?: (value: string) => void;
  /**
   * When provided, the search input renders as a button-styled trigger that
   * invokes `onSearchClick` instead of accepting text inline. The mobile
   * search icon also routes here. Use for palette-driven search (Cmd+K).
   */
  onSearchClick?: () => void;
  /** Shortcut affordance shown inside the trigger (e.g. "⌘K" or "Ctrl+K"). */
  searchShortcutHint?: string;
  /** Callback when notification bell is clicked */
  onNotificationsClick?: () => void;
  /**
   * The inbox shown in a popover under the bell. When set, the bell opens it;
   * a function receives `close` so choosing an item can dismiss the popover.
   */
  notificationsPanel?: React.ReactNode | ((close: () => void) => React.ReactNode);
  /** Called when the notifications popover opens or closes. */
  onNotificationsOpenChange?: (open: boolean) => void;
  /** User menu items */
  userMenuItems?: Array<{
    label: string;
    onClick?: () => void;
    href?: string;
    variant?: "default" | "destructive";
  }>;
  /** Callback when user signs out */
  onSignOut?: () => void;
  className?: string;
}

/**
 * Top header component with search, notifications, and user menu.
 * Responsive: Shows hamburger menu on mobile, full search on desktop.
 */
export function TopHeader({
  user,
  searchPlaceholder = "Search...",
  showSearch = true,
  showNotifications = true,
  notificationCount = 0,
  showHelp = false,
  onHelpClick,
  helpLabel = "Ask AI for help",
  helpHref,
  actions,
  onSearchChange,
  onSearchSubmit,
  onSearchClick,
  searchShortcutHint,
  onNotificationsClick,
  notificationsPanel,
  onNotificationsOpenChange,
  userMenuItems = [],
  onSignOut,
  className,
}: TopHeaderProps) {
  const isMobile = useIsMobile();
  const sidebar = useSidebarOptional();
  const [searchValue, setSearchValue] = React.useState("");
  const [isMobileSearchOpen, setIsMobileSearchOpen] = React.useState(false);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchValue(value);
    onSearchChange?.(value);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearchSubmit?.(searchValue);
    if (isMobile) {
      setIsMobileSearchOpen(false);
    }
  };

  const handleMobileSearchToggle = () => {
    setIsMobileSearchOpen((prev) => !prev);
  };

  const defaultMenuItems: TopHeaderProps["userMenuItems"] = [
    { label: "Profile", onClick: () => {} },
    { label: "Settings", onClick: () => {} },
  ];

  const menuItems = userMenuItems.length > 0 ? userMenuItems : defaultMenuItems;

  // Hoisted icon-button labels so each Tooltip's aria-label and visible
  // content read from one source of truth. The user-menu label is computed
  // inside its `{user && ...}` branch below so it never falls back to "".
  const closeSearchLabel = "Close search";
  const hamburgerLabel = "Open navigation menu";
  const searchLabel = "Open search";
  const [notificationsOpen, setNotificationsOpen] = React.useState(false);
  const [bellTooltipOpen, setBellTooltipOpen] = React.useState(false);
  const handleNotificationsOpenChange = (open: boolean) => {
    setNotificationsOpen(open);
    onNotificationsOpenChange?.(open);
  };

  const notificationsLabel =
    notificationCount > 0 ? `Notifications, ${notificationCount} unread` : "Notifications";
  const bellButton = (
    <button
      onClick={onNotificationsClick}
      className="text-chrome-muted-foreground focus-visible:ring-ring hover:bg-foreground/5 hover:text-foreground relative flex h-11 w-11 items-center justify-center rounded-md transition-colors focus-visible:ring-2 focus-visible:outline-none"
      aria-label={notificationsLabel}
    >
      <Bell className="h-5 w-5" aria-hidden="true" />
      {notificationCount > 0 && (
        <span className="absolute top-1.5 right-1.5 flex h-2 w-2" aria-hidden="true">
          <span className="bg-accent absolute inline-flex h-full w-full rounded-full opacity-75 motion-safe:animate-ping" />
          <span className="bg-accent relative inline-flex h-2 w-2 rounded-full" />
        </span>
      )}
    </button>
  );

  // Mobile search overlay
  if (isMobile && isMobileSearchOpen) {
    return (
      <header
        className={cn(
          "border-chrome-border bg-chrome text-chrome-foreground relative flex h-16 items-center gap-2 border-b px-4",
          className
        )}
      >
        <form onSubmit={handleSearchSubmit} className="flex flex-1 items-center gap-2">
          <div className="relative flex-1">
            <label htmlFor="mobile-search" className="sr-only">
              Search
            </label>
            <Search
              className="text-chrome-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2"
              aria-hidden="true"
            />
            <input
              id="mobile-search"
              type="search"
              placeholder={searchPlaceholder}
              value={searchValue}
              onChange={handleSearchChange}
              autoFocus
              className="text-foreground placeholder:text-muted-foreground focus:ring-ring border-border bg-card h-10 w-full rounded-md border pr-3 pl-9 text-sm focus:ring-2 focus:outline-none"
            />
          </div>
          {/* Mobile-only context — no Tooltip wrap. Tooltips fire on touch
              tap and flash the tip momentarily; aria-label still names the
              button for screen readers. */}
          <button
            type="button"
            onClick={handleMobileSearchToggle}
            className="text-chrome-muted-foreground focus-visible:ring-ring hover:text-foreground flex h-11 w-11 shrink-0 items-center justify-center rounded-md transition-colors focus-visible:ring-2 focus-visible:outline-none"
            aria-label={closeSearchLabel}
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </form>
      </header>
    );
  }

  return (
    <TooltipProvider>
      <header
        className={cn(
          "border-chrome-border bg-chrome text-chrome-foreground relative flex h-16 items-center justify-between border-b px-4 lg:px-6",
          className
        )}
      >
        {/* Short divider where the header meets the sidebar; intentionally not full height. */}
        <span
          aria-hidden="true"
          className="bg-border pointer-events-none absolute top-4 bottom-4 left-0 w-px"
        />

        {/* Left side - Hamburger + Search */}
        <div className="flex items-center gap-2 lg:gap-4">
          {/* Mobile hamburger — mobile-only, no Tooltip (touch-tap flash). */}
          {isMobile && sidebar && (
            <button
              onClick={sidebar.toggle}
              className="text-chrome-muted-foreground focus-visible:ring-ring hover:bg-foreground/5 hover:text-foreground flex h-11 w-11 items-center justify-center rounded-md transition-colors focus-visible:ring-2 focus-visible:outline-none lg:hidden"
              aria-label={hamburgerLabel}
              aria-expanded={sidebar.isOpen}
            >
              <Menu className="h-5 w-5" aria-hidden="true" />
            </button>
          )}

          {/* Desktop search */}
          {showSearch &&
            !isMobile &&
            (onSearchClick ? (
              <button
                type="button"
                onClick={onSearchClick}
                aria-label={searchLabel}
                aria-haspopup="dialog"
                className="text-chrome-muted-foreground focus-visible:ring-ring border-border bg-card hover:bg-background flex h-11 w-64 items-center gap-2 rounded-md border pr-2 pl-3 text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none"
              >
                <Search className="h-4 w-4" aria-hidden="true" />
                <span className="text-muted-foreground/80 flex-1 truncate text-left">
                  {searchPlaceholder}
                </span>
                {searchShortcutHint && (
                  <kbd
                    aria-hidden="true"
                    className="border-border bg-muted text-chrome-muted-foreground rounded border px-1.5 py-0.5 font-mono text-[10px]"
                  >
                    {searchShortcutHint}
                  </kbd>
                )}
              </button>
            ) : (
              <div className="relative">
                <label htmlFor="desktop-search" className="sr-only">
                  Search
                </label>
                <Search
                  className="text-chrome-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2"
                  aria-hidden="true"
                />
                <input
                  id="desktop-search"
                  type="search"
                  placeholder={searchPlaceholder}
                  value={searchValue}
                  onChange={handleSearchChange}
                  className="text-foreground placeholder:text-muted-foreground focus:ring-ring border-border bg-card h-9 w-64 rounded-md border pr-3 pl-9 text-sm focus:ring-2 focus:outline-none"
                />
              </div>
            ))}

          {/* Mobile search button — mobile-only, no Tooltip (touch-tap flash). */}
          {showSearch && isMobile && (
            <button
              type="button"
              onClick={onSearchClick ?? handleMobileSearchToggle}
              className="text-chrome-muted-foreground focus-visible:ring-ring hover:bg-foreground/5 hover:text-foreground flex h-11 w-11 items-center justify-center rounded-md transition-colors focus-visible:ring-2 focus-visible:outline-none"
              aria-label={searchLabel}
              aria-haspopup={onSearchClick ? "dialog" : undefined}
            >
              <Search className="h-5 w-5" aria-hidden="true" />
            </button>
          )}
        </div>

        {/* Right side - Actions, Notifications & User */}
        <div className="flex items-center gap-2 lg:gap-4">
          {actions}
          {showNotifications &&
            (notificationsPanel === undefined ? (
              <Tooltip>
                <TooltipTrigger asChild>{bellButton}</TooltipTrigger>
                <TooltipContent>{notificationsLabel}</TooltipContent>
              </Tooltip>
            ) : (
              <Popover open={notificationsOpen} onOpenChange={handleNotificationsOpenChange}>
                {/* The tooltip stays shut while the popover is open so it never covers the panel. */}
                <Tooltip
                  open={bellTooltipOpen && !notificationsOpen}
                  onOpenChange={setBellTooltipOpen}
                >
                  <TooltipTrigger asChild>
                    <PopoverTrigger asChild>{bellButton}</PopoverTrigger>
                  </TooltipTrigger>
                  <TooltipContent>{notificationsLabel}</TooltipContent>
                </Tooltip>
                <PopoverContent
                  aria-label="Notifications"
                  align="end"
                  className="w-[min(24rem,calc(100vw-2rem))] p-0"
                >
                  {typeof notificationsPanel === "function"
                    ? notificationsPanel(() => handleNotificationsOpenChange(false))
                    : notificationsPanel}
                </PopoverContent>
              </Popover>
            ))}

          {showHelp && (
            <Tooltip>
              <TooltipTrigger asChild>
                {helpHref ? (
                  <a
                    href={helpHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Help documentation (opens in new tab)"
                    className="text-chrome-muted-foreground focus-visible:ring-ring hover:bg-foreground/5 hover:text-foreground relative flex h-11 w-11 items-center justify-center rounded-md transition-colors focus-visible:ring-2 focus-visible:outline-none"
                  >
                    <HelpCircle className="h-5 w-5" aria-hidden="true" />
                  </a>
                ) : (
                  <button
                    type="button"
                    onClick={onHelpClick}
                    className="text-chrome-muted-foreground focus-visible:ring-ring hover:bg-foreground/5 hover:text-foreground relative flex h-11 w-11 items-center justify-center rounded-md transition-colors focus-visible:ring-2 focus-visible:outline-none"
                    aria-label={helpLabel}
                  >
                    <HelpCircle className="h-5 w-5" aria-hidden="true" />
                  </button>
                )}
              </TooltipTrigger>
              <TooltipContent>{helpHref ? "Help documentation" : helpLabel}</TooltipContent>
            </Tooltip>
          )}

          {user && (
            <DropdownMenu>
              {/* No Tooltip wrap: the avatar + name is already visible chrome on
                desktop and the aria-label below covers screen reader users.
                Wrapping a DropdownMenuTrigger in Tooltip also fires the tip
                while the menu is open (Radix composition awkwardness). */}
              <DropdownMenuTrigger asChild>
                <button
                  className="focus-visible:ring-ring hover:bg-foreground/5 flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors focus-visible:ring-2 focus-visible:outline-none"
                  aria-label={`User menu for ${user.name}`}
                >
                  <Avatar className="ring-border h-8 w-8 ring-1">
                    {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.name} />}
                    <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                      {user.initials || user.name.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  {/* Hide name on mobile */}
                  <div className="hidden text-left lg:block">
                    <p className="text-foreground text-sm font-medium">{user.name}</p>
                  </div>
                  <ChevronDown
                    className="text-chrome-muted-foreground h-4 w-4"
                    aria-hidden="true"
                  />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium">{user.name}</p>
                    <p className="text-chrome-muted-foreground text-xs">{user.email}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {menuItems.map((item, index) => (
                  <DropdownMenuItem
                    key={`${item.label}-${String(index)}`}
                    onClick={item.onClick}
                    className={cn(item.variant === "destructive" && "text-destructive")}
                  >
                    {item.label}
                  </DropdownMenuItem>
                ))}
                {onSignOut && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={onSignOut} className="text-destructive">
                      Sign out
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </header>
    </TooltipProvider>
  );
}
