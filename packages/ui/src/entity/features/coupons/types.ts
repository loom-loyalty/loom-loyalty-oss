/**
 * Coupon Feature Types
 *
 * Centralized type definitions for the coupons feature.
 * Keeps types in a dedicated file per CLAUDE.md guidelines.
 */

import type { UIEntitySchema } from "@loom-loyalty/schema";
import type { FormFieldError } from "../../../forms/field-errors.js";
import type { FormSheetError } from "../../../forms/form-sheet.js";

/**
 * View-model for coupon form. Mapped from SDK Coupon/CreateCoupon at the call site.
 */
export interface CouponFormData {
  code: string;
  name?: string;
  offerId: string;
  status: string;
  maxRedemptions?: number;
  /** The discount amount or percentage value */
  discountValue?: number;
  /** The currency type for the discount value */
  discountCurrencyTypeCode?: string;
  startDateTime?: string;
  endDateTime?: string;
  properties?: Record<string, unknown>;
  /** Extended field values from data model extensions */
  extendedFields?: Record<string, unknown>;
}

/**
 * Props for the CouponFormSheet component.
 */
export interface CouponFormSheetProps {
  /** Whether the sheet is open */
  open: boolean;
  /** Callback when open state changes */
  onOpenChange: (open: boolean) => void;
  /** Mode: create or edit */
  mode: "create" | "edit";
  /** Initial data for editing or pre-filling create forms */
  initialData?: Partial<CouponFormData>;
  /** Submit handler */
  onSubmit: (data: CouponFormData) => Promise<void>;
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
 * Props for the CouponDetail component.
 */
export interface CouponDetailProps {
  /** View-model for coupon display. Mapped from SDK Coupon via adaptCouponToRow(). */
  coupon: {
    id: string;
    code: string;
    name?: string;
    offerId?: string;
    offerName?: string;
    status: string;
    maxRedemptions?: number;
    currentRedemptions?: number;
    startDateTime?: string;
    endDateTime?: string;
    createdDateTime?: string;
    updatedDateTime?: string;
    [key: string]: unknown;
  };
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
}

/**
 * Filter state for the coupons list.
 */
export interface CouponListFilters {
  search: string;
  status?: string;
  offerId?: string;
}

/**
 * Standard coupon fields - these have rich UI components
 */
export const COUPON_STANDARD_FIELDS = [
  "id",
  "code",
  "name",
  "offerId",
  "status",
  "maxRedemptions",
  "currentRedemptions",
  "startDateTime",
  "endDateTime",
  "createdDateTime",
  "updatedDateTime",
] as const;
