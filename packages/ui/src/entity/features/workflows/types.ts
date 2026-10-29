/**
 * Workflow Types
 *
 * Type definitions for workflow management UI components.
 */

import type { UIEntitySchema } from "@loom-loyalty/schema";
import type { FormFieldError } from "../../../forms/field-errors.js";
import type { FormSheetError } from "../../../forms/form-sheet.js";

// ============================================================================
// Workflow Step Types
// ============================================================================

export type WorkflowStepType =
  | "USER_APPROVAL"
  | "GROUP_APPROVAL"
  | "AUTOMATIC_APPROVAL"
  | "CONDITIONAL_APPROVAL";

export type WorkflowStepStatus = "PENDING" | "IN_PROGRESS" | "APPROVED" | "REJECTED" | "SKIPPED";

export interface WorkflowStep {
  workflowStepId: string;
  name: string;
  description?: Record<string, string>;
  orderIndex: number;
  type: WorkflowStepType;
  status: WorkflowStepStatus;
  assignedUserIds?: string[];
  assignedUserGroupIds?: string[];
}

// ============================================================================
// Workflow Types
// ============================================================================

export interface Workflow {
  environmentWorkflowId: string;
  code: string;
  name: string;
  description?: Record<string, unknown>;
  active: boolean;
  steps: WorkflowStep[];
  createdDateTime?: string;
  modifiedDateTime?: string;
}

export interface WorkflowFormData {
  name: string;
  code: string;
  description?: Record<string, string>;
  active: boolean;
  steps: Omit<WorkflowStep, "workflowStepId" | "status">[];
}

export interface WorkflowFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  initialData?: Workflow;
  onSubmit: (data: WorkflowFormData) => Promise<void>;
  isSubmitting?: boolean;
  /** Error to display; a `describeError` result also shows its support reference */
  error?: FormSheetError | null;
  /** Server field errors; each shows under its field, the rest with `error` */
  fieldErrors?: readonly FormFieldError[];
  schema?: UIEntitySchema;
  extendedFields?: string[];
}

export interface WorkflowListFilters {
  search?: string;
  active?: boolean;
}

// ============================================================================
// Workflow Request Types
// ============================================================================

export type WorkflowRequestStatus = "P" | "I" | "A" | "R" | "C";

export interface WorkflowRequestEntity {
  environmentWorkflowRequestEntityId: string;
  entityType: string;
  entityId: string;
  entityName: string;
  primaryEntity: boolean;
}

export interface WorkflowRequest {
  environmentWorkflowRequestId: string;
  environmentWorkflow: {
    environmentWorkflowId: string;
    name: string;
    code: string;
  };
  entities: WorkflowRequestEntity[];
  status: WorkflowRequestStatus;
  requestedByUserId: string;
  requestedDateTime: string;
  approvedByUserId?: string;
  approvedDateTime?: string;
  rejectedByUserId?: string;
  rejectedDateTime?: string;
  rejectionReason?: string;
}

// ============================================================================
// Constants
// ============================================================================

export const WORKFLOW_STANDARD_FIELDS = ["name", "code", "description", "active", "steps"] as const;

export const STEP_TYPE_LABELS: Record<WorkflowStepType, string> = {
  USER_APPROVAL: "User Approval",
  GROUP_APPROVAL: "Group Approval",
  AUTOMATIC_APPROVAL: "Automatic",
  CONDITIONAL_APPROVAL: "Conditional",
};

export const STEP_TYPE_OPTIONS = Object.entries(STEP_TYPE_LABELS).map(([value, label]) => ({
  value,
  label,
}));

export const REQUEST_STATUS_LABELS: Record<WorkflowRequestStatus, string> = {
  P: "Pending",
  I: "In Progress",
  A: "Approved",
  R: "Rejected",
  C: "Cancelled",
};

export const REQUEST_STATUS_OPTIONS = Object.entries(REQUEST_STATUS_LABELS).map(
  ([value, label]) => ({ value, label })
);
