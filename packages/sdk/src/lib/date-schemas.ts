/**
 * Date Validation Schemas
 *
 * Zod schemas for validating date inputs in API requests
 * Inlined from dashboard to avoid external dependencies
 */

import { isValid, parseISO } from "date-fns";
import { z } from "zod";

/**
 * Schema for validating optional ISO date strings (YYYY-MM-DD)
 */
export const optionalISODateSchema = z
  .string()
  .optional()
  .refine(
    (val) => {
      if (!val) return true;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(val)) return false;
      try {
        const date = parseISO(val);
        return isValid(date);
      } catch {
        return false;
      }
    },
    {
      message: "Invalid date format (YYYY-MM-DD)",
    }
  );

/**
 * Schema for validating required ISO date strings (YYYY-MM-DD)
 */
export const isoDateSchema = z
  .string()
  .min(1, "Date is required")
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format")
  .refine(
    (val) => {
      try {
        const date = parseISO(val);
        return isValid(date);
      } catch {
        return false;
      }
    },
    {
      message: "Invalid date",
    }
  );
