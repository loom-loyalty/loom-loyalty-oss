/**
 * CustomerMergeSheet — merge two customer records into one
 *
 * Two steps in one FormSheet. Choose: find the other customer and pick the
 * survivor, whose profile and external ID win. Preview: the merged customer
 * as the server's SIMULATE run says it will look, rendered with the normal
 * customer header and lists. The final Merge opens an AlertDialog, since a
 * merge cannot be undone.
 *
 * Presentational only: the app runs the search, the preview request and the
 * merge, and passes their state back in.
 */

"use client";

import { AlertTriangle, Search } from "lucide-react";
import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";

import { LiveRegion } from "../../../a11y/live-region.js";

import { FormSheet, type FormSheetError } from "../../../forms/form-sheet.js";
import { cn } from "../../../lib/utils.js";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../../../primitives/alert-dialog.js";
import { Badge } from "../../../primitives/badge.js";
import { Button } from "../../../primitives/button.js";
import { Input } from "../../../primitives/input.js";
import { Label } from "../../../primitives/label.js";
import { RadioGroup, RadioGroupItem } from "../../../primitives/radio-group.js";
import { Skeleton } from "../../../primitives/skeleton.js";
import { ContactAddressList } from "./contact-address-list.js";
import { ContactEmailList } from "./contact-email-list.js";
import { ContactPhoneList } from "./contact-phone-list.js";
import { CustomerHeader } from "./customer-header.js";
import { CustomerTagList } from "./customer-tag-list.js";
import { IdentifierList } from "./identifier-list.js";
import type { CustomerData } from "./types.js";

/** One customer as the merge sheet shows it. */
export interface CustomerMergeCandidate {
  customerId: string;
  name: string;
  /** A second line that tells two same-named customers apart, e.g. the primary email. */
  detail?: string;
  externalId?: string;
}

/** The two customers being merged: the survivor keeps its profile and external ID. */
export interface CustomerMergeSelection {
  survivorId: string;
  sourceId: string;
}

export interface CustomerMergeSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The customer the sheet was opened from; always one of the two. */
  current: CustomerMergeCandidate;
  /** Search box value, controlled by the app. */
  searchValue: string;
  onSearchValueChange: (value: string) => void;
  /** Search matches, not including `current`. */
  searchResults: CustomerMergeCandidate[];
  searchLoading?: boolean;
  /** Shown under the search box when there are no results to list, e.g. "Type at least 3 characters". */
  searchHint?: string;
  /** Called on entering the preview step, so the app can request a fresh SIMULATE. */
  onPreview: (selection: CustomerMergeSelection) => void;
  /** The merged customer the SIMULATE run returned; null until it arrives or when it failed. */
  preview: CustomerData | null;
  previewLoading?: boolean;
  /** Runs the merge. A rejection leaves the sheet open on the preview step. */
  onConfirm: (selection: CustomerMergeSelection) => Promise<void>;
  isSubmitting?: boolean;
  /** Preview or merge failure; a `describeError` result also shows its support reference. */
  error?: FormSheetError | null;
}

const MERGE_WARNINGS = [
  "This can't be undone.",
  "The merged customer gets a new customer ID.",
  "The member must sign in again on the Rewards Portal.",
] as const;

type Step = "choose" | "preview";

/**
 * Sheet for merging the current customer with another one.
 */
