"use client";

/**
 * WebhookFormSheet - Sheet component for creating/editing Webhooks
 *
 * Wraps FormSheet with webhook-specific form fields and logic. In create mode it can
 * show a connector picker: paste-URL connectors collect a destination URL, while OAuth
 * connectors (e.g. Slack) swap the URL field for a Connect button that the parent wires
 * to the provider authorize flow.
 */

import { Sparkles } from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";
import { WithFieldError } from "../../../forms/field-errors.js";
import { FormSheet } from "../../../forms/form-sheet.js";
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
import { Textarea } from "../../../primitives/textarea.js";
import { SubscriptionChecklist } from "./subscription-checklist.js";
import type { WebhookFormSheetProps } from "./types.js";

/** Validate a webhook destination URL — must be a well-formed HTTPS URL. */
function validateEndpointUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return "Enter the endpoint URL.";
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return "Enter a valid URL, including https://.";
  }
  if (parsed.protocol !== "https:") {
    return "The endpoint URL must use https://.";
  }
  return null;
}

/**
 * Sheet component for creating and editing Webhook endpoints.
 */
export function WebhookFormSheet({
  open,
  onOpenChange,
  mode,
  initialData,
  onSubmit,
  isSubmitting = false,
  error,
  fieldErrors,
  availableEventTypes = [],
  connectors = [],
}: WebhookFormSheetProps): ReactNode {
  const defaultConnectorKind = initialData?.connectorKind ?? connectors[0]?.kind ?? "";

  // Form state
  const [url, setUrl] = useState(initialData?.url ?? "");
  const [description, setDescription] = useState(initialData?.description ?? "");
  const [enabled, setEnabled] = useState(
    initialData ? initialData.status.toLowerCase() === "enabled" : true
  );
  const [events, setEvents] = useState<string[]>(initialData?.events ?? []);
  const [eventsError, setEventsError] = useState<string | null>(null);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [connectorKind, setConnectorKind] = useState(defaultConnectorKind);

  const showConnectorPicker = mode === "create" && connectors.length > 1;
  const selectedConnector = connectors.find((c) => c.kind === connectorKind);
  const isOauth = showConnectorPicker && Boolean(selectedConnector?.requiresOauth);

  // Reset form state from initialData (or defaults)
  const resetForm = () => {
    setUrl(initialData?.url ?? "");
    setDescription(initialData?.description ?? "");
    setEnabled(initialData ? initialData.status.toLowerCase() === "enabled" : true);
    setEvents(initialData?.events ?? []);
    setEventsError(null);
    setUrlError(null);
    setConnectorKind(defaultConnectorKind);
  };

  // Handle open change with form reset
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      resetForm();
    }
    onOpenChange(newOpen);
  };

  // Handle event type toggle
  const handleEventToggle = (eventType: string, isEnabled: boolean) => {
    setEvents((prev) => {
      const next = isEnabled ? [...prev, eventType] : prev.filter((e) => e !== eventType);
      if (next.length > 0) setEventsError(null);
      return next;
    });
  };

  // Handle submit
  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // OAuth connectors have no URL field; everything else needs a valid HTTPS endpoint.
    const nextUrlError = isOauth ? null : validateEndpointUrl(url);
    // The Platform API rejects an endpoint with no event filters, so require at least
    // one — but only when there are event types to choose from (otherwise the error has
    // nowhere to render and the BE 400 surfaces through the form error).
    const nextEventsError =
      availableEventTypes.length > 0 && events.length === 0
        ? "Select at least one event for this endpoint to receive."
        : null;

    setUrlError(nextUrlError);
    setEventsError(nextEventsError);
    if (nextUrlError || nextEventsError) return;

    await onSubmit({
      url: isOauth ? "" : url.trim(),
      description: description || undefined,
      status: enabled ? "enabled" : "disabled",
      events,
      ...(mode === "create" ? { connectorKind: connectorKind || undefined } : {}),
    });
  };

  const handleCancel = () => {
    handleOpenChange(false);
  };

  const title =
    mode === "edit"
      ? "Edit Webhook Endpoint"
      : isOauth
        ? `Connect ${selectedConnector?.name ?? "destination"}`
        : "Create Webhook Endpoint";
  const submitLabel =
    mode === "edit"
      ? "Save Changes"
      : isOauth
        ? `Connect to ${selectedConnector?.name ?? "destination"}`
        : "Create Endpoint";

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
        {/* Connector picker (create mode) */}
        {showConnectorPicker && (
          <div className="space-y-2">
            <Label htmlFor="webhook-connector">Destination</Label>
            <WithFieldError field="connectorKind" value={connectorKind}>
              {(fe) => (
                <Select
                  value={connectorKind}
                  onValueChange={setConnectorKind}
                  disabled={isSubmitting}
                >
                  <SelectTrigger {...fe.inputProps} id="webhook-connector" data-widget="select">
                    <SelectValue placeholder="Select a destination..." />
                  </SelectTrigger>
                  <SelectContent>
                    {connectors.map((connector) => (
                      <SelectItem key={connector.kind} value={connector.kind}>
                        {connector.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </WithFieldError>
            {selectedConnector?.description && (
              <p className="text-muted-foreground text-xs">{selectedConnector.description}</p>
            )}
            {selectedConnector?.hasTransformation && (
              <p className="text-muted-foreground flex items-start gap-1.5 text-xs">
                <Sparkles className="text-accent mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>
                  {selectedConnector.name} formats payloads automatically — you don&rsquo;t need to
                  add your own transformation.
                </span>
              </p>
            )}
          </div>
        )}

        {/* URL field — paste-URL/custom destinations only */}
        {!isOauth && (
          <div className="space-y-2">
            <Label htmlFor="webhook-url">
              Endpoint URL <span className="text-destructive">*</span>
            </Label>
            <WithFieldError field="url">
              {(fe) => (
                <Input
                  {...fe.inputProps}
                  id="webhook-url"
                  inputMode="url"
                  value={url}
                  onChange={(e) => {
                    setUrl(e.target.value);
                    if (urlError) setUrlError(null);
                  }}
                  placeholder="https://your-domain.com/webhooks"
                  disabled={isSubmitting}
                  aria-invalid={fe.error ? true : !!urlError}
                  aria-describedby={
                    fe.error ? `${fe.errorId} webhook-url-hint` : "webhook-url-hint"
                  }
                />
              )}
            </WithFieldError>
            {urlError ? (
              <p id="webhook-url-hint" className="text-destructive text-xs" role="alert">
                {urlError}
              </p>
            ) : (
              <p id="webhook-url-hint" className="text-muted-foreground text-xs">
                {selectedConnector?.instructions ??
                  "Must be a valid HTTPS URL that can receive POST requests."}
              </p>
            )}
          </div>
        )}

        {/* OAuth connect note */}
        {isOauth && (
          <p className="text-muted-foreground text-sm">
            You&rsquo;ll be redirected to {selectedConnector?.name ?? "the provider"} to authorize
            the connection. The endpoint is created automatically when you return.
          </p>
        )}

        {/* Description field */}
        <div className="space-y-2">
          <Label htmlFor="webhook-description">Description</Label>
          <WithFieldError field="description">
            {(fe) => (
              <Textarea
                {...fe.inputProps}
                id="webhook-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the purpose of this webhook endpoint"
                rows={3}
                disabled={isSubmitting}
              />
            )}
          </WithFieldError>
        </div>

        {/* Status toggle — not applicable to OAuth-provisioned endpoints */}
        {!isOauth && (
          <div className="space-y-4">
            <h3 className="text-foreground text-sm font-medium">Settings</h3>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label htmlFor="webhook-status" className="text-sm font-medium">
                  Enabled
                </Label>
                <p className="text-muted-foreground text-xs">
                  Receive webhook deliveries when enabled
                </p>
              </div>
              <Switch
                id="webhook-status"
                checked={enabled}
                onCheckedChange={setEnabled}
                disabled={isSubmitting}
              />
            </div>
          </div>
        )}

        {/* Event subscriptions */}
        {availableEventTypes.length > 0 && (
          <div className="space-y-2">
            <Label>Events to Subscribe</Label>
            <SubscriptionChecklist
              eventTypes={availableEventTypes}
              subscribedTypes={events}
              onToggle={handleEventToggle}
              disabled={isSubmitting}
            />
            {eventsError ? (
              <p className="text-destructive text-xs" role="alert">
                {eventsError}
              </p>
            ) : (
              <p className="text-muted-foreground text-xs">
                Select the events this endpoint should receive.
              </p>
            )}
          </div>
        )}
      </div>
    </FormSheet>
  );
}
