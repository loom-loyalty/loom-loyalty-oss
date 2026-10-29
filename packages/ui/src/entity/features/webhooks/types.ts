/**
 * Webhook Feature Types
 *
 * Centralized type definitions for the webhooks feature.
 * Keeps types in a dedicated file per CLAUDE.md guidelines.
 */

import type { FormFieldError } from "../../../forms/field-errors.js";
import type { FormSheetError } from "../../../forms/form-sheet.js";

/**
 * Form data for webhook endpoint creation/editing.
 */
export interface WebhookFormData {
  url: string;
  description?: string;
  status: "enabled" | "disabled";
  events: string[];
  secret?: string;
  /** Connector applied to this endpoint (e.g. "SLACK"); omit for a raw custom endpoint. */
  connectorKind?: string;
}

/**
 * A selectable connector in the webhook create form.
 */
export interface WebhookConnectorOption {
  /** Stable connector identifier (e.g. "CUSTOM", "SLACK", "MICROSOFT_TEAMS"). */
  kind: string;
  /** Human-readable display name. */
  name: string;
  /** What the connector does. */
  description?: string;
  /** How to obtain the destination URL to paste (paste-URL connectors only). */
  instructions?: string;
  /** When true, the form shows a Connect button that starts an OAuth flow instead of a URL field. */
  requiresOauth?: boolean;
  /** When true, applying this connector installs an outbound transformation on the endpoint. */
  hasTransformation?: boolean;
}

/**
 * An endpoint's outbound transformation — JavaScript run on each delivery to
 * rewrite the payload before it is sent. `code` is null when none is configured.
 */
export interface WebhookTransformation {
  code?: string | null;
  enabled: boolean;
}

/**
 * Props for the WebhookFormSheet component.
 */
export interface WebhookFormSheetProps {
  /** Whether the sheet is open */
  open: boolean;
  /** Callback when open state changes */
  onOpenChange: (open: boolean) => void;
  /** Mode: create or edit */
  mode: "create" | "edit";
  /** Initial data for editing */
  initialData?: WebhookFormData;
  /** Submit handler */
  onSubmit: (data: WebhookFormData) => Promise<void>;
  /** Whether the form is submitting */
  isSubmitting?: boolean;
  /** Error to display; a `describeError` result also shows its support reference */
  error?: FormSheetError | null;
  /** Server field errors; each shows under its field, the rest with `error` */
  fieldErrors?: readonly FormFieldError[];
  /** Available event types for the checklist */
  availableEventTypes?: string[];
  /** Selectable connectors (create mode); when provided, a destination picker is shown. */
  connectors?: WebhookConnectorOption[];
}

/**
 * Webhook endpoint data for the detail view.
 */
export interface WebhookEndpoint {
  id: string;
  url: string;
  description?: string;
  status: string;
  createdDateTime?: string;
  updatedDateTime?: string;
  events?: string[];
  [key: string]: unknown;
}

/**
 * Props for the WebhookDetail component.
 */
export interface WebhookDetailProps {
  /** Webhook endpoint to display */
  webhook: WebhookEndpoint;
  /** Edit click handler */
  onEdit?: () => void;
  /** Delete click handler */
  onDelete?: () => void;
  /** Test click handler */
  onTest?: () => void;
  /** Rotate secret click handler */
  onRotateSecret?: () => void;
  /** Whether editing is enabled */
  canEdit?: boolean;
  /** Whether deletion is enabled */
  canDelete?: boolean;
  /** The webhook signing secret */
  secret?: string | null;
  /** Whether to show the secret value */
  showSecret?: boolean;
  /** Toggle secret visibility */
  onToggleSecret?: () => void;
  /**
   * The endpoint's outbound transformation. When `onEditTransformation` is
   * provided, the detail renders a Transformation section; pass the loaded
   * transformation here (or leave undefined while `transformationLoading`).
   */
  transformation?: WebhookTransformation | null;
  /** Whether the transformation is still loading. */
  transformationLoading?: boolean;
  /** Opens the transformation editor. When omitted, the Transformation section is hidden. */
  onEditTransformation?: () => void;
}

/**
 * Webhook delivery message for the message log.
 */
export interface WebhookMessage {
  id: string;
  eventType: string;
  timestamp: string;
  /** Raw ISO 8601 timestamp for the <time dateTime> attribute */
  rawTimestamp?: string;
  status: "success" | "failed" | "pending";
  /** When false, the row renders non-interactive even if onSelect is wired. */
  selectable?: boolean;
  responseCode?: number;
  duration?: string;
  endpointUrl?: string;
  /** What triggered the attempt (e.g. SCHEDULED, MANUAL). */
  triggerType?: string;
  /** Request payload delivered to the endpoint (attempt detail only). */
  payload?: unknown;
  /** Raw response body returned by the endpoint (attempt detail only). */
  responseBody?: string;
}

/**
 * Props for the WebhookMessageLog component.
 */
export interface WebhookMessageLogProps {
  /** Delivery messages to display */
  messages: WebhookMessage[];
  /** Whether messages are loading */
  isLoading?: boolean;
  /** Retry a failed message */
  onRetry?: (messageId: string) => void;
  /** Whether retry is allowed */
  canRetry?: boolean;
  /** Opens the attempt detail when a row is selected. */
  onSelect?: (id: string) => void;
}

/**
 * Props for the WebhookAttemptDetail component.
 */
export interface WebhookAttemptDetailProps {
  /** The delivery attempt to display. */
  message: WebhookMessage;
}

/**
 * Props for the SubscriptionChecklist component.
 */
export interface SubscriptionChecklistProps {
  /** All available event types */
  eventTypes: string[];
  /** Currently subscribed event types */
  subscribedTypes: string[];
  /** Toggle handler for event type subscription */
  onToggle: (eventType: string, enabled: boolean) => void;
  /** Whether the checklist is disabled */
  disabled?: boolean;
}

/**
 * Filter state for the webhook list.
 */
export interface WebhookListFilters {
  search: string;
  status?: string;
}

/**
 * Standard webhook fields
 */
export const WEBHOOK_STANDARD_FIELDS = [
  "url",
  "description",
  "status",
  "events",
  "createdDateTime",
  "updatedDateTime",
] as const;
