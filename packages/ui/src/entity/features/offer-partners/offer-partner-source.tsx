/**
 * The partner block on an EXTERNAL offer's detail sheet (mockup 1f): which
 * partner fulfils it, the amounts members can redeem, how the reward reaches
 * them, catalog changes waiting for review, and Price it/Pause/Resume/Unlink.
 */
import { formatDateTime } from "@loom-loyalty/core";
import type { OfferPartnerCatalogChange, OfferPartnerOfferLink } from "@loom-loyalty/sdk";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { LiveRegion } from "../../../a11y/live-region.js";
import { Badge } from "../../../primitives/badge.js";
import { Button } from "../../../primitives/button.js";
import { Skeleton } from "../../../primitives/skeleton.js";
import { CatalogChangeCard } from "./catalog-change-card.js";
import { formatFaceValue } from "./face-values.js";

export type CatalogChangeAnswer = "ACCEPTED" | "DISMISSED";

export interface OfferPartnerSourceProps {
  partnerName: string;
  /** The partner's identifier for the item (ExternalOffer.partnerOfferId). */
  partnerItemId?: string;
  /** The link to the partner; undefined while it loads or when it is missing. */
  link?: OfferPartnerOfferLink;
  loading?: boolean;
  /** Error loading the link, shown inline. */
  error?: string | null;
  category?: string;
  /** Whether the partner also emails the reward (the enrollment's email delivery). */
  emailDelivery?: boolean;
  lastSyncedDateTime?: string;
  /** Catalog changes waiting for review on this offer. */
  pendingChanges?: OfferPartnerCatalogChange[];
  onAnswerChange?: (change: OfferPartnerCatalogChange, answer: CatalogChangeAnswer) => void;
  /** ID of the change whose answer is being saved. */
  answeringChangeId?: string | null;
  answerError?: string | null;
  /** The change `answerError` belongs to: the last one whose answer failed. */
  answerErrorChangeId?: string | null;
  /** Prices the offer's amounts as member rewards; shown when the caller can create rules. */
  onPrice?: () => void;
  /** Shown only when the caller can change the link. */
  onPause?: () => void;
  onResume?: () => void;
  onUnlink?: () => void;
  /** Disables the link actions while a change is saved. */
  updating?: boolean;
  updateError?: string | null;
}

function Field({ label, children }: { label: string; children: ReactNode }): ReactNode {
  return (
    <div>
      <dt className="text-muted-foreground text-sm">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium">{children}</dd>
    </div>
  );
}

/** How an offer link's status reads, shared by the detail block and the Hub's linked offers table. */
export const OFFER_LINK_STATUS: Record<
  string,
  { label: string; variant: "success" | "warning" | "error" }
> = {
  ACTIVE: { label: "Active", variant: "success" },
  PAUSED: { label: "Paused", variant: "warning" },
  RETIRED: { label: "Retired", variant: "error" },
};

