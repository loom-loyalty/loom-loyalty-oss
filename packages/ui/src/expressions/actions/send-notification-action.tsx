import { memo, useCallback, useId, type ReactNode } from "react";

import { Input } from "../../primitives/input.js";
import { Label } from "../../primitives/label.js";
import type { ActionComponentProps, SendNotificationAction } from "../types";

type SendNotificationData = SendNotificationAction["sendNotification"];

export const SendNotificationActionComponent = memo(function SendNotificationActionComponent({
  value,
  onChange,
  disabled,
  className,
}: ActionComponentProps<SendNotificationData>): ReactNode {
  const kindId = useId();
  const channelCodeId = useId();
  const templateCodeId = useId();
  const reasonId = useId();
  const update = useCallback(
    (partial: Partial<SendNotificationData>) => onChange({ ...value, ...partial }),
    [value, onChange]
  );

  return (
    <div className={className}>
      <div className="space-y-3">
        <div>
          <Label htmlFor={kindId} className="mb-1.5 block text-xs">
            Kind
          </Label>
          <select
            id={kindId}
            value={value.kind ?? "NOTIFICATION"}
            onChange={(event) =>
              update({ kind: event.target.value as SendNotificationData["kind"] })
            }
            disabled={disabled}
            className="border-input bg-background text-foreground h-9 w-full rounded-md border px-3 text-xs"
          >
            <option value="REMINDER">Reminder</option>
            <option value="NOTIFICATION">Notification</option>
          </select>
        </div>
        <div>
          <Label htmlFor={channelCodeId} className="mb-1.5 block text-xs">
            Channel Code <span className="text-destructive">*</span>
          </Label>
          <Input
            id={channelCodeId}
            value={value.channelCode}
            onChange={(event) => update({ channelCode: event.target.value })}
            disabled={disabled}
            required
            className="text-xs"
          />
        </div>
        <div>
          <Label htmlFor={templateCodeId} className="mb-1.5 block text-xs">
            Template Code <span className="text-destructive">*</span>
          </Label>
          <Input
            id={templateCodeId}
            value={value.templateCode}
            onChange={(event) => update({ templateCode: event.target.value })}
            disabled={disabled}
            required
            className="text-xs"
          />
        </div>
        <div>
          <Label htmlFor={reasonId} className="mb-1.5 block text-xs">
            Reason (optional)
          </Label>
          <Input
            id={reasonId}
            value={value.reason ?? ""}
            onChange={(event) => update({ reason: event.target.value || undefined })}
            disabled={disabled}
            className="text-xs"
          />
        </div>
      </div>
    </div>
  );
});
