/**
 * Customer Header
 *
 * Fixed header for the Customer View. Layout cells:
 * [Back?] [Avatar + Identity] [Currency Balances] [Actions]
 *
 * When `onBack` is provided, a back-navigation button is prepended.
 * Shows identity, tier, primary contact, and currency balances at a glance.
 * Isolated from content to prevent re-renders.
 */

"use client";

import {
  ArrowLeft,
  Copy,
  Mail,
  MoreHorizontal,
  Pencil,
  Phone,
  type LucideIcon,
} from "lucide-react";
import { Fragment, useState, type ReactNode } from "react";

import { StatusBadge } from "../../..";
import { TierBadge } from "../../../data-display/tier-badge";
import { cn } from "../../../lib/utils";
import { Avatar, AvatarFallback } from "../../../primitives/avatar";
import { Badge } from "../../../primitives/badge";
import { Button } from "../../../primitives/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../../primitives/dropdown-menu";

import {
  formatCurrencyValue,
  getActiveTier,
  getCustomerInitials,
  getCustomerName,
  getPrimaryEmail,
  getPrimaryPhone,
  type CustomerData,
} from "./types";

export interface CustomerHeaderProps {
  /** Full customer data */
  data: CustomerData;
  /** Callback when edit is requested */
  onEdit?: () => void;
  /** Callback to navigate back to the list */
  onBack?: () => void;
  /** Callback to navigate to a specific tab/section */
  onNavigate?: (section: string) => void;
  /** Optional actions menu items */
  actions?: Array<{
    label: string;
    icon?: LucideIcon;
    onClick: () => void;
    variant?: "default" | "destructive";
  }>;
  /** Additional className */
  className?: string;
  /** Optional slot for variant-specific content (e.g., tab bar) */
  children?: ReactNode;
}

/**
 * Fixed header for the Customer 360 View.
 *
 * Layout: [Back?] [Avatar + Identity] [Currency Balances] [Actions]
 *
 * Shared across all 3 design variants. The header stays fixed at the top
 * while content scrolls beneath it.
 */
export function CustomerHeader({
  data,
  onEdit,
  onBack,
  onNavigate,
  actions,
  className,
  children,
}: CustomerHeaderProps) {
  const [copiedId, setCopiedId] = useState(false);
  const name = getCustomerName(data.customer);
  const initials = getCustomerInitials(data.customer);
  const email = getPrimaryEmail(data.emails);
  const phone = getPrimaryPhone(data.phones);
  const activeTier = getActiveTier(data.tiers);
  const activeBadges = data.badges.filter((b) => b.active && !b.cancelled);

  const handleCopyId = () => {
    void navigator.clipboard.writeText(data.customer.customerId);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  return (
    <header className={cn("bg-card border-border sticky top-0 z-10 border-b", className)}>
      {/* Main header row */}
      <div className="flex items-start gap-6 p-4">
        {/* Back button — inline with the header row */}
        {onBack && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            className="mt-2 min-h-11 min-w-11 shrink-0"
            aria-label="Back to list"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
        )}
        {/* Cell 1: Identity */}
        <div className="flex min-w-0 flex-1 items-start gap-4">
          <Avatar className="h-14 w-14 shrink-0">
            <AvatarFallback className="from-primary to-primary-dark bg-gradient-to-br text-lg font-semibold text-white">
              {initials}
            </AvatarFallback>
          </Avatar>

          <div className="min-w-0 space-y-1.5">
            {/* Name + badges row */}
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-foreground truncate text-xl font-semibold">{name}</h1>
              <StatusBadge status={data.customer.statusName} />
              {activeTier && <TierBadge tier={activeTier.tierName} />}
              {activeBadges.length > 0 && (
                <Badge variant="outline" className="text-muted-foreground text-xs">
                  {activeBadges.length} {activeBadges.length === 1 ? "badge" : "badges"}
                </Badge>
              )}
            </div>

            {/* Customer ID — absent on a merge preview, whose ID does not exist yet */}
            {data.customer.customerId && (
              <div className="flex items-center gap-1.5">
                <span className="text-muted-foreground font-mono text-xs">
                  {data.customer.customerId}
                </span>
                <button
                  onClick={handleCopyId}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="Copy customer ID"
                >
                  <Copy className="h-3 w-3" />
                </button>
                {copiedId && (
                  <span className="text-success-dark text-xs" role="status">
                    Copied
                  </span>
                )}
              </div>
            )}

            {/* Contact quick-access */}
            <div className="text-muted-foreground flex flex-wrap items-center gap-3 text-sm">
              {email && (
                <span className="inline-flex items-center gap-1">
                  <Mail className="h-3.5 w-3.5" aria-hidden="true" />
                  <span className="truncate">{email.emailAddress}</span>
                  {!email.verified && (
                    <span className="text-accent-darker text-xs">(unverified)</span>
                  )}
                </span>
              )}
              {phone && (
                <span className="inline-flex items-center gap-1">
                  <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{phone.number}</span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Cell 2: Currency balances (clickable to navigate to Ledger) */}
        <div className="hidden gap-3 lg:flex">
          {data.currencies.slice(0, 3).map((currency) => (
            <button
              key={currency.currencyCode}
              onClick={() => onNavigate?.("ledger")}
              className="bg-muted/50 hover:bg-muted rounded-lg px-4 py-2.5 text-left transition-colors"
              aria-label={`${currency.currencyName}: ${formatCurrencyValue(
                currency.available,
                currency.decimalPlaces,
                currency.symbol
              )} available. Click to view ledger.`}
            >
              <p className="text-foreground text-lg font-semibold tabular-nums">
                {formatCurrencyValue(currency.available, currency.decimalPlaces, currency.symbol)}
              </p>
              <p className="text-muted-foreground text-xs">{currency.currencyName}</p>
              {currency.pending > 0 && (
                <p className="text-accent-darker mt-0.5 text-xs">
                  +{formatCurrencyValue(currency.pending, currency.decimalPlaces, currency.symbol)}{" "}
                  pending
                </p>
              )}
            </button>
          ))}
        </div>

        {/* Cell 3: Actions */}
        <div className="flex shrink-0 items-center gap-2">
          {onEdit && (
            <Button variant="outline" size="sm" onClick={onEdit} className="gap-1.5">
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </Button>
          )}
          {actions && actions.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" aria-label="More actions">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {actions.map((action, i) => (
                  <Fragment key={action.label}>
                    {i > 0 && action.variant === "destructive" && <DropdownMenuSeparator />}
                    <DropdownMenuItem
                      onClick={action.onClick}
                      className={action.variant === "destructive" ? "text-destructive" : undefined}
                    >
                      {action.icon && <action.icon className="mr-2 h-4 w-4" />}
                      {action.label}
                    </DropdownMenuItem>
                  </Fragment>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* Slot for variant-specific content (tabs, breadcrumbs, etc.) */}
      {children}
    </header>
  );
}
