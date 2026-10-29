"use client";

/**
 * CustomerFormSheet - Sheet component for creating/editing Customers
 *
 * Wraps FormSheet with customer-specific form fields and logic.
 * Features polymorphic identity toggle (Individual vs Corporate),
 * contact fields, metadata-driven selects, and extended fields.
 *
 * Identity type is immutable in edit mode.
 */

import type {
  CreateCustomer as SDKCreateCustomer,
  Customer as SDKCustomer,
  UpdateCustomer as SDKUpdateCustomer,
} from "@loom-loyalty/sdk";
import { useState, type FormEvent, type ReactNode } from "react";
import { CodeInput, useCodeInput } from "../../../forms/code-input.js";
import { WithFieldError } from "../../../forms/field-errors.js";
import { FormSheet } from "../../../forms/form-sheet.js";
import { MetadataField, useMetadataField } from "../../../forms/metadata-field/index.js";
import { Badge } from "../../../primitives/badge.js";
import { Input } from "../../../primitives/input.js";
import { Label } from "../../../primitives/label.js";
import { ToggleGroup, ToggleGroupItem } from "../../../primitives/toggle-group.js";
import { extractExtendedFields } from "../../entity-field-utils.js";
import { ExtendedFieldsSection } from "../../extended-fields-section.js";
import { getSDKCustomerName, type CustomerFormSheetProps } from "./types.js";

type IdentityType = "individual" | "corporate";

/**
 * Determine identity type from an existing SDK Customer.
 */
function resolveIdentityType(customer?: SDKCustomer): IdentityType {
  if (!customer) return "individual";
  const c = customer as Record<string, unknown>;
  const identity = c.identity as { firstName?: string } | undefined;
  if (identity?.firstName) return "individual";
  const corpIdentity = c.corporateIdentity as { companyName?: string } | undefined;
  if (corpIdentity?.companyName) return "corporate";
  return "individual";
}

/**
 * Extract initial field values from an existing SDK Customer for editing.
 */
function extractInitialValues(customer?: SDKCustomer) {
  if (!customer) {
    return {
      firstName: "",
      middleName: "",
      lastName: "",
      birthDate: "",
      genderCode: "",
      companyName: "",
      email: "",
      phone: "",
      statusCode: "",
      fraudStatusCode: "",
      enrollmentCode: "",
      externalId: "",
    };
  }

  const c = customer as Record<string, unknown>;
  const identity = c.identity as
    | {
        firstName?: string;
        middleName?: string;
        lastName?: string;
        birthDate?: string;
        genderCode?: string;
      }
    | undefined;
  const corpIdentity = c.corporateIdentity as
    | { companyName?: string; companyCode?: string }
    | undefined;
  const status = c.status as { code?: string } | undefined;
  const fraudStatus = c.fraudStatus as { code?: string } | undefined;
  const enrollment = c.enrollment as { code?: string } | undefined;
  const emailAddresses = c.emailAddresses as
    | Array<{ emailAddress?: string; primary?: boolean }>
    | undefined;
  const phoneNumbers = c.phoneNumbers as
    | Array<{ number?: string; formattedNumber?: string; primary?: boolean }>
    | undefined;

  const primaryEmail = emailAddresses?.find((e) => e.primary) ?? emailAddresses?.[0];
  const primaryPhone = phoneNumbers?.find((p) => p.primary) ?? phoneNumbers?.[0];

  return {
    firstName: identity?.firstName ?? "",
    middleName: identity?.middleName ?? "",
    lastName: identity?.lastName ?? "",
    birthDate: identity?.birthDate ?? "",
    genderCode: identity?.genderCode ?? "",
    companyName: corpIdentity?.companyName ?? "",
    email: primaryEmail?.emailAddress ?? "",
    phone: primaryPhone?.number ?? primaryPhone?.formattedNumber ?? "",
    statusCode: (c.statusCode as string) ?? status?.code ?? "",
    fraudStatusCode: (c.fraudStatusCode as string) ?? fraudStatus?.code ?? "",
    enrollmentCode: (c.enrollmentCode as string) ?? enrollment?.code ?? "",
    externalId: (c.externalId as string) ?? "",
  };
}