export function OfferPartnerSource({
  partnerName,
  partnerItemId,
  link,
  loading = false,
  error,
  category,
  emailDelivery = false,
  lastSyncedDateTime,
  pendingChanges = [],
  onAnswerChange,
  answeringChangeId,
  answerError,
  answerErrorChangeId,
  onPrice,
  onPause,
  onResume,
  onUnlink,
  updating = false,
  updateError,
}: OfferPartnerSourceProps): ReactNode {
  const currency = link?.currency ?? "USD";
  const status = link?.status ? OFFER_LINK_STATUS[link.status] : undefined;
  const retired = link?.status === "RETIRED";
  const headingRef = useRef<HTMLHeadingElement>(null);
  // Announce a status only once it changes from the one the block first showed.
  const [firstStatus, setFirstStatus] = useState(link?.status);
  if (firstStatus === undefined && link?.status) setFirstStatus(link.status);
  const announcement =
    status && link?.status !== firstStatus ? `Offer link ${status.label.toLowerCase()}` : "";
  const shownStatus = useRef(link?.status);

  // Unlinking removes every action, so focus moves to the heading instead of the page.
  useEffect(() => {
    const previous = shownStatus.current;
    shownStatus.current = link?.status;
    if (previous && previous !== "RETIRED" && link?.status === "RETIRED")
      headingRef.current?.focus();
  }, [link?.status]);

  return (
    <section className="space-y-4" aria-labelledby="offer-partner-source-heading">
      <div className="flex flex-wrap items-center gap-2">
        <h3
          ref={headingRef}
          tabIndex={-1}
          id="offer-partner-source-heading"
          className="text-foreground text-sm font-semibold tracking-wide uppercase"
        >
          Partner source
        </h3>
        <Badge variant="secondary">External · {partnerName}</Badge>
        {status ? (
          <Badge variant={status.variant} dot>
            {status.label}
          </Badge>
        ) : null}
      </div>

      {loading ? (
        <div className="space-y-2" aria-busy="true" aria-label="Loading partner details">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      ) : error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : (
        <>
          {link?.statusReason ? (
            <p className="text-muted-foreground text-sm">{link.statusReason}</p>
          ) : null}

          {pendingChanges.map((change) => (
            <CatalogChangeCard
              key={change.catalogChangeId}
              change={change}
              currency={currency}
              onAccept={onAnswerChange ? () => onAnswerChange(change, "ACCEPTED") : undefined}
              onDismiss={onAnswerChange ? () => onAnswerChange(change, "DISMISSED") : undefined}
              answering={answeringChangeId === change.catalogChangeId}
              error={answerErrorChangeId === change.catalogChangeId ? answerError : null}
            />
          ))}

          <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
            <Field label="Catalog item">
              <span className="font-mono">{partnerItemId ?? link?.partnerItemId ?? "—"}</span>
            </Field>
            {category ? <Field label="Category">{category}</Field> : null}
            <Field label="Delivery">
              {emailDelivery
                ? "Reward link in the Rewards Portal, and emailed"
                : "Reward link in the Rewards Portal"}
            </Field>
            {lastSyncedDateTime ? (
              <Field label="Last synced">
                <time dateTime={lastSyncedDateTime}>{formatDateTime(lastSyncedDateTime)}</time>
              </Field>
            ) : null}
          </dl>

          {link?.denominations && link.denominations.length > 0 ? (
            <div className="space-y-2">
              <p className="text-muted-foreground text-sm">Amounts members can redeem</p>
              <ul className="flex flex-wrap gap-2" aria-label="Amounts">
                {link.denominations.map((denomination) => {
                  const paused = denomination.status === "PAUSED";
                  return (
                    <li key={denomination.value}>
                      <Badge variant={paused ? "outline" : "secondary"} className="font-mono">
                        {formatFaceValue(denomination.value, currency)}
                        {paused ? <span className="font-sans"> · paused</span> : null}
                      </Badge>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}

          {updateError ? (
            <p role="alert" className="text-destructive text-sm">
              {updateError}
            </p>
          ) : null}

          {link && !retired && (onPrice || onPause || onResume || onUnlink) ? (
            <div className="flex flex-wrap gap-2">
              {onPrice ? (
                <Button size="sm" onClick={onPrice}>
                  Price it
                </Button>
              ) : null}
              {/* One button that changes its label, so focus stays on it across the change. */}
              {(link.status === "ACTIVE" && onPause) || (link.status === "PAUSED" && onResume) ? (
                <Button
                  variant="outline"
                  size="sm"
                  aria-disabled={updating || undefined}
                  onClick={() => {
                    if (updating) return;
                    (link.status === "ACTIVE" ? onPause : onResume)?.();
                  }}
                >
                  {link.status === "ACTIVE" ? "Pause offer" : "Resume offer"}
                </Button>
              ) : null}
              {onUnlink ? (
                <Button variant="outline" size="sm" onClick={onUnlink} disabled={updating}>
                  Unlink offer
                </Button>
              ) : null}
            </div>
          ) : null}
        </>
      )}
      <LiveRegion message={announcement} />
    </section>
  );
}
