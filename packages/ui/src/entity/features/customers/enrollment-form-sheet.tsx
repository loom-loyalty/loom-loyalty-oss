/**
 * EnrollmentFormSheet — Create/edit program enrollment form sheet
 *
 * Uses the FormSheet pattern for enrolling a customer in a program
 * or editing an existing enrollment. Fields: program selector (create only),
 * status, enrollment date, optional external account ID.
 */

"use client";

import { useState, type FormEvent, type ReactNode } from "react";

import { WithFieldError, type FormFieldError } from "../../../forms/field-errors.js";
import { FormSheet, type FormSheetError } from "../../../forms/form-sheet.js";
import { Input } from "../../../primitives/input.js";
import { Label } from "../../../primitives/label.js";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../primitives/select.js";
import type { CustomerProgram } from "./types.js";

/** Format a Date as YYYY-MM-DDTHH:mm in local timezone for datetime-local inputs */
function toLocalDateTimeString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const h = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${d}T${h}:${min}`;
}

export interface EnrollmentFormSheetProps {
  /** Whether the sheet is open */
  open: boolean;
  /** Handler for open state changes */
  onOpenChange: (open: boolean) => void;
  /** Whether creating a new enrollment or editing an existing one */
  mode: "create" | "edit";
  /** Initial data for edit mode */
  initialData?: Partial<CustomerProgram>;
  /** Form submit handler */
  onSubmit: (data: {
    programId?: string;
    programCode?: string;
    customerProgramStatusCode: string;
    enrollmentDateTime?: string;
    programAccountExternalId?: string;
  }) => Promise<void>;
  /** Whether the form is submitting */
  isSubmitting?: boolean;
  /** Error to display; a `describeError` result also shows its support reference */
  error?: FormSheetError | null;
  /** Server field errors; each shows under its field, the rest with `error` */
  fieldErrors?: readonly FormFieldError[];
  /**
   * Render a custom program selector.
   * In create mode, this allows the consumer to inject a ProgramField.
   */
  renderProgramSelector?: (
    value: string,
    onValueChange: (programId: string) => void,
    disabled: boolean
  ) => ReactNode;
}

/** Status options for customer program enrollment */
const STATUS_OPTIONS = [
  { value: "ACTIVE", label: "Active" },
  { value: "INACTIVE", label: "Inactive" },
  { value: "SUSPENDED", label: "Suspended" },
];

/**
 * Sheet form for enrolling a customer in a program or editing an enrollment.
 */
export function EnrollmentFormSheet({
  open,
  onOpenChange,
  mode,
  initialData,
  onSubmit,
  isSubmitting = false,
  error,
  fieldErrors,
  renderProgramSelector,
}: EnrollmentFormSheetProps): ReactNode {
  const [programId, setProgramId] = useState(initialData?.programId ?? "");
  const [programCode, setProgramCode] = useState(initialData?.programCode ?? "");
  const [statusCode, setStatusCode] = useState(initialData?.status ?? "ACTIVE");
  const [enrollmentDateTime, setEnrollmentDateTime] = useState(
    initialData?.registrationDate
      ? toLocalDateTimeString(new Date(initialData.registrationDate))
      : toLocalDateTimeString(new Date())
  );
  const [externalId, setExternalId] = useState(initialData?.programAccountExternalId ?? "");

  const resetForm = () => {
    setProgramId(initialData?.programId ?? "");
    setProgramCode(initialData?.programCode ?? "");
    setStatusCode(initialData?.status ?? "ACTIVE");
    setEnrollmentDateTime(
      initialData?.registrationDate
        ? toLocalDateTimeString(new Date(initialData.registrationDate))
        : toLocalDateTimeString(new Date())
    );
    setExternalId(initialData?.programAccountExternalId ?? "");
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) resetForm();
    onOpenChange(newOpen);
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    await onSubmit({
      programId: programId || undefined,
      programCode: programCode || undefined,
      customerProgramStatusCode: statusCode,
      enrollmentDateTime: enrollmentDateTime
        ? new Date(enrollmentDateTime).toISOString()
        : undefined,
      programAccountExternalId: externalId || undefined,
    });
  };

  const handleCancel = () => {
    handleOpenChange(false);
  };

  const title = mode === "create" ? "Enroll in Program" : "Edit Program Enrollment";
  const submitLabel = mode === "create" ? "Enroll" : "Save Changes";

  return (
    <FormSheet
      open={open}
      onOpenChange={handleOpenChange}
      title={title}
      onSubmit={handleSubmit}
      onCancel={handleCancel}
      isSubmitting={isSubmitting}
      submitLabel={submitLabel}
      error={error}
      fieldErrors={fieldErrors}
    >
      <div className="space-y-6">
        {/* Program Selector (create mode only) */}
        {mode === "create" && (
          <div className="space-y-2">
            <Label htmlFor="enrollment-program">
              Program <span className="text-destructive">*</span>
            </Label>
            {renderProgramSelector ? (
              renderProgramSelector(programId, setProgramId, isSubmitting)
            ) : (
              <WithFieldError field="programCode">
                {(fe) => (
                  <Input
                    {...fe.inputProps}
                    id="enrollment-program"
                    value={programCode}
                    onChange={(e) => setProgramCode(e.target.value)}
                    placeholder="Enter program code"
                    required
                    disabled={isSubmitting}
                  />
                )}
              </WithFieldError>
            )}
          </div>
        )}

        {/* Edit mode: Show program info (read-only) */}
        {mode === "edit" && initialData?.programName && (
          <div className="space-y-2">
            <Label>Program</Label>
            <p className="text-foreground text-sm font-medium">{initialData.programName}</p>
            <p className="text-muted-foreground font-mono text-xs">{initialData.programCode}</p>
          </div>
        )}

        {/* Status */}
        <div className="space-y-2">
          <Label htmlFor="enrollment-status">
            Status <span className="text-destructive">*</span>
          </Label>
          <WithFieldError field="customerProgramStatusCode" value={statusCode}>
            {(fe) => (
              <Select
                value={statusCode}
                onValueChange={(val) => setStatusCode(val as "ACTIVE" | "INACTIVE" | "SUSPENDED")}
                disabled={isSubmitting}
              >
                <SelectTrigger {...fe.inputProps} id="enrollment-status">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </WithFieldError>
        </div>

        {/* Enrollment DateTime */}
        <div className="space-y-2">
          <Label htmlFor="enrollment-datetime">Enrollment Date</Label>
          <WithFieldError field="enrollmentDateTime">
            {(fe) => (
              <Input
                {...fe.inputProps}
                id="enrollment-datetime"
                type="datetime-local"
                value={enrollmentDateTime}
                onChange={(e) => setEnrollmentDateTime(e.target.value)}
                disabled={isSubmitting}
              />
            )}
          </WithFieldError>
          <p className="text-muted-foreground text-xs">
            When the customer enrolled in the program.
          </p>
        </div>

        {/* External Account ID */}
        <div className="space-y-2">
          <Label htmlFor="enrollment-external-id">External Account ID</Label>
          <WithFieldError field="programAccountExternalId">
            {(fe) => (
              <Input
                {...fe.inputProps}
                id="enrollment-external-id"
                value={externalId}
                onChange={(e) => setExternalId(e.target.value)}
                placeholder="e.g., membership number"
                disabled={isSubmitting}
              />
            )}
          </WithFieldError>
          <p className="text-muted-foreground text-xs">
            Optional external identifier for the customer&apos;s account in this program.
          </p>
        </div>
      </div>
    </FormSheet>
  );
}