/**
 * Sheet component for creating and editing Customers.
 *
 * @example
 * ```tsx
 * <CustomerFormSheet
 *   open={createOpen}
 *   onOpenChange={setCreateOpen}
 *   mode="create"
 *   onSubmit={handleCreate}
 *   isSubmitting={createMutation.isPending}
 * />
 * ```
 */
export function CustomerFormSheet({
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
}: CustomerFormSheetProps): ReactNode {
  // Local error state for metadata auto-creation failures
  const [localError, setLocalError] = useState<string | null>(null);

  // Identity type toggle state
  const [identityType, setIdentityType] = useState<IdentityType>(() =>
    resolveIdentityType(initialData)
  );

  // Form field state
  const initial = extractInitialValues(initialData);
  const [firstName, setFirstName] = useState(initial.firstName);
  const [middleName, setMiddleName] = useState(initial.middleName);
  const [lastName, setLastName] = useState(initial.lastName);
  const [birthDate, setBirthDate] = useState(initial.birthDate);
  const [genderCode, setGenderCode] = useState(initial.genderCode);
  const [companyName, setCompanyName] = useState(initial.companyName);
  const [email, setEmail] = useState(initial.email);
  const [phone, setPhone] = useState(initial.phone);
  const [statusCode, setStatusCode] = useState(initial.statusCode);
  const [fraudStatusCode, setFraudStatusCode] = useState(initial.fraudStatusCode);
  const [enrollmentCode, setEnrollmentCode] = useState(initial.enrollmentCode);
  const [externalId, setExternalId] = useState(initial.externalId);

  // Suggested metadata tracking — auto-create when submitting
  const [statusIsSuggested, setStatusIsSuggested] = useState(false);
  const [fraudStatusIsSuggested, setFraudStatusIsSuggested] = useState(false);
  const [enrollmentIsSuggested, setEnrollmentIsSuggested] = useState(false);
  const [genderIsSuggested, setGenderIsSuggested] = useState(false);

  const statusMeta = useMetadataField("CUSTOMER_STATUS");
  const fraudStatusMeta = useMetadataField("CUSTOMER_FRAUD_STATUS");
  const enrollmentMeta = useMetadataField("ENROLLMENT_TYPE");
  const genderMeta = useMetadataField("GENDER");

  // Company code auto-generation
  const companyCode = useCodeInput(companyName, {
    format: "kebab-case",
    initialValue: (initialData as { corporateIdentity?: { companyCode?: string } } | undefined)
      ?.corporateIdentity?.companyCode,
    locked: mode === "edit",
  });

  // Extended fields state
  const [extendedFieldValues, setExtendedFieldValues] = useState<Record<string, unknown>>(() =>
    extractExtendedFields(initialData, extendedFields)
  );

  const handleExtendedFieldChange = (field: string, value: unknown) => {
    setExtendedFieldValues((prev) => ({ ...prev, [field]: value }));
  };

  // Reset form state
  const resetForm = () => {
    setLocalError(null);
    const vals = extractInitialValues(initialData);
    setIdentityType(resolveIdentityType(initialData));
    setFirstName(vals.firstName);
    setMiddleName(vals.middleName);
    setLastName(vals.lastName);
    setBirthDate(vals.birthDate);
    setGenderCode(vals.genderCode);
    setCompanyName(vals.companyName);
    setEmail(vals.email);
    setPhone(vals.phone);
    setStatusCode(vals.statusCode);
    setFraudStatusCode(vals.fraudStatusCode);
    setEnrollmentCode(vals.enrollmentCode);
    setExternalId(vals.externalId);
    setStatusIsSuggested(false);
    setFraudStatusIsSuggested(false);
    setEnrollmentIsSuggested(false);
    setGenderIsSuggested(false);
    companyCode.reset();

    setExtendedFieldValues(extractExtendedFields(initialData, extendedFields));
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      resetForm();
    }
    onOpenChange(newOpen);
  };

  const handleCancel = () => {
    handleOpenChange(false);
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLocalError(null);

    // Auto-create suggested metadata entries before entity submission
    const metadataCreations: Array<{
      code: string;
      isSuggested: boolean;
      meta: typeof statusMeta;
    }> = [
      { code: statusCode, isSuggested: statusIsSuggested, meta: statusMeta },
      { code: fraudStatusCode, isSuggested: fraudStatusIsSuggested, meta: fraudStatusMeta },
      { code: enrollmentCode, isSuggested: enrollmentIsSuggested, meta: enrollmentMeta },
      { code: genderCode, isSuggested: genderIsSuggested, meta: genderMeta },
    ];

    try {
      for (const { code, isSuggested, meta } of metadataCreations) {
        if (code && isSuggested && !meta.isTypeNotFound && !meta.findOption(code)) {
          await meta.createMetadata({ code, name: code });
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to create metadata option";
      setLocalError(`Metadata creation failed: ${msg}`);
      return;
    }

    // Don't send suggested codes when the metadata type doesn't exist —
    // the backend can't resolve them and will return a 400 error.
    const resolvedStatusCode =
      statusIsSuggested && statusMeta.isTypeNotFound ? undefined : statusCode;
    const resolvedFraudStatusCode =
      fraudStatusIsSuggested && fraudStatusMeta.isTypeNotFound ? undefined : fraudStatusCode;
    const resolvedEnrollmentCode =
      enrollmentIsSuggested && enrollmentMeta.isTypeNotFound ? undefined : enrollmentCode;
    const resolvedGenderCode =
      genderIsSuggested && genderMeta.isTypeNotFound ? undefined : genderCode;

    const formData = {
      statusCode: resolvedStatusCode || undefined,
      fraudStatusCode: resolvedFraudStatusCode || undefined,
      enrollmentCode: resolvedEnrollmentCode || undefined,
      externalId: externalId || undefined,
      ...(identityType === "individual"
        ? {
            identity: {
              firstName,
              middleName: middleName || undefined,
              lastName: lastName || undefined,
              birthDate: birthDate || undefined,
              genderCode: resolvedGenderCode || undefined,
            },
          }
        : {
            corporateIdentity: {
              companyName,
              companyCode: companyCode.value || undefined,
            },
          }),
      ...(email
        ? {
            emailAddresses: [
              { emailAddress: email, typeCode: "OTHER", status: "ACTIVE", primary: true },
            ],
          }
        : {}),
      ...(phone
        ? { phoneNumbers: [{ number: phone, typeCode: "OTHER", status: "ACTIVE", primary: true }] }
        : {}),
      ...extendedFieldValues,
    } as unknown as SDKCreateCustomer | SDKUpdateCustomer;

    await onSubmit(formData);
  };

  const title =
    mode === "create"
      ? "Create Customer"
      : `Edit ${initialData ? getSDKCustomerName(initialData) : "Customer"}`;
  const submitLabel = mode === "create" ? "Create Customer" : "Save Changes";

  return (
    <FormSheet
      open={open}
      onOpenChange={handleOpenChange}
      title={title}
      onSubmit={handleSubmit}
      onCancel={handleCancel}
      isSubmitting={isSubmitting}
      submitLabel={submitLabel}
      error={localError ?? error}
      fieldErrors={fieldErrors}
    >
      <div className="space-y-6">
        {/* Identity Type Toggle */}
        <fieldset className="space-y-2">
          <Label asChild>
            <legend>
              Identity Type <span className="text-destructive">*</span>
            </legend>
          </Label>
          <ToggleGroup
            id="customer-identity-type"
            type="single"
            value={identityType}
            onValueChange={(val) => {
              if (val) setIdentityType(val as IdentityType);
            }}
            disabled={isSubmitting || mode === "edit"}
            aria-label="Identity type"
            data-discriminator="true"
            className="w-full"
          >
            <ToggleGroupItem value="individual" className="flex-1">
              Individual
            </ToggleGroupItem>
            <ToggleGroupItem value="corporate" className="flex-1">
              Corporate
            </ToggleGroupItem>
          </ToggleGroup>
          {mode === "edit" && (
            <p className="text-muted-foreground text-xs">
              Identity type cannot be changed after creation.
            </p>
          )}
        </fieldset>

        {/* Identity Fields - Individual */}
        {identityType === "individual" && (
          <section aria-label="Individual identity" className="space-y-4">
            <div className="flex items-center gap-2">
              <h3 className="text-foreground text-sm font-semibold">Individual Identity</h3>
              <Badge variant="outline" className="text-xs font-normal">
                Person
              </Badge>
            </div>

            <div className="space-y-2">
              <Label htmlFor="customer-first-name">
                First Name <span className="text-destructive">*</span>
              </Label>
              <WithFieldError field="identity.firstName">
                {(fe) => (
                  <Input
                    {...fe.inputProps}
                    id="customer-first-name"
                    data-widget="text-input"
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Enter first name"
                    required
                    disabled={isSubmitting}
                  />
                )}
              </WithFieldError>
            </div>

            <div className="space-y-2">
              <Label htmlFor="customer-middle-name">Middle Name</Label>
              <WithFieldError field="identity.middleName">
                {(fe) => (
                  <Input
                    {...fe.inputProps}
                    id="customer-middle-name"
                    data-widget="text-input"
                    type="text"
                    value={middleName}
                    onChange={(e) => setMiddleName(e.target.value)}
                    placeholder="Enter middle name"
                    disabled={isSubmitting}
                  />
                )}
              </WithFieldError>
            </div>

            <div className="space-y-2">
              <Label htmlFor="customer-last-name">Last Name</Label>
              <WithFieldError field="identity.lastName">
                {(fe) => (
                  <Input
                    {...fe.inputProps}
                    id="customer-last-name"
                    data-widget="text-input"
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Enter last name"
                    disabled={isSubmitting}
                  />
                )}
              </WithFieldError>
            </div>

            <div className="space-y-2">
              <Label htmlFor="customer-birth-date">Birth Date</Label>
              <WithFieldError field="identity.birthDate">
                {(fe) => (
                  <Input
                    {...fe.inputProps}
                    id="customer-birth-date"
                    data-widget="text-input"
                    type="date"
                    value={birthDate}
                    onChange={(e) => setBirthDate(e.target.value)}
                    disabled={isSubmitting}
                  />
                )}
              </WithFieldError>
            </div>

            <div className="space-y-2">
              <Label htmlFor="customer-gender">Gender</Label>
              <WithFieldError field="identity.genderCode" value={genderCode}>
                {(fe) => (
                  <MetadataField
                    {...fe.inputProps}
                    id="customer-gender"
                    typeCode="GENDER"
                    typeLabel="Gender"
                    value={genderCode}
                    onValueChange={(value, isSuggested) => {
                      setGenderCode(value);
                      setGenderIsSuggested(isSuggested);
                    }}
                    placeholder="Select gender..."
                    disabled={isSubmitting}
                  />
                )}
              </WithFieldError>
            </div>
          </section>
        )}

        {/* Identity Fields - Corporate */}
        {identityType === "corporate" && (
          <section aria-label="Corporate identity" className="space-y-4">
            <div className="flex items-center gap-2">
              <h3 className="text-foreground text-sm font-semibold">Corporate Identity</h3>
              <Badge variant="outline" className="text-xs font-normal">
                Company
              </Badge>
            </div>

            <div className="space-y-2">
              <Label htmlFor="customer-company-name">
                Company Name <span className="text-destructive">*</span>
              </Label>
              <WithFieldError field="corporateIdentity.companyName">
                {(fe) => (
                  <Input
                    {...fe.inputProps}
                    id="customer-company-name"
                    data-widget="text-input"
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="Enter company name"
                    required
                    disabled={isSubmitting}
                  />
                )}
              </WithFieldError>
            </div>

            <div className="space-y-2">
              <Label htmlFor="customer-company-code">Company Code</Label>
              <WithFieldError field="corporateIdentity.companyCode" hideMessage>
                {(fe) => (
                  <CodeInput
                    data-field={fe.inputProps["data-field"]}
                    error={fe.error}
                    id="customer-company-code"
                    sourceValue={companyName}
                    value={companyCode.value}
                    onChange={companyCode.onChange}
                    format="kebab-case"
                    placeholder="company-code"
                    disabled={isSubmitting || mode === "edit"}
                    showReset={mode === "create"}
                  />
                )}
              </WithFieldError>
              {mode === "create" && (
                <p className="text-muted-foreground text-xs">
                  Auto-generated from company name. Edit to customize.
                </p>
              )}
            </div>
          </section>
        )}

        {/* Contact Information */}
        <section aria-label="Contact information" className="space-y-4">
          <h3 className="text-foreground text-sm font-semibold">Contact</h3>

          <div className="space-y-2">
            <Label htmlFor="customer-email">Email</Label>
            <WithFieldError field="emailAddresses[0].emailAddress">
              {(fe) => (
                <Input
                  {...fe.inputProps}
                  id="customer-email"
                  data-widget="text-input"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="customer@example.com"
                  disabled={isSubmitting}
                />
              )}
            </WithFieldError>
          </div>

          <div className="space-y-2">
            <Label htmlFor="customer-phone">Phone</Label>
            <WithFieldError field="phoneNumbers[0].number">
              {(fe) => (
                <Input
                  {...fe.inputProps}
                  id="customer-phone"
                  data-widget="text-input"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1 (555) 123-4567"
                  disabled={isSubmitting}
                />
              )}
            </WithFieldError>
          </div>
        </section>

        {/* Status & Enrollment */}
        <section aria-label="Status and enrollment" className="space-y-4">
          <h3 className="text-foreground text-sm font-semibold">Status & Enrollment</h3>

          <div className="space-y-2">
            <Label htmlFor="customer-status">
              Status <span className="text-destructive">*</span>
            </Label>
            <WithFieldError field="statusCode" value={statusCode}>
              {(fe) => (
                <MetadataField
                  {...fe.inputProps}
                  id="customer-status"
                  typeCode="CUSTOMER_STATUS"
                  typeLabel="Customer Status"
                  value={statusCode}
                  onValueChange={(value, isSuggested) => {
                    setStatusCode(value);
                    setStatusIsSuggested(isSuggested);
                  }}
                  placeholder="Select status..."
                  disabled={isSubmitting}
                />
              )}
            </WithFieldError>
          </div>

          <div className="space-y-2">
            <Label htmlFor="customer-fraud-status">Fraud Status</Label>
            <WithFieldError field="fraudStatusCode" value={fraudStatusCode}>
              {(fe) => (
                <MetadataField
                  {...fe.inputProps}
                  id="customer-fraud-status"
                  typeCode="CUSTOMER_FRAUD_STATUS"
                  typeLabel="Fraud Status"
                  value={fraudStatusCode}
                  onValueChange={(value, isSuggested) => {
                    setFraudStatusCode(value);
                    setFraudStatusIsSuggested(isSuggested);
                  }}
                  placeholder="Select fraud status..."
                  disabled={isSubmitting}
                />
              )}
            </WithFieldError>
          </div>

          <div className="space-y-2">
            <Label htmlFor="customer-enrollment">Enrollment Channel</Label>
            <WithFieldError field="enrollmentCode" value={enrollmentCode}>
              {(fe) => (
                <MetadataField
                  {...fe.inputProps}
                  id="customer-enrollment"
                  typeCode="ENROLLMENT_TYPE"
                  typeLabel="Enrollment Channel"
                  value={enrollmentCode}
                  onValueChange={(value, isSuggested) => {
                    setEnrollmentCode(value);
                    setEnrollmentIsSuggested(isSuggested);
                  }}
                  placeholder="Select enrollment channel..."
                  disabled={isSubmitting}
                />
              )}
            </WithFieldError>
          </div>

          <div className="space-y-2">
            <Label htmlFor="customer-external-id">External ID</Label>
            <WithFieldError field="externalId">
              {(fe) => (
                <Input
                  {...fe.inputProps}
                  id="customer-external-id"
                  data-widget="text-input"
                  type="text"
                  value={externalId}
                  onChange={(e) => setExternalId(e.target.value)}
                  placeholder="External system identifier"
                  disabled={isSubmitting}
                />
              )}
            </WithFieldError>
            <p className="text-muted-foreground text-xs">
              Optional identifier from an external system.
            </p>
          </div>
        </section>

        {/* Extended Fields */}
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

export type { CustomerFormSheetProps };
