"use client";

/**
 * OfferFormSheet - Sheet component for creating/editing Offers
 *
 * Wraps FormSheet with offer-specific form fields and logic.
 * Uses CodeInput for code auto-generation.
 * Uses LocalizedStringInput for multi-language description support.
 * Uses ProgramMultiField for program association.
 * Uses DurationPeriodBuilder for duration configuration.
 * Supports extended fields from data model extensions.
 *
 * Event-handler-driven state reset (NOT useEffect).
 */

import type {
  CodeGenInformation,
  CodeGenInformationType,
  CreateCouponOfferCouponDiscountType,
  CreateOffer,
} from "@loom-loyalty/sdk";
import { useState, type FormEvent, type ReactNode } from "react";
import { CodeGenInformationInput } from "../../../forms/code-gen-information-input.js";
import { CodeInput, useCodeInput } from "../../../forms/code-input.js";
import { CustomerAudienceField } from "../../../forms/customer-audience-field/index.js";
import { DiscriminatorRadioGroup } from "../../../forms/discriminator-radio-group.js";
import { DurationPeriodBuilder } from "../../../forms/duration-period-builder.js";
import { WithFieldError } from "../../../forms/field-errors.js";
import { FormSheet } from "../../../forms/form-sheet.js";
import {
  LocalizedStringInput,
  type LocalizedString,
} from "../../../forms/localized-string-input.js";
import { MetadataField, useMetadataField } from "../../../forms/metadata-field/index.js";
import { ProgramMultiField } from "../../../forms/program-field/index.js";
import { Input } from "../../../primitives/input.js";
import { Label } from "../../../primitives/label.js";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../primitives/select.js";
import { Switch } from "../../../primitives/switch.js";
import { extractExtendedFields } from "../../entity-field-utils.js";
import { ExtendedFieldsSection } from "../../extended-fields-section.js";
import {
  toStrictDurationPeriodValue,
  type DurationPeriodValue,
} from "../../format-duration-period.js";
import type { OfferFormSheetProps } from "./types.js";

/** COUPON-only: type-of-discount enum from CreateCouponOffer. */
const COUPON_DISCOUNT_TYPE_OPTIONS = [
  { value: "PERCENTAGE", label: "Percentage" },
  { value: "FIXED_AMOUNT", label: "Fixed Amount" },
  { value: "BUY_X_GET_Y", label: "Buy X Get Y" },
  { value: "FREE_SHIPPING", label: "Free Shipping" },
] as const;

/** Offer type options */
const OFFER_TYPE_OPTIONS = [
  { value: "COUPON", label: "Coupon" },
  { value: "EXTERNAL", label: "External" },
] as const;

/**
 * COUPON-only: the "Coupon Code Source" discriminator. Replaces the old
 * pairing of CodeGenInformationInput's own internal 5-value "Code Type"
 * select + a separate, uncoordinated `couponCodeBatchSize` number field —
 * nothing forced those two to agree, so the easy default (touch neither)
 * silently created an offer with zero usable coupon codes (see
 * `describeCouponCodeSource` / edit-mode summary below for the legacy
 * 5-value enum this narrows from). Intentionally only 2 options — GENERATED
 * and PROVIDED — a deliberate, forced choice with no easy-to-hit-by-accident
 * default.
 */
const COUPON_CODE_SOURCE_OPTIONS = [
  {
    value: "GENERATED",
    label: "Auto-generate a batch of codes",
    description:
      "A pool of single-use codes is generated when the offer is created. Set how many below.",
  },
  {
    value: "PROVIDED",
    label: "Provide codes manually",
    description:
      "No pool is generated. Add individual coupon codes from the offer's Coupons tab after creating it.",
  },
] as const;

/**
 * Helper to extract localized string from i18n object
 */
function getLocalizedDescription(
  description?: Record<string, unknown>
): LocalizedString | undefined {
  if (!description) return undefined;

  const result: LocalizedString = {};
  for (const [key, value] of Object.entries(description)) {
    if (typeof value === "string") {
      result[key] = value;
    }
  }

  return Object.keys(result).length > 0 ? result : undefined;
}