export function CustomerMergeSheet({
  open,
  onOpenChange,
  current,
  searchValue,
  onSearchValueChange,
  searchResults,
  searchLoading = false,
  searchHint,
  onPreview,
  preview,
  previewLoading = false,
  onConfirm,
  isSubmitting = false,
  error,
}: CustomerMergeSheetProps): ReactNode {
  const [step, setStep] = useState<Step>("choose");
  const [other, setOther] = useState<CustomerMergeCandidate | null>(null);
  const [survivorId, setSurvivorId] = useState(current.customerId);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const searchId = useId();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const survivorGroupRef = useRef<HTMLFieldSetElement>(null);
  // Where focus goes after the search or the survivor choice unmounts.
  const pendingFocus = useRef<"search" | "survivor" | null>(null);

  useEffect(() => {
    const target = pendingFocus.current;
    if (!target) return;
    pendingFocus.current = null;
    if (target === "search") searchInputRef.current?.focus();
    else
      survivorGroupRef.current
        ?.querySelector<HTMLElement>('[role="radio"][data-state="checked"]')
        ?.focus();
  }, [other]);

  const survivor = survivorId === other?.customerId ? other : current;
  const selection: CustomerMergeSelection | null = other
    ? {
        survivorId: survivor.customerId,
        sourceId: survivor === current ? other.customerId : current.customerId,
      }
    : null;

  // Start over whenever the sheet closes, however it was closed.
  const [wasOpen, setWasOpen] = useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (!open) {
      setStep("choose");
      setOther(null);
      setSurvivorId(current.customerId);
      setConfirmOpen(false);
    }
  }

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selection) return;
    if (step === "choose") {
      setStep("preview");
      onPreview(selection);
    } else {
      setConfirmOpen(true);
    }
  };

  const handleCancel = () => {
    if (step === "preview") setStep("choose");
    else onOpenChange(false);
  };

  const handleConfirm = async () => {
    if (!selection || isSubmitting) return;
    try {
      await onConfirm(selection);
    } catch {
      // The app passes the failure back as `error`, shown inline in the sheet.
    } finally {
      setConfirmOpen(false);
    }
  };

  const chooseOther = (candidate: CustomerMergeCandidate | null) => {
    pendingFocus.current = candidate ? "survivor" : "search";
    setOther(candidate);
    if (!candidate) setSurvivorId(current.customerId);
  };

  return (
    <>
      <FormSheet
        open={open}
        onOpenChange={onOpenChange}
        title="Merge customers"
        description={
          step === "choose"
            ? "Find the duplicate record and choose which customer's profile to keep."
            : "Check the merged customer before you merge."
        }
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        cancelLabel={step === "preview" ? "Back" : "Cancel"}
        submitLabel={step === "choose" ? "Preview merge" : "Merge…"}
        submitDisabled={
          step === "choose" ? !selection : previewLoading || preview === null || isSubmitting
        }
        isSubmitting={isSubmitting}
        error={error}
        className="sm:max-w-2xl"
      >
        {step === "choose" ? (
          <div className="space-y-6">
            {!other && (
              <div className="space-y-2">
                <Label htmlFor={searchId}>Other customer</Label>
                <div className="relative">
                  <Search
                    className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2"
                    aria-hidden="true"
                  />
                  <Input
                    ref={searchInputRef}
                    id={searchId}
                    type="search"
                    value={searchValue}
                    onChange={(e) => onSearchValueChange(e.target.value)}
                    placeholder="Last name or email"
                    className="pl-9"
                    autoComplete="off"
                  />
                </div>
                <SearchResults
                  results={searchResults}
                  loading={searchLoading}
                  hint={searchHint}
                  onSelect={chooseOther}
                />
              </div>
            )}

            {other && (
              <fieldset ref={survivorGroupRef} className="space-y-3">
                <legend className="text-foreground text-sm font-medium">
                  Which customer&apos;s profile should the merged customer keep?
                </legend>
                <RadioGroup value={survivorId} onValueChange={setSurvivorId} className="gap-3">
                  {[current, other].map((candidate) => (
                    <SurvivorOption
                      key={candidate.customerId}
                      candidate={candidate}
                      selected={candidate.customerId === survivorId}
                    />
                  ))}
                </RadioGroup>
                <p className="text-muted-foreground text-sm">
                  The kept profile&apos;s name, details and external ID win. Everything else from
                  both customers is combined.
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="min-h-11"
                  onClick={() => chooseOther(null)}
                >
                  Choose a different customer
                </Button>
              </fieldset>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            <MergeWarnings />
            <section aria-labelledby={`${searchId}-preview`} className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <h3 id={`${searchId}-preview`} className="text-foreground text-sm font-medium">
                  Merged customer
                </h3>
                <Badge variant="outline">Preview, not saved</Badge>
              </div>
              <p className="text-muted-foreground text-sm">
                Tiers, badges and point balances move over after the merge finishes processing, so
                they aren&apos;t shown here.
              </p>
              <div aria-live="polite" aria-busy={previewLoading}>
                {previewLoading ? <PreviewSkeleton /> : preview && <MergePreview data={preview} />}
              </div>
            </section>
          </div>
        )}
      </FormSheet>

      <AlertDialog
        open={confirmOpen}
        onOpenChange={(next) => !isSubmitting && setConfirmOpen(next)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Merge these customers?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>
                  {selection && other
                    ? `${current.customerId === selection.sourceId ? current.name : other.name} will be merged into ${survivor.name}.`
                    : null}
                </p>
                <ul className="list-disc space-y-1 pl-5">
                  {MERGE_WARNINGS.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={() => void handleConfirm()}
              disabled={isSubmitting}
              aria-busy={isSubmitting}
            >
              {isSubmitting ? "Merging…" : `Merge into ${survivor.name}`}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function SearchResults({
  results,
  loading,
  hint,
  onSelect,
}: {
  results: CustomerMergeCandidate[];
  loading: boolean;
  hint?: string;
  onSelect: (candidate: CustomerMergeCandidate) => void;
}): ReactNode {
  const announcement = loading
    ? "Searching customers…"
    : results.length > 0
      ? `${results.length} matching ${results.length === 1 ? "customer" : "customers"}`
      : (hint ?? "");
  return (
    <>
      <LiveRegion message={announcement} />
      <SearchResultsBody results={results} loading={loading} hint={hint} onSelect={onSelect} />
    </>
  );
}

function SearchResultsBody({
  results,
  loading,
  hint,
  onSelect,
}: {
  results: CustomerMergeCandidate[];
  loading: boolean;
  hint?: string;
  onSelect: (candidate: CustomerMergeCandidate) => void;
}): ReactNode {
  if (loading) {
    return (
      <div className="space-y-2" aria-hidden="true">
        <Skeleton className="h-14 w-full rounded-md" />
        <Skeleton className="h-14 w-full rounded-md" />
      </div>
    );
  }
  if (results.length === 0) {
    return hint ? <p className="text-muted-foreground text-sm">{hint}</p> : null;
  }
  return (
    <ul className="space-y-2" aria-label="Matching customers">
      {results.map((candidate) => (
        <li key={candidate.customerId}>
          <button
            type="button"
            onClick={() => onSelect(candidate)}
            className="border-border hover:bg-muted focus-visible:ring-ring flex min-h-11 w-full flex-col items-start rounded-md border px-3 py-2 text-left focus-visible:ring-2 focus-visible:outline-none"
          >
            <CandidateText candidate={candidate} />
          </button>
        </li>
      ))}
    </ul>
  );
}

function SurvivorOption({
  candidate,
  selected,
}: {
  candidate: CustomerMergeCandidate;
  selected: boolean;
}): ReactNode {
  const id = useId();
  return (
    <Label
      htmlFor={id}
      className={cn(
        "border-border flex min-h-11 cursor-pointer items-start gap-3 rounded-md border p-3 font-normal",
        selected && "border-primary bg-muted"
      )}
    >
      <RadioGroupItem id={id} value={candidate.customerId} className="mt-0.5" />
      <span className="flex min-w-0 flex-1 flex-col">
        <CandidateText candidate={candidate} />
      </span>
      {selected && <Badge variant="secondary">Keeps profile</Badge>}
    </Label>
  );
}

function CandidateText({ candidate }: { candidate: CustomerMergeCandidate }): ReactNode {
  return (
    <>
      <span className="text-foreground truncate text-sm font-medium">{candidate.name}</span>
      {candidate.detail && (
        <span className="text-muted-foreground truncate text-xs">{candidate.detail}</span>
      )}
      {candidate.externalId && (
        <span className="text-muted-foreground truncate font-mono text-xs">
          External ID {candidate.externalId}
        </span>
      )}
    </>
  );
}

function MergeWarnings(): ReactNode {
  return (
    <div className="border-destructive/30 bg-destructive/5 flex gap-3 rounded-lg border p-3">
      <AlertTriangle className="text-destructive mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <ul className="text-foreground space-y-1 text-sm">
        {MERGE_WARNINGS.map((w) => (
          <li key={w}>{w}</li>
        ))}
      </ul>
    </div>
  );
}

function PreviewSkeleton(): ReactNode {
  return (
    <div className="space-y-4" aria-label="Loading preview">
      <Skeleton className="h-24 w-full rounded-md" />
      <Skeleton className="h-16 w-full rounded-md" />
      <Skeleton className="h-16 w-full rounded-md" />
    </div>
  );
}

/** The merged customer, drawn with the same pieces as the customer detail view. */
function MergePreview({ data }: { data: CustomerData }): ReactNode {
  return (
    <div className="space-y-6">
      <CustomerHeader data={data} className="static rounded-md border" />
      <IdentifierList identifiers={data.identifiers} />
      <ContactEmailList emails={data.emails} />
      <ContactPhoneList phones={data.phones} />
      <ContactAddressList addresses={data.addresses} />
      <section aria-label="Programs" className="space-y-3">
        <h4 className="text-foreground text-sm font-medium">Programs</h4>
        {data.programs.length === 0 ? (
          <p className="text-muted-foreground text-sm">Not enrolled in any programs.</p>
        ) : (
          <ul className="space-y-2">
            {data.programs.map((p) => (
              <li
                key={p.customerProgramId ?? p.programId}
                className="bg-background border-border rounded-md border px-3 py-2 text-sm"
              >
                {p.programName}
              </li>
            ))}
          </ul>
        )}
      </section>
      <section aria-label="Tags" className="space-y-3">
        <h4 className="text-foreground text-sm font-medium">Tags</h4>
        <CustomerTagList tags={data.tags} />
      </section>
    </div>
  );
}
