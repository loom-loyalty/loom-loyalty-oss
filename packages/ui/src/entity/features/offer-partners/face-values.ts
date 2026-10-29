/**
 * Face values of an offer partner catalog item: what the partner sells it at,
 * the amounts an admin is offered when importing it, and how they display.
 *
 * `isSoldAt` mirrors the API's check for the amounts a partner sells, and
 * `isOfferableAt` adds the API's offerable amounts (the ones that don't lose
 * money), so the import sheet only offers amounts the API accepts.
 */

/** The face value fields of a catalog item. */
export interface FaceValueSource {
  currency?: string;
  minValue?: number;
  maxValue?: number;
  stepValue?: number;
  fixedDenominations?: number[];
  /** Fixed items: the amounts that don't lose money. Absent from an older API. */
  offerableDenominations?: number[] | null;
  /** Range items: the smallest amount that pays for itself; null when none does. */
  minOfferableValue?: number | null;
}

/** The most amounts one offer link can carry (CreateOfferPartnerOfferLinkData). */
export const MAX_LINK_DENOMINATIONS = 20;

/** Round amounts suggested for an item sold across a range. */
const SUGGESTED_AMOUNTS = [5, 10, 15, 20, 25, 50, 75, 100, 150, 200, 250, 500, 1000];

/** How many suggested amounts start ticked for a range item. */
const DEFAULT_RANGE_PICKS = 4;

/** Formats a face value as money, dropping cents when there are none ("$25", "$12.50"). */
export function formatFaceValue(value: number, currency = "USD"): string {
  const whole = Number.isInteger(value);
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: whole ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    // An unknown currency code: show the number with the code.
    return `${value.toFixed(whole ? 0 : 2)} ${currency}`;
  }
}

/** Fixed amounts, smallest first; empty for an item sold across a range. */
function fixedAmounts(item: FaceValueSource): number[] {
  return [...(item.fixedDenominations ?? [])].sort((a, b) => a - b);
}

/** Whether the partner sells `item` at `value`. */
export function isSoldAt(item: FaceValueSource, value: number): boolean {
  if (!Number.isFinite(value) || value <= 0) return false;
  const fixed = fixedAmounts(item);
  if (fixed.length > 0) return fixed.some((amount) => amount === value);
  if (item.minValue !== undefined && value < item.minValue) return false;
  if (item.maxValue !== undefined && value > item.maxValue) return false;
  const step = item.stepValue;
  if (!step || step <= 0) return true;
  const base = item.minValue ?? 0;
  // Compare in cents so 0.1-style steps don't drift.
  return Math.round((value - base) * 100) % Math.round(step * 100) === 0;
}

/**
 * Whether `item` can be offered at `value`: sold there and not at a loss. When
 * the API didn't say (an older release), every amount the partner sells counts.
 */
export function isOfferableAt(item: FaceValueSource, value: number): boolean {
  if (!isSoldAt(item, value)) return false;
  if (hasFixedAmounts(item)) {
    return item.offerableDenominations == null || item.offerableDenominations.includes(value);
  }
  if (item.minOfferableValue === undefined) return true;
  return item.minOfferableValue !== null && value >= item.minOfferableValue;
}

/** Whether no amount of the item can be offered without a loss. */
export function hasNoOfferableAmount(item: FaceValueSource): boolean {
  if (hasFixedAmounts(item)) {
    return item.offerableDenominations != null && item.offerableDenominations.length === 0;
  }
  return item.minOfferableValue === null;
}

/** A short label for what the item sells at: "$25", "$10, $25, $50" or "$10–$100". */
export function describeFaceValues(item: FaceValueSource): string {
  const currency = item.currency ?? "USD";
  const fixed = fixedAmounts(item);
  if (fixed.length > 0) {
    if (fixed.length <= 4) return fixed.map((v) => formatFaceValue(v, currency)).join(", ");
    return `${formatFaceValue(fixed[0]!, currency)}–${formatFaceValue(fixed[fixed.length - 1]!, currency)}`;
  }
  const { minValue, maxValue } = item;
  if (minValue !== undefined && maxValue !== undefined) {
    return minValue === maxValue
      ? formatFaceValue(minValue, currency)
      : `${formatFaceValue(minValue, currency)}–${formatFaceValue(maxValue, currency)}`;
  }
  if (minValue !== undefined) return `From ${formatFaceValue(minValue, currency)}`;
  if (maxValue !== undefined) return `Up to ${formatFaceValue(maxValue, currency)}`;
  return "—";
}

/** Whether the item is sold at a fixed list of amounts rather than across a range. */
export function hasFixedAmounts(item: FaceValueSource): boolean {
  return fixedAmounts(item).length > 0;
}

/**
 * The amounts to choose from when importing: the fixed list, or round amounts
 * inside the range (its ends included), capped at {@link MAX_LINK_DENOMINATIONS}.
 */
export function amountChoices(item: FaceValueSource): number[] {
  const fixed = fixedAmounts(item);
  if (fixed.length > 0) return fixed.slice(0, MAX_LINK_DENOMINATIONS);
  const choices = new Set<number>();
  for (const amount of SUGGESTED_AMOUNTS) {
    if (isSoldAt(item, amount)) choices.add(amount);
  }
  for (const end of [item.minValue, item.maxValue, item.minOfferableValue ?? undefined]) {
    if (end !== undefined && isSoldAt(item, end)) choices.add(end);
  }
  return [...choices].sort((a, b) => a - b).slice(0, MAX_LINK_DENOMINATIONS);
}

/** The amounts ticked when an item is first added to an import: offerable ones only. */
export function defaultAmounts(item: FaceValueSource): number[] {
  const choices = amountChoices(item).filter((amount) => isOfferableAt(item, amount));
  return hasFixedAmounts(item) ? choices : choices.slice(0, DEFAULT_RANGE_PICKS);
}
