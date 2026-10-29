import type { ReactNode } from "react";
import { Label } from "../primitives/label";
import { Switch } from "../primitives/switch";

interface CompareToggleProps {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
}

export function CompareToggle({ enabled, onChange }: CompareToggleProps): ReactNode {
  return (
    <div className="flex items-center gap-2">
      <Switch
        id="compare-toggle"
        checked={enabled}
        onCheckedChange={onChange}
        aria-label="Compare with previous period"
      />
      <Label htmlFor="compare-toggle" className="text-muted-foreground cursor-pointer text-sm">
        Compare
      </Label>
    </div>
  );
}
