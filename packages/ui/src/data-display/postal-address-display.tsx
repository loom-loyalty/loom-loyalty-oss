"use client";

/**
 * PostalAddressDisplay — Formatted postal address block
 *
 * Renders a multi-line postal address in a readable block format.
 * Reusable across customer addresses, locations, and any entity with address data.
 */

import type { ReactNode } from "react";

import { cn } from "../lib/utils";

export interface PostalAddressDisplayProps {
  /** Address data to display */
  address: {
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    stateProvince?: string;
    postalCode?: string;
    countryCode?: string;
  };
  /** Additional CSS classes */
  className?: string;
}

/**
 * Formats a postal address into a readable multi-line block.
 */
export function PostalAddressDisplay({ address, className }: PostalAddressDisplayProps): ReactNode {
  const { addressLine1, addressLine2, city, stateProvince, postalCode, countryCode } = address;

  // Build city/state/postal line: "City, State PostalCode"
  const cityStateLine = [[city, stateProvince].filter(Boolean).join(", "), postalCode]
    .filter(Boolean)
    .join(" ");

  const hasContent = addressLine1 || addressLine2 || cityStateLine || countryCode;

  if (!hasContent) {
    return (
      <address className={cn("text-muted-foreground text-sm not-italic", className)}>
        No address provided
      </address>
    );
  }

  return (
    <address className={cn("text-foreground text-sm leading-relaxed not-italic", className)}>
      {addressLine1 && <span className="block">{addressLine1}</span>}
      {addressLine2 && <span className="block">{addressLine2}</span>}
      {cityStateLine && <span className="block">{cityStateLine}</span>}
      {countryCode && <span className="block">{countryCode}</span>}
    </address>
  );
}