/**
 * Edit-mode, read-only summary of an offer's existing coupon-code-generation
 * `type`. Edit mode never shows the interactive "Coupon Code Source" choice
 * (the pool is a one-time, create-event side effect the backend treats as
 * immutable — same reason the sibling "Offer Type" control is disabled in
 * edit mode). GENERATED/PROVIDED are the only two values this form's
 * create-time UI can produce going forward, but an offer created before this
 * fix may still carry one of the 3 other legacy CodeGenInformationType
 * values (EXTERNAL, EXTERNAL_IF_NOT_PROVIDED, GENERATED_IF_NOT_PROVIDED) —
 * described generically rather than crashing or mislabeling them.
 */
function describeCouponCodeSource(type: CodeGenInformationType | undefined): string {
  if (!type) return "No coupon code source configured.";
  if (type === "GENERATED") return "Auto-generated batch of codes.";
  if (type === "PROVIDED") return "Codes provided manually.";
  return `Custom code-generation configuration (${type}).`;
}

/**
 * Sheet component for creating and editing Offers.
 */
export function OfferFormSheet({
  open,
  onOpenChange,
  mode,
  initialData,
  onSubmit,
  isSubmitting = false,
  error,
  fieldErrors,
  schema,
  extendedFields = [],
}: OfferFormSheetProps): ReactNode {
  // Form state - standard fields
  const [name, setName] = useState(initialData?.name ?? "");
  const [type, setType] = useState<string>(initialData?.type ?? "COUPON");
  const [programIds, setProgramIds] = useState<string[]>(initialData?.programIds ?? []);
  const [programIdsError, setProgramIdsError] = useState<string | null>(null);
  // initialData.customerAudience is the response-shape nested entity. Pull its
  // id so the field round-trips through edit mode.
  const [customerAudienceId, setCustomerAudienceId] = useState<string>(
    initialData?.customerAudience?.customerAudienceId ?? ""
  );
  const [description, setDescription] = useState<LocalizedString>(
    () => getLocalizedDescription(initialData?.description as Record<string, unknown>) ?? {}
  );
  const [durationPeriod, setDurationPeriod] = useState<DurationPeriodValue | undefined>(
    initialData?.durationPeriod
  );
  const [maxOfferUses, setMaxOfferUses] = useState<number | undefined>(initialData?.maxOfferUses);
  const [maxOfferRedemptions, setMaxOfferRedemptions] = useState<number | undefined>(
    initialData?.maxOfferRedemptions
  );
  const [maxDiscountValue, setMaxDiscountValue] = useState<number | undefined>(
    initialData?.maxDiscountValue
  );
  const [setDateTimePeriodOnIssue, setSetDateTimePeriodOnIssue] = useState(
    initialData?.setDateTimePeriodOnIssue ?? false
  );

  // COUPON sub-type state: cast initialData once to prefill in edit mode.
  const couponInitial = initialData as
    | (typeof initialData & {
        couponDiscountType?: string;
        discountCurrencyType?: { code?: string };
        couponType?: { code?: string };
        couponCodeGroup?: { code?: string };
        couponCodeInformation?: CodeGenInformation;
        couponCodeBatchSize?: number;
      })
    | undefined;
  const [couponDiscountType, setCouponDiscountType] = useState<string>(
    couponInitial?.couponDiscountType ?? ""
  );
  const [discountCurrencyTypeCode, setDiscountCurrencyTypeCode] = useState<string>(
    couponInitial?.discountCurrencyType?.code ?? ""
  );
  const [couponTypeCode, setCouponTypeCode] = useState<string>(
    couponInitial?.couponType?.code ?? ""
  );
  const [couponTypeIsSuggested, setCouponTypeIsSuggested] = useState(false);
  const [couponCodeGroupCode, setCouponCodeGroupCode] = useState<string>(
    couponInitial?.couponCodeGroup?.code ?? ""
  );
  const [couponCodeGroupIsSuggested, setCouponCodeGroupIsSuggested] = useState(false);

  // Always-fire (Rules of Hooks) — handleSubmit gates the actual createMetadata call on type=COUPON.
  const couponTypeMeta = useMetadataField("COUPON_TYPE");
  const couponCodeGroupMeta = useMetadataField("COUPON_CODE_GROUP");
  const [couponCodeInformation, setCouponCodeInformation] = useState<
    CodeGenInformation | undefined
  >(couponInitial?.couponCodeInformation);
  const [couponCodeBatchSize, setCouponCodeBatchSize] = useState<number | undefined>(
    couponInitial?.couponCodeBatchSize
  );
  // "Coupon Code Source" discriminator (GENERATED | PROVIDED) — create mode
  // only. Starts unselected so create requires a deliberate choice rather
  // than silently defaulting to "no pool" (see handleSubmit's validation).
  // Not meaningful in edit mode: that mode renders a read-only summary
  // instead of this control (see describeCouponCodeSource) and submits
  // couponCodeInformation/couponCodeBatchSize state as-is, unguarded by this.
  const [couponCodeSource, setCouponCodeSource] = useState<string>("");
  const [couponCodeSourceError, setCouponCodeSourceError] = useState<string | null>(null);
  const [couponCodeBatchSizeError, setCouponCodeBatchSizeError] = useState<string | null>(null);

  // Extended fields state
  const [extendedFieldValues, setExtendedFieldValues] = useState<Record<string, unknown>>(() =>
    extractExtendedFields(initialData, extendedFields)
  );

  // Code auto-generation using useCodeInput hook
  const codeInput = useCodeInput(name, {
    pattern: "resource",
    format: "kebab-case",
    initialValue: initialData?.code,
    locked: mode === "edit",
  });

  // Handle programIds changes with error clearing
  const handleProgramIdsChange = (ids: string[]) => {
    setProgramIds(ids);
    setProgramIdsError(null);
  };

  // Handle extended field changes
  const handleExtendedFieldChange = (field: string, value: unknown) => {
    setExtendedFieldValues((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  // Reset form when sheet opens/closes or initialData changes
  const resetForm = () => {
    setName(initialData?.name ?? "");
    setType(initialData?.type ?? "COUPON");
    setProgramIds(initialData?.programIds ?? []);
    setProgramIdsError(null);
    setCustomerAudienceId(initialData?.customerAudience?.customerAudienceId ?? "");
    setDescription(
      getLocalizedDescription(initialData?.description as Record<string, unknown>) ?? {}
    );
    setDurationPeriod(initialData?.durationPeriod);
    setMaxOfferUses(initialData?.maxOfferUses);
    setMaxOfferRedemptions(initialData?.maxOfferRedemptions);
    setMaxDiscountValue(initialData?.maxDiscountValue);
    setSetDateTimePeriodOnIssue(initialData?.setDateTimePeriodOnIssue ?? false);
    setCouponDiscountType(couponInitial?.couponDiscountType ?? "");
    setDiscountCurrencyTypeCode(couponInitial?.discountCurrencyType?.code ?? "");
    setCouponTypeCode(couponInitial?.couponType?.code ?? "");
    setCouponTypeIsSuggested(false);
    setCouponCodeGroupCode(couponInitial?.couponCodeGroup?.code ?? "");
    setCouponCodeGroupIsSuggested(false);
    setCouponCodeInformation(couponInitial?.couponCodeInformation);
    setCouponCodeBatchSize(couponInitial?.couponCodeBatchSize);
    setCouponCodeSource("");
    setCouponCodeSourceError(null);
    setCouponCodeBatchSizeError(null);
    codeInput.reset();
    setExtendedFieldValues(extractExtendedFields(initialData, extendedFields));
  };

  // Reset on both open and close so a different initialData repopulates correctly.
  const handleOpenChange = (newOpen: boolean) => {
    resetForm();
    onOpenChange(newOpen);
  };

  // Handle submit - build CreateOffer from form state
  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (programIds.length === 0) {
      setProgramIdsError("At least one program is required.");
      return;
    }

    // Coupon Code Source is a create-only, required discriminator (edit mode
    // renders a read-only summary instead — see describeCouponCodeSource —
    // since the pool is a one-time, create-event side effect with no
    // regenerate/backfill endpoint). Block here, before any network call,
    // the same way the programIds check above does.
    if (type === "COUPON" && mode === "create") {
      if (!couponCodeSource) {
        setCouponCodeSourceError("Choose how this offer's coupon codes will be sourced.");
        return;
      }
      if (couponCodeSource === "GENERATED" && !couponCodeBatchSize) {
        setCouponCodeBatchSizeError("A batch size is required to auto-generate coupon codes.");
        return;
      }
    }

    await submitOffer();
  };

  const submitOffer = async () => {
    // Only include description if it has content
    const hasDescription = Object.values(description).some((v) => v.trim() !== "");

    // Swallow create-suggested failures: a throw here would silently abort handleSubmit (React onSubmit can't catch async rejections); let the offer POST surface the error instead.
    if (type === "COUPON") {
      if (
        couponTypeIsSuggested &&
        couponTypeCode &&
        !couponTypeMeta.isTypeNotFound &&
        couponTypeMeta.category
      ) {
        const option = couponTypeMeta.findOption(couponTypeCode);
        if (option) {
          try {
            await couponTypeMeta.createMetadata({
              code: option.code,
              name: option.name,
              description: option.description ? { en: option.description } : undefined,
              // DATA_TYPE BE rejects without dataModelCode — only SuggestedOption carries it.
              dataModelCode: "dataModelCode" in option ? option.dataModelCode : undefined,
            });
          } catch {
            /* fall through — BE will reject the offer create with a clearer error */
          }
        }
      }
      if (
        couponCodeGroupIsSuggested &&
        couponCodeGroupCode &&
        !couponCodeGroupMeta.isTypeNotFound &&
        couponCodeGroupMeta.category
      ) {
        const option = couponCodeGroupMeta.findOption(couponCodeGroupCode);
        if (option) {
          try {
            await couponCodeGroupMeta.createMetadata({
              code: option.code,
              name: option.name,
              description: option.description ? { en: option.description } : undefined,
              dataModelCode: "dataModelCode" in option ? option.dataModelCode : undefined,
            });
          } catch {
            /* fall through — BE will reject the offer create with a clearer error */
          }
        }
      }
    }

    const formData: CreateOffer & Record<string, unknown> = {
      name,
      code: codeInput.value,
      type: type as CreateOffer["type"],
      programIds,
      // Only send customerAudienceId if the user picked one.
      customerAudienceId: customerAudienceId.trim() ? customerAudienceId : undefined,
      description: hasDescription ? description : undefined,
      durationPeriod: toStrictDurationPeriodValue(durationPeriod),
      maxOfferUses,
      maxOfferRedemptions,
      // 0 means no discount cap
      maxDiscountValue: type === "COUPON" ? (maxDiscountValue ?? 0) : undefined,
      setDateTimePeriodOnIssue,
      // COUPON-only sub-type fields. Stripped on EXTERNAL via the type guard.
      couponDiscountType:
        type === "COUPON" && couponDiscountType
          ? (couponDiscountType as CreateCouponOfferCouponDiscountType)
          : undefined,
      discountCurrencyTypeCode:
        type === "COUPON" && discountCurrencyTypeCode ? discountCurrencyTypeCode : undefined,
      couponTypeCode: type === "COUPON" && couponTypeCode ? couponTypeCode : undefined,
      couponCodeGroupCode:
        type === "COUPON" && couponCodeGroupCode ? couponCodeGroupCode : undefined,
      // In create mode, couponCodeInformation/couponCodeSource are kept in
      // sync by the "Coupon Code Source" radio group's onValueChange (below),
      // so couponCodeInformation.type is always GENERATED or PROVIDED here —
      // handleSubmit's validation guarantees couponCodeSource is non-empty
      // before this is reached. Edit mode never touches couponCodeSource (no
      // interactive control renders there — see describeCouponCodeSource), so
      // it passes couponCodeInformation/couponCodeBatchSize through as-is,
      // same as before this fix.
      couponCodeInformation: type === "COUPON" ? couponCodeInformation : undefined,
      couponCodeBatchSize:
        type === "COUPON" && (mode === "edit" || couponCodeSource === "GENERATED")
          ? couponCodeBatchSize
          : undefined,
      // Include extended field values
      ...extendedFieldValues,
    };

    await onSubmit(formData);
  };

  const handleCancel = () => {
    handleOpenChange(false);
  };

  const title = mode === "create" ? "Create Offer" : `Edit ${initialData?.name ?? "Offer"}`;
  const submitLabel = mode === "create" ? "Create Offer" : "Save Changes";

  return (
    <FormSheet
      open={open}
      onOpenChange={handleOpenChange}
      title={title}
      onSubmit={handleSubmit}
      submitDisabled={codeInput.error != null}
      onCancel={handleCancel}
      isSubmitting={isSubmitting}
      submitLabel={submitLabel}
      error={error}
      fieldErrors={fieldErrors}
    >
      <div className="space-y-6">
        {/* Name field */}
        <div className="space-y-2">
          <Label htmlFor="offer-name">
            Name <span className="text-destructive">*</span>
          </Label>
          <WithFieldError field="name">
            {(fe) => (
              <Input
                {...fe.inputProps}
                id="offer-name"
                data-widget="text-input"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter offer name"
                required
                disabled={isSubmitting}
              />
            )}
          </WithFieldError>
        </div>

        {/* Code field with auto-generation */}
        <div className="space-y-2">
          <Label htmlFor="offer-code">
            Code <span className="text-destructive">*</span>
          </Label>
          <WithFieldError field="code" hideMessage>
            {(fe) => (
              <CodeInput
                data-field={fe.inputProps["data-field"]}
                id="offer-code"
                sourceValue={name}
                value={codeInput.value}
                onChange={codeInput.onChange}
                error={fe.error ?? codeInput.error}
                format="kebab-case"
                placeholder="offer-code"
                required
                disabled={isSubmitting || mode === "edit"}
                showReset={mode === "create"}
              />
            )}
          </WithFieldError>
          {mode === "create" && (
            <p className="text-muted-foreground text-xs">
              Auto-generated from name. Edit to customize.
            </p>
          )}
        </div>

        {/* Type selector */}
        <div className="space-y-2">
          <Label id="offer-type-label" htmlFor="offer-type">
            Type <span className="text-destructive">*</span>
          </Label>
          <WithFieldError field="type" value={type}>
            {(fe) => (
              <DiscriminatorRadioGroup
                {...fe.inputProps}
                id="offer-type"
                value={type}
                onValueChange={(value) => {
                  setType(value);
                  // Reset coupon state + suggested flags: stale flag on COUPON→EXTERNAL→COUPON would re-fire createMetadata.
                  if (value !== "COUPON") {
                    setMaxDiscountValue(undefined);
                    setCouponDiscountType("");
                    setDiscountCurrencyTypeCode("");
                    setCouponTypeCode("");
                    setCouponTypeIsSuggested(false);
                    setCouponCodeGroupCode("");
                    setCouponCodeGroupIsSuggested(false);
                    setCouponCodeInformation(undefined);
                    setCouponCodeBatchSize(undefined);
                    setCouponCodeSource("");
                    setCouponCodeSourceError(null);
                    setCouponCodeBatchSizeError(null);
                  }
                }}
                options={[...OFFER_TYPE_OPTIONS]}
                disabled={isSubmitting || mode === "edit"}
                aria-labelledby="offer-type-label"
              />
            )}
          </WithFieldError>
          {mode === "edit" && (
            <p className="text-muted-foreground text-xs">
              Offer type cannot be changed after creation.
            </p>
          )}
        </div>

        {/* Programs multi-select */}
        <div className="space-y-2">
          <Label htmlFor="offer-programs">
            Programs <span className="text-destructive">*</span>
          </Label>
          <WithFieldError field="programIds" value={programIds}>
            {(fe) => (
              <ProgramMultiField
                {...fe.inputProps}
                id="offer-programs"
                value={programIds}
                onValueChange={handleProgramIdsChange}
                placeholder="Select programs..."
                disabled={isSubmitting}
                aria-required
              />
            )}
          </WithFieldError>
          {programIdsError ? (
            // role=alert is implicitly assertive; an explicit aria-live would double-announce on NVDA/JAWS.
            <p className="text-destructive text-xs" role="alert">
              {programIdsError}
            </p>
          ) : (
            <p className="text-muted-foreground text-xs">
              Associate this offer with one or more programs.
            </p>
          )}
        </div>

        {/* Customer Audience (optional) */}
        <div className="space-y-2">
          <Label htmlFor="offer-customer-audience">Customer Audience</Label>
          <WithFieldError field="customerAudienceId" value={customerAudienceId}>
            {(fe) => (
              <CustomerAudienceField
                {...fe.inputProps}
                id="offer-customer-audience"
                value={customerAudienceId}
                onValueChange={setCustomerAudienceId}
                placeholder="Select a customer audience..."
                disabled={isSubmitting}
              />
            )}
          </WithFieldError>
          <p className="text-muted-foreground text-xs">
            Target a specific audience. Leave empty to make the offer available to all customers.
          </p>
        </div>

        {/* Description with LocalizedStringInput */}
        <div className="space-y-2">
          <Label htmlFor="offer-description">Description</Label>
          <WithFieldError field="description" value={description}>
            {(fe) => (
              <LocalizedStringInput
                {...fe.inputProps}
                id="offer-description"
                value={description}
                onChange={setDescription}
                placeholder="Describe the offer and its benefits"
                multiline
                disabled={isSubmitting}
              />
            )}
          </WithFieldError>
          <p className="text-muted-foreground text-xs">
            Multi-language description of the offer. Add translations as needed.
          </p>
        </div>

        {/* Duration Period */}
        <DurationPeriodBuilder
          value={durationPeriod}
          onChange={setDurationPeriod}
          label="Duration Period"
          description="How long the offer remains valid after being issued."
          disabled={isSubmitting}
        />

        {/* Max Offer Uses */}
        <div className="space-y-2">
          <Label htmlFor="offer-max-uses">Max Offer Uses</Label>
          <WithFieldError field="maxOfferUses">
            {(fe) => (
              <Input
                {...fe.inputProps}
                id="offer-max-uses"
                data-widget="text-input"
                type="number"
                min={0}
                value={maxOfferUses ?? ""}
                onChange={(e) => {
                  const val = e.target.value;
                  setMaxOfferUses(val ? parseInt(val, 10) : undefined);
                }}
                placeholder="Unlimited"
                disabled={isSubmitting}
              />
            )}
          </WithFieldError>
          <p className="text-muted-foreground text-xs">
            Maximum number of times this offer can be issued. Leave empty for unlimited.
          </p>
        </div>

        {/* Max Offer Redemptions */}
        <div className="space-y-2">
          <Label htmlFor="offer-max-redemptions">Max Offer Redemptions</Label>
          <WithFieldError field="maxOfferRedemptions">
            {(fe) => (
              <Input
                {...fe.inputProps}
                id="offer-max-redemptions"
                data-widget="text-input"
                type="number"
                min={0}
                value={maxOfferRedemptions ?? ""}
                onChange={(e) => {
                  const val = e.target.value;
                  setMaxOfferRedemptions(val ? parseInt(val, 10) : undefined);
                }}
                placeholder="Unlimited"
                disabled={isSubmitting}
              />
            )}
          </WithFieldError>
          <p className="text-muted-foreground text-xs">
            Maximum number of times this offer can be redeemed. Leave empty for unlimited.
          </p>
        </div>

        {/* Max Discount Value (Coupon only). 0 means no discount cap. */}
        {type === "COUPON" && (
          <div className="space-y-2">
            <Label htmlFor="offer-max-discount-value">Max Discount Value</Label>
            <WithFieldError field="maxDiscountValue">
              {(fe) => (
                <Input
                  {...fe.inputProps}
                  id="offer-max-discount-value"
                  data-widget="text-input"
                  type="number"
                  min={0}
                  step="0.01"
                  value={maxDiscountValue ?? ""}
                  onChange={(e) => {
                    const val = e.target.value;
                    setMaxDiscountValue(val ? Number(val) : undefined);
                  }}
                  placeholder="Leave blank for no discount cap"
                  disabled={isSubmitting}
                />
              )}
            </WithFieldError>
            <p className="text-muted-foreground text-xs">
              Maximum discount amount for this coupon. Blank or 0 means no discount cap.
            </p>
          </div>
        )}

        {/* COUPON sub-type fields (6) */}
        {type === "COUPON" && (
          <>
            <div className="space-y-2">
              <Label htmlFor="offer-coupon-discount-type">Coupon Discount Type</Label>
              <WithFieldError field="couponDiscountType" value={couponDiscountType}>
                {(fe) => (
                  <Select
                    value={couponDiscountType}
                    onValueChange={setCouponDiscountType}
                    disabled={isSubmitting}
                  >
                    <SelectTrigger
                      {...fe.inputProps}
                      id="offer-coupon-discount-type"
                      data-widget="select"
                    >
                      <SelectValue placeholder="Select discount type" />
                    </SelectTrigger>
                    <SelectContent>
                      {COUPON_DISCOUNT_TYPE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </WithFieldError>
              <p className="text-muted-foreground text-xs">
                How the discount is applied (percentage, fixed amount, etc.).
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="offer-discount-currency-type">Discount Currency Type</Label>
              <WithFieldError field="discountCurrencyTypeCode" value={discountCurrencyTypeCode}>
                {(fe) => (
                  <MetadataField
                    {...fe.inputProps}
                    id="offer-discount-currency-type"
                    typeCode="FIAT_CURRENCY_TYPE"
                    typeLabel="Discount Currency Type"
                    value={discountCurrencyTypeCode}
                    onValueChange={(value) => setDiscountCurrencyTypeCode(value)}
                    placeholder="Select a currency..."
                    disabled={isSubmitting}
                  />
                )}
              </WithFieldError>
              <p className="text-muted-foreground text-xs">
                Currency type for the discount value (e.g., USD, EUR).
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="offer-coupon-type">Coupon Type</Label>
              <WithFieldError field="couponTypeCode" value={couponTypeCode}>
                {(fe) => (
                  <MetadataField
                    {...fe.inputProps}
                    id="offer-coupon-type"
                    typeCode="COUPON_TYPE"
                    typeLabel="Coupon Type"
                    value={couponTypeCode}
                    onValueChange={(value, isSuggested) => {
                      setCouponTypeCode(value);
                      setCouponTypeIsSuggested(isSuggested);
                    }}
                    placeholder="Select a coupon type..."
                    disabled={isSubmitting}
                    aria-describedby={
                      fe.error ? `${fe.errorId} offer-coupon-type-hint` : "offer-coupon-type-hint"
                    }
                  />
                )}
              </WithFieldError>
              <p id="offer-coupon-type-hint" className="text-muted-foreground text-xs">
                Type of coupon (data-type code).
                {couponTypeIsSuggested && (
                  <span className="text-primary ml-1">(Will be created when you save)</span>
                )}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="offer-coupon-code-group">Coupon Code Group</Label>
              <WithFieldError field="couponCodeGroupCode" value={couponCodeGroupCode}>
                {(fe) => (
                  <MetadataField
                    {...fe.inputProps}
                    id="offer-coupon-code-group"
                    typeCode="COUPON_CODE_GROUP"
                    typeLabel="Coupon Code Group"
                    value={couponCodeGroupCode}
                    onValueChange={(value, isSuggested) => {
                      setCouponCodeGroupCode(value);
                      setCouponCodeGroupIsSuggested(isSuggested);
                    }}
                    placeholder="Select a coupon code group..."
                    disabled={isSubmitting}
                    aria-describedby={
                      fe.error
                        ? `${fe.errorId} offer-coupon-code-group-hint`
                        : "offer-coupon-code-group-hint"
                    }
                  />
                )}
              </WithFieldError>
              <p id="offer-coupon-code-group-hint" className="text-muted-foreground text-xs">
                Code of the metadata group that holds this offer&apos;s coupon codes.
                {couponCodeGroupIsSuggested && (
                  <span className="text-primary ml-1">(Will be created when you save)</span>
                )}
              </p>
            </div>

            <div className="space-y-2">
              <Label id="offer-coupon-code-source-label" htmlFor="offer-coupon-code-source">
                Coupon Code Source <span className="text-destructive">*</span>
              </Label>
              {mode === "edit" ? (
                // Immutable after creation (the pool is a one-time,
                // create-event side effect with no regenerate/backfill
                // endpoint) — same reason the sibling "Offer Type" control
                // is disabled in edit mode, but here the interactive
                // 2-option RadioGroup can't represent all 5 legacy
                // CodeGenInformationType values a pre-fix offer may carry,
                // so a plain-text summary replaces it entirely rather than
                // rendering it disabled.
                <p id="offer-coupon-code-source" className="text-foreground text-sm">
                  {describeCouponCodeSource(couponCodeInformation?.type)}
                </p>
              ) : (
                <>
                  <DiscriminatorRadioGroup
                    id="offer-coupon-code-source"
                    value={couponCodeSource}
                    onValueChange={(value) => {
                      setCouponCodeSource(value);
                      setCouponCodeSourceError(null);
                      setCouponCodeBatchSizeError(null);
                      if (value === "GENERATED") {
                        setCouponCodeInformation((prev) => ({ ...prev, type: "GENERATED" }));
                      } else {
                        setCouponCodeInformation({ type: "PROVIDED" });
                        setCouponCodeBatchSize(undefined);
                      }
                    }}
                    options={[...COUPON_CODE_SOURCE_OPTIONS]}
                    disabled={isSubmitting}
                    aria-labelledby="offer-coupon-code-source-label"
                  />
                  {couponCodeSourceError && (
                    // role=alert is implicitly assertive; an explicit aria-live would double-announce on NVDA/JAWS.
                    <p className="text-destructive text-xs" role="alert">
                      {couponCodeSourceError}
                    </p>
                  )}
                </>
              )}
            </div>

            {/* GENERATED-only sub-fields + batch size, create mode only —
                gated on the "Coupon Code Source" choice above. The internal
                Code Type select is hidden (hideTypeSelector) since this
                RadioGroup is now the single source of truth for `type`. */}
            {mode === "create" && couponCodeSource === "GENERATED" && (
              <>
                <div className="space-y-2">
                  <Label>Coupon Code Generation</Label>
                  <CodeGenInformationInput
                    value={couponCodeInformation}
                    onChange={setCouponCodeInformation}
                    disabled={isSubmitting}
                    showCard={false}
                    hideTypeSelector
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="offer-coupon-code-batch-size">
                    Coupon Code Batch Size <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="offer-coupon-code-batch-size"
                    data-widget="text-input"
                    type="number"
                    min={1}
                    step={1}
                    value={couponCodeBatchSize ?? ""}
                    onChange={(e) => {
                      const val = e.target.value;
                      setCouponCodeBatchSize(val ? parseInt(val, 10) : undefined);
                      setCouponCodeBatchSizeError(null);
                    }}
                    placeholder="e.g., 1000"
                    disabled={isSubmitting}
                    aria-describedby={
                      couponCodeBatchSizeError ? "offer-coupon-code-batch-size-error" : undefined
                    }
                  />
                  {couponCodeBatchSizeError ? (
                    <p
                      id="offer-coupon-code-batch-size-error"
                      className="text-destructive text-xs"
                      role="alert"
                    >
                      {couponCodeBatchSizeError}
                    </p>
                  ) : (
                    <p className="text-muted-foreground text-xs">
                      Number of coupon codes to generate per batch.
                    </p>
                  )}
                </div>
              </>
            )}

            {/* Edit mode keeps the pre-fix CodeGenInformationInput rendering
                unchanged — its own Code Type select stays interactive there
                (out of scope for this fix; see describeCouponCodeSource's
                docstring), so it isn't gated behind couponCodeSource at all. */}
            {mode === "edit" && (
              <>
                <div className="space-y-2">
                  <Label>Coupon Code Generation</Label>
                  <CodeGenInformationInput
                    value={couponCodeInformation}
                    onChange={setCouponCodeInformation}
                    disabled={isSubmitting}
                    showCard={false}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="offer-coupon-code-batch-size">Coupon Code Batch Size</Label>
                  <Input
                    id="offer-coupon-code-batch-size"
                    data-widget="text-input"
                    type="number"
                    min={1}
                    step={1}
                    value={couponCodeBatchSize ?? ""}
                    onChange={(e) => {
                      const val = e.target.value;
                      setCouponCodeBatchSize(val ? parseInt(val, 10) : undefined);
                    }}
                    placeholder="e.g., 1000"
                    disabled={isSubmitting}
                  />
                  <p className="text-muted-foreground text-xs">
                    Number of coupon codes to generate per batch.
                  </p>
                </div>
              </>
            )}
          </>
        )}

        {/* Set DateTime Period on Issue */}
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-0.5">
            <Label htmlFor="offer-set-datetime">Set Date/Time Period on Issue</Label>
            <p className="text-muted-foreground text-xs">
              Automatically set the validity period when the offer is issued to a customer.
            </p>
          </div>
          <Switch
            id="offer-set-datetime"
            data-widget="switch"
            checked={setDateTimePeriodOnIssue}
            onCheckedChange={setSetDateTimePeriodOnIssue}
            disabled={isSubmitting}
          />
        </div>

        {/* Extended Fields Section (from data model extensions) */}
        {schema && extendedFields.length > 0 && (
          <ExtendedFieldsSection
            schema={schema}
            fields={extendedFields}
            data={extendedFieldValues}
            mode="edit"
            onChange={handleExtendedFieldChange}
            title="Additional Information"
            defaultCollapsed={false}
          />
        )}
      </div>
    </FormSheet>
  );
}
