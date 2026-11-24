/**
 * "+ New …" for the offer, badge and tier pickers in a rule or flow
 * (pickers brief S2, S8, S14, S19; invariants I2, I4).
 *
 * The record's own create sheet opens over the expression modal with the
 * rule's programs filled in. The pick changes only once the record exists, and
 * a failed create keeps its error inside the sheet. Spread `pickerProps` onto
 * the field and render `createSheet` beside it. Outside an
 * `InlineCreateProvider` it returns nothing extra.
 */

import { describeError, type DescribedError } from "@loom-loyalty/core";
import {
  getCustomerStatusManagementListBadgesQueryKey,
  getCustomerStatusManagementListTiersQueryKey,
  getOfferManagementListOffersQueryKey,
  useCustomerStatusManagementCreateBadge,
  useCustomerStatusManagementCreateTier,
  useOfferManagementCreateOffer,
  type CreateBadge,
  type CreateOffer,
  type CreateTier,
} from "@loom-loyalty/sdk";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useState, type ReactNode } from "react";

import { BadgeFormSheet } from "../../entity/features/badges/badge-form-sheet.js";
import { OfferFormSheet } from "../../entity/features/offers/offer-form-sheet.js";
import { TierFormSheet } from "../../entity/features/tiers/tier-form-sheet.js";
import type { EntityCreateOption, EntityOption } from "../../forms/entity-select-box.js";
import { resetInfiniteQueryToFirstPage } from "../../hooks/infinite-query-helpers.js";
import { useInlineCreate } from "./inline-create-context";

export type InlineRecordKind = "offer" | "badge" | "tier";

export interface CreatedRecordRef {
  code?: string;
  name?: string;
}

export interface UseInlineRecordPickerOptions {
  kind: InlineRecordKind;
  /** Selects the record. `record` carries the code of one just created, before the list refetches. */
  onSelect: (id: string, record?: CreatedRecordRef) => void;
  /** Which identifier the field selects by; "code" for a field with `idField="code"`. Defaults to "id". */
  idField?: "id" | "code";
}

export interface InlineRecordPickerProps {
  createOptions?: EntityCreateOption[];
  onCreateOption?: (key: string) => void;
  suggested: boolean;
  /** The record just created here, so the picker shows it before its list or search holds it. */
  createdOption?: EntityOption;
}

const CREATE_LABELS: Record<InlineRecordKind, string> = {
  offer: "New offer",
  badge: "New badge",
  tier: "New tier",
};

const FALLBACK_ERRORS: Record<InlineRecordKind, string> = {
  offer: "Couldn't create the offer.",
  badge: "Couldn't create the badge.",
  tier: "Couldn't create the tier.",
};

const idOf = (kind: InlineRecordKind, record: Record<string, unknown>): string => {
  const key = kind === "offer" ? "offerId" : kind === "badge" ? "badgeId" : "tierId";
  return String(record[key] ?? record.code ?? "");
};

export function useInlineRecordPicker({
  kind,
  onSelect,
  idField = "id",
}: UseInlineRecordPickerOptions): {
  pickerProps: InlineRecordPickerProps;
  createSheet: ReactNode;
} {
  const ctx = useInlineCreate();
  const [open, setOpen] = useState(false);
  const [createdOption, setCreatedOption] = useState<EntityOption | undefined>();
  const onCreateOption = useCallback(() => setOpen(true), []);
  const onCreated = useCallback(
    (id: string, record: CreatedRecordRef) => {
      const fieldId = idField === "code" ? (record.code ?? id) : id;
      setCreatedOption({
        id: fieldId,
        name: record.name ?? record.code ?? id,
        secondaryText: record.code,
      });
      onSelect(id, record);
      setOpen(false);
    },
    [onSelect, idField]
  );

  if (!ctx) {
    return { pickerProps: { suggested: false }, createSheet: null };
  }

  return {
    pickerProps: {
      createOptions: [{ key: kind, label: CREATE_LABELS[kind] }],
      onCreateOption,
      suggested: false,
      createdOption,
    },
    // Mounted only while open, so the mutations and the sheet's form state start fresh.
    createSheet: open ? (
      <InlineRecordCreateSheet
        kind={kind}
        programIds={ctx.ruleProgramIds}
        onOpenChange={setOpen}
        onCreated={onCreated}
      />
    ) : null,
  };
}

interface InlineRecordCreateSheetProps {
  kind: InlineRecordKind;
  programIds: readonly string[];
  onOpenChange: (open: boolean) => void;
  onCreated: (id: string, record: CreatedRecordRef) => void;
}

function InlineRecordCreateSheet({
  kind,
  programIds,
  onOpenChange,
  onCreated,
}: InlineRecordCreateSheetProps): ReactNode {
  const queryClient = useQueryClient();
  const [createError, setCreateError] = useState<DescribedError | null>(null);

  const createOffer = useOfferManagementCreateOffer({
    mutation: {
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: getOfferManagementListOffersQueryKey() });
      },
    },
  });
  const createBadge = useCustomerStatusManagementCreateBadge({
    mutation: {
      onSuccess: () =>
        resetInfiniteQueryToFirstPage(queryClient, getCustomerStatusManagementListBadgesQueryKey()),
    },
  });
  const createTier = useCustomerStatusManagementCreateTier({
    mutation: {
      onSuccess: () =>
        resetInfiniteQueryToFirstPage(queryClient, getCustomerStatusManagementListTiersQueryKey()),
    },
  });

  const handleSubmit = useCallback(
    async (data: CreateOffer | CreateBadge | CreateTier) => {
      setCreateError(null);
      try {
        const response =
          kind === "offer"
            ? await createOffer.mutateAsync({ data: data as CreateOffer })
            : kind === "badge"
              ? await createBadge.mutateAsync({ data: data as CreateBadge })
              : await createTier.mutateAsync({ data: data as CreateTier });
        const created = ((response as { data?: unknown }).data ?? {}) as Record<string, unknown>;
        const input = data as { code?: string; name?: string };
        // I4: the parent draft changes only once the record exists.
        onCreated(idOf(kind, { code: input.code, ...created }), {
          code: (created.code as string | undefined) ?? input.code,
          name: (created.name as string | undefined) ?? input.name,
        });
      } catch (error) {
        // S8: the error stays in the sheet; the draft is untouched.
        setCreateError(describeError(error, { fallback: FALLBACK_ERRORS[kind] }));
      }
    },
    [kind, createOffer, createBadge, createTier, onCreated]
  );

  const sheetProps = {
    open: true,
    onOpenChange,
    mode: "create" as const,
    defaultProgramIds: [...programIds],
    onSubmit: handleSubmit,
    error: createError,
    fieldErrors: createError?.fieldErrors,
  };

  if (kind === "offer") {
    return <OfferFormSheet {...sheetProps} isSubmitting={createOffer.isPending} />;
  }
  if (kind === "badge") {
    return <BadgeFormSheet {...sheetProps} isSubmitting={createBadge.isPending} />;
  }
  return <TierFormSheet {...sheetProps} isSubmitting={createTier.isPending} />;
}
