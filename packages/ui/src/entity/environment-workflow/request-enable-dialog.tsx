/**
 * RequestEnableDialog
 *
 * Dialog component for requesting to enable an entity in an environment.
 * Used across all entity types. Uses inline error messaging, not toasts.
 */

import { Loader2, Send } from "lucide-react";
import { useCallback, useState, type FormEvent, type ReactNode } from "react";
import { cn } from "../../lib/utils.js";
import { Button } from "../../primitives/button.js";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../primitives/dialog.js";
import { Input } from "../../primitives/input.js";
import { Label } from "../../primitives/label.js";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../primitives/select.js";
import { Textarea } from "../../primitives/textarea.js";
import { AiVerificationCheckbox } from "./ai-verification-checkbox.js";
import {
  AI_VERIFICATION_COPY,
  AI_VERIFICATION_ENTITY_TYPES,
  isAiVerificationRequiredEntityType,
} from "./ai-verification.js";

export { AI_VERIFICATION_COPY, AI_VERIFICATION_ENTITY_TYPES, isAiVerificationRequiredEntityType };

/**
 * Environment option for the target environment select
 */
export interface EnvironmentOption {
  id: string;
  code: string;
  name?: string;
}

export interface RequestEnableDialogProps {
  /** Type code of the entity (e.g. "tier", "program") */
  entityType: string;
  /** ID of the entity */
  entityId: string;
  /** Display name of the entity */
  entityName: string;
  /** Available environments to enable in */
  environments: EnvironmentOption[];
  /** IDs of environments already enabled */
  currentEnvironmentIds?: string[];
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when dialog open state changes */
  onOpenChange: (open: boolean) => void;
  /** Submit handler - returns a promise for async operations */
  onSubmit: (data: RequestEnableFormData) => Promise<void>;
  /** Whether submission is in progress */
  isSubmitting?: boolean;
}

export interface RequestEnableFormData {
  targetEnvironmentId: string;
  environmentCode: string;
  startDateTime: string;
  endDateTime?: string;
  timeZone: string;
  reason: string;
}

/**
 * Dialog for requesting entity enablement in an environment.
 * Follows inline error messaging pattern (no toasts).
 */
