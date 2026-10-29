/**
 * Plain-language descriptions of what an offer partner's daily catalog sync
 * changed on a linked offer.
 *
 * The sync applies retirements and paused amounts on its own; copy, image and
 * face-value range changes wait for an admin to accept or dismiss them. The
 * API writes the value maps with numbers as plain strings.
 */
import type {
  OfferPartnerCatalogChange,
  OfferPartnerCatalogChangeStatus,
  OfferPartnerCatalogChangeType,
} from "@loom-loyalty/sdk";

import { formatFaceValue } from "./face-values.js";

/** Changes an admin answers; the others are applied by the sync. */
const REVIEWABLE: ReadonlySet<string> = new Set(["COPY", "IMAGE", "VALUE_RANGE"]);

const TYPE_LABELS: Record<OfferPartnerCatalogChangeType, string> = {
  ITEM_RETIRED: "Retired by the partner",
  ITEM_RESTORED: "Back in the partner's catalog",
  DENOMINATIONS_PAUSED: "Amounts paused",
  COPY: "Name or description updated",
  IMAGE: "Image updated",
  VALUE_RANGE: "Face values changed",
};

const STATUS_LABELS: Record<OfferPartnerCatalogChangeStatus, string> = {
  PENDING: "Waiting for review",
  ACCEPTED: "Accepted",
  DISMISSED: "Dismissed",
  APPLIED: "Applied automatically",
};

/** One line of a change: a field, what it was, and what it is now. */
export interface CatalogChangeLine {
  label: string;
  before: string;
  after: string;
}

/** A catalog change worded for an admin. */
export interface CatalogChangeDescription {
  title: string;
  /** What the change means for members. */
  impact: string;
  lines: CatalogChangeLine[];
  /** Whether an admin can accept or dismiss it now. */
  needsReview: boolean;
  statusLabel: string;
}

/** Whether a change of this type waits for an admin rather than being applied by the sync. */
export function isReviewableChange(type: string | undefined): boolean {
  return type !== undefined && REVIEWABLE.has(type);
}

type Values = Record<string, unknown> | undefined;

function text(values: Values, key: string): string {
  const value = values?.[key];
  if (value === undefined || value === null || value === "") return "—";
  return String(value);
}

function amounts(values: Values, key: string, currency: string): string {
  const list = values?.[key];
  if (!Array.isArray(list) || list.length === 0) return "None";
  return list.map((value) => formatFaceValue(Number(value), currency)).join(", ");
}

function range(values: Values, currency: string): string {
  const fixed = values?.fixedDenominations;
  if (Array.isArray(fixed) && fixed.length > 0)
    return amounts(values, "fixedDenominations", currency);
  const min = values?.minValue;
  const max = values?.maxValue;
  if (min == null && max == null) return "—";
  const bounds = [min, max].map((v) => (v == null ? "…" : formatFaceValue(Number(v), currency)));
  const step = values?.stepValue;
  const stepText = step == null ? "" : ` in ${formatFaceValue(Number(step), currency)} steps`;
  return `${bounds.join("–")}${stepText}`;
}

/** Describes a catalog change for the Changes tab and the offer detail sheet. */
export function describeCatalogChange(
  change: OfferPartnerCatalogChange,
  currency = "USD"
): CatalogChangeDescription {
  const type = change.changeType;
  const previous = change.previousValue as Values;
  const proposed = change.proposedValue as Values;
  const pending = change.status === "PENDING";
  const title = type ? (TYPE_LABELS[type] ?? "Catalog change") : "Catalog change";
  const statusLabel = change.status ? (STATUS_LABELS[change.status] ?? change.status) : "—";

  switch (type) {
    case "ITEM_RETIRED":
      return {
        title,
        impact:
          "Paused automatically. Members can't redeem this offer while the partner has it retired.",
        lines: [],
        needsReview: false,
        statusLabel,
      };
    case "ITEM_RESTORED":
      return {
        title,
        impact: "The offer is back to the status it had before the partner retired it.",
        lines: [{ label: "Status", before: "Retired", after: text(proposed, "status") }],
        needsReview: false,
        statusLabel,
      };
    case "DENOMINATIONS_PAUSED":
      return {
        title,
        impact: `Paused automatically: ${amounts(proposed, "pausedDenominations", currency)}. Members can still redeem the other amounts.`,
        lines: [
          {
            label: "Amounts",
            before: amounts(previous, "activeDenominations", currency),
            after: amounts(proposed, "activeDenominations", currency),
          },
        ],
        needsReview: false,
        statusLabel,
      };
    case "COPY":
      return {
        title,
        impact: pending
          ? "Members see the current name and description until you accept."
          : "The offer's name and description follow this answer.",
        lines: [
          { label: "Name", before: text(previous, "name"), after: text(proposed, "name") },
          {
            label: "Description",
            before: text(previous, "description"),
            after: text(proposed, "description"),
          },
        ],
        needsReview: pending,
        statusLabel,
      };
    case "IMAGE":
      return {
        title,
        impact: pending
          ? "Members see the current image until you accept."
          : "The offer's image follows this answer.",
        lines: [
          { label: "Image", before: text(previous, "imageUrl"), after: text(proposed, "imageUrl") },
        ],
        needsReview: pending,
        statusLabel,
      };
    case "VALUE_RANGE":
      return {
        title,
        impact: pending
          ? "Accepting only clears this notice. Add any new amounts to the offer yourself."
          : "The offer's amounts did not change.",
        lines: [
          {
            label: "Face values",
            before: range(previous, currency),
            after: range(proposed, currency),
          },
        ],
        needsReview: pending,
        statusLabel,
      };
    default:
      return { title, impact: "", lines: [], needsReview: false, statusLabel };
  }
}
