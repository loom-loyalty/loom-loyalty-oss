/**
 * Offer Feature Types
 *
 * Centralized type definitions for the offers feature.
 * Keeps types in a dedicated file per CLAUDE.md guidelines.
 */

import type { UIEntitySchema } from "@loom-loyalty/schema";
import type { CreateOffer, Offer, UpdateOffer } from "@loom-loyalty/sdk";
import type { ReactNode } from "react";
import type { PaginationConfig } from "../../../data-display/data-table.js";
import type { FormFieldError } from "../../../forms/field-errors.js";
import type { FormSheetError } from "../../../forms/form-sheet.js";
import type { LocalizedString } from "../../../forms/localized-string-input.js";
import type { CouponDetailProps } from "../coupons/types.js";

export type { LocalizedString };

/**
 * Row type for coupon sub-table in offer detail
 */
export type CouponRow = CouponDetailProps["coupon"];

/**
 * Offer record type used in the list page and detail views
 */
export type OfferRecord = Offer;

/**
 * Form data for offer creation/editing.
 * Represents the shape of data submitted by the form.
 */
export interface OfferFormData {
  name: string;
  code: string;
  type: "COUPON" | "EXTERNAL";
  programIds: string[];
  /** Target customer audience for this offer */
  customerAudienceId?: string;
  description?: LocalizedString;
  durationPeriod?: {
    durationPeriod?: string;
    durationPeriodType?: string;
    durationPeriodValue?: number;
    fixedDurationDateTimePeriod?: {
      startDateTime?: string;
      endDateTime?: string;
    };
    timeZone?: string;
  };
  maxOfferUses?: number;
  maxOfferRedemptions?: number;
  /** Maximum discount value for COUPON. 0 or blank means no discount cap. */
  maxDiscountValue?: number;
  setDateTimePeriodOnIssue?: boolean;
  /** Extended field values from data model extensions */
  extendedFields?: Record<string, unknown>;
}

/**
 * Props for the OfferFormSheet component.
 */
export interface OfferFormSheetProps {
  /** Whether the sheet is open */
  open: boolean;
  /** Callback when open state changes */
  onOpenChange: (open: boolean) => void;
  /** Mode: create or edit */
  mode: "create" | "edit";
  /** Initial data for editing (required for edit mode). May include coupon-specific fields like maxDiscountValue. */
  initialData?: Offer & { maxDiscountValue?: number };
  /** Submit handler */
  onSubmit: (data: CreateOffer | UpdateOffer) => Promise<void>;
  /** Whether the form is submitting */
  isSubmitting?: boolean;
  /** Error to display; a `describeError` result also shows its support reference */
  error?: FormSheetError | null;
  /** Server field errors; each shows under its field, the rest with `error` */
  fieldErrors?: readonly FormFieldError[];
  /** Schema for rendering extended fields (optional) */
  schema?: UIEntitySchema;
  /** Extended field names to render (beyond standard fields) */
  extendedFields?: string[];
}

/**
 * Props for the OfferDetail component.
 */
export interface OfferDetailProps {
  /** Offer to display */
  offer: OfferRecord;
  /** Edit click handler */
  onEdit?: () => void;
  /** Delete click handler */
  onDelete?: () => void;
  /** Whether editing is enabled */
  canEdit?: boolean;
  /** Whether deletion is enabled */
  canDelete?: boolean;
  /** Schema for rendering extended fields (optional) */
  schema?: UIEntitySchema;
  /** Extended field names to render (beyond standard fields) */
  extendedFields?: string[];
  /** Coupon sub-resource data (type=COUPON only) */
  coupons?: CouponRow[];
  /** Whether coupons are loading */
  couponsLoading?: boolean;
  /** Server paging for the coupon table; without it the table shows `coupons` unpaged. */
  couponsPagination?: PaginationConfig;
  /** Handler to create a new coupon */
  onCreateCoupon?: () => void;
  /** Handler to edit a coupon */
  onEditCoupon?: (coupon: CouponRow) => void;
  /** Handler to delete a coupon */
  onDeleteCoupon?: (coupon: CouponRow) => void;
  /** External offer configuration (type=EXTERNAL only) */
  externalOfferConfig?: Record<string, unknown>;
  /** Replaces the external configuration block for an offer a partner fulfils (OfferPartnerSource). */
  partnerSection?: ReactNode;
}

/**
 * Filter state for the offers list.
 */
export interface OfferListFilters {
  search: string;
  typeFilter: string | null;
  statusFilter: string | null;
}

/**
 * Standard offer fields - these have rich UI components
 */
export const OFFER_STANDARD_FIELDS = [
  "name",
  "code",
  "type",
  "description",
  "offerId",
  "programIds",
  "durationPeriod",
  "maxOfferUses",
  "maxOfferRedemptions",
  "maxDiscountValue",
  "setDateTimePeriodOnIssue",
  "customerAudience",
  "enabledInEnvironments",
  "createdDateTime",
  "modifiedDateTime",
] as const;