export function RequestEnableDialog({
  entityType,
  entityName,
  environments,
  currentEnvironmentIds = [],
  open,
  onOpenChange,
  onSubmit,
  isSubmitting = false,
}: RequestEnableDialogProps): ReactNode {
  const [targetEnvironmentId, setTargetEnvironmentId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [verificationAcknowledged, setVerificationAcknowledged] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requiresVerification = isAiVerificationRequiredEntityType(entityType);

  // Filter out already-enabled environments
  const availableEnvironments = environments.filter(
    (env) => !currentEnvironmentIds.includes(env.id)
  );

  const resetForm = useCallback(() => {
    setTargetEnvironmentId("");
    setStartDate("");
    setEndDate("");
    setReason("");
    setVerificationAcknowledged(false);
    setError(null);
  }, []);

  const handleClose = useCallback(() => {
    resetForm();
    onOpenChange(false);
  }, [resetForm, onOpenChange]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!targetEnvironmentId) {
      setError("Please select a target environment.");
      return;
    }
    if (!startDate) {
      setError("Please select a start date.");
      return;
    }
    if (reason.length < 10) {
      setError("Business justification must be at least 10 characters.");
      return;
    }
    if (requiresVerification && !verificationAcknowledged) {
      setError("Please confirm you have reviewed and verified this AI-generated output.");
      return;
    }

    const selectedEnv = environments.find((e) => e.id === targetEnvironmentId);

    // Reject a forged attestation on entity types that don't require one —
    // otherwise a user could type the exact attestation sentence into the
    // free-text justification and produce a record indistinguishable from a
    // real one for an entity type the checkbox never gated.
    const reasonClaimsVerification = reason.includes(AI_VERIFICATION_COPY);
    if (!requiresVerification && reasonClaimsVerification) {
      setError(
        `Business justification cannot include "${AI_VERIFICATION_COPY}" for entity types that don't require verification.`
      );
      return;
    }

    // Interim attestation visibility (KTD2): until a durable, structured
    // verification record exists (#719), append a fixed line to the reason
    // text so approvers see it. Only applies when the checkbox was actually
    // required and checked for this submission, and only once — a retried
    // submission after a failure must not double-append.
    const submittedReason =
      requiresVerification && verificationAcknowledged && !reasonClaimsVerification
        ? `${reason}\n\n${AI_VERIFICATION_COPY}`
        : reason;

    try {
      await onSubmit({
        targetEnvironmentId,
        environmentCode: selectedEnv?.code ?? "",
        startDateTime: new Date(startDate).toISOString(),
        endDateTime: endDate ? new Date(endDate).toISOString() : undefined,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        reason: submittedReason,
      });
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit request");
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) handleClose();
      }}
    >
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Enable in Environment</DialogTitle>
          <DialogDescription>
            Request to enable &ldquo;{entityName}&rdquo; in a new environment. This will create a
            workflow request that requires approval.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Target Environment */}
          <div className="space-y-2">
            <Label htmlFor="target-env">
              Target Environment <span className="text-destructive">*</span>
            </Label>
            <Select
              value={targetEnvironmentId}
              onValueChange={setTargetEnvironmentId}
              disabled={isSubmitting}
            >
              <SelectTrigger id="target-env">
                <SelectValue placeholder="Select an environment" />
              </SelectTrigger>
              <SelectContent>
                {availableEnvironments.length === 0 ? (
                  <div className="text-muted-foreground p-2 text-center text-sm">
                    No available environments
                  </div>
                ) : (
                  availableEnvironments.map((env) => (
                    <SelectItem key={env.id} value={env.id}>
                      {env.name || env.code}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            <p className="text-muted-foreground text-xs">
              The environment where this entity will be enabled
            </p>
          </div>

          {/* Start Date */}
          <div className="space-y-2">
            <Label htmlFor="start-date">
              Start Date <span className="text-destructive">*</span>
            </Label>
            <Input
              id="start-date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              disabled={isSubmitting}
              required
              className={cn(!startDate && "text-muted-foreground")}
            />
            <p className="text-muted-foreground text-xs">
              When the entity should become active in the environment
            </p>
          </div>

          {/* End Date (Optional) */}
          <div className="space-y-2">
            <Label htmlFor="end-date">End Date (Optional)</Label>
            <Input
              id="end-date"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              disabled={isSubmitting}
              min={startDate || undefined}
              className={cn(!endDate && "text-muted-foreground")}
            />
            <p className="text-muted-foreground text-xs">Leave empty for indefinite enablement</p>
          </div>

          {/* Business Justification */}
          <div className="space-y-2">
            <Label htmlFor="reason">
              Business Justification <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="reason"
              placeholder="Explain why this entity needs to be enabled in this environment..."
              className="resize-none"
              rows={4}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={isSubmitting}
              required
            />
            <p className="text-muted-foreground text-xs">
              Provide context for approvers (minimum 10 characters)
            </p>
          </div>

          {/* AI output verification */}
          {requiresVerification && (
            <AiVerificationCheckbox
              id="ai-output-verified"
              checked={verificationAcknowledged}
              onCheckedChange={setVerificationAcknowledged}
              disabled={isSubmitting}
            />
          )}

          {/* Inline error */}
          {error && (
            <div
              className="border-destructive/30 bg-destructive/5 rounded-lg border p-3"
              role="alert"
            >
              <p className="text-destructive text-sm">{error}</p>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary-gradient"
              disabled={
                isSubmitting ||
                availableEnvironments.length === 0 ||
                (requiresVerification && !verificationAcknowledged)
              }
            >
              {isSubmitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              Submit Request
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
