import type { ReactNode } from "react";
import { ToggleGroup, ToggleGroupItem } from "../primitives/toggle-group";

interface GranularityOption {
  value: string;
  label: string;
}

interface GranularityToggleProps {
  value: string;
  onChange: (value: string) => void;
  options?: GranularityOption[];
}

const DEFAULT_OPTIONS: GranularityOption[] = [
  { value: "hourly", label: "Hour" },
  { value: "daily", label: "Day" },
  { value: "weekly", label: "Week" },
  { value: "monthly", label: "Month" },
];

export function GranularityToggle({
  value,
  onChange,
  options = DEFAULT_OPTIONS,
}: GranularityToggleProps): ReactNode {
  return (
    <ToggleGroup
      type="single"
      value={value}
      onValueChange={(v: string) => {
        if (v) onChange(v);
      }}
      aria-label="Data granularity"
    >
      {options.map((opt) => (
        <ToggleGroupItem
          key={opt.value}
          value={opt.value}
          className="h-8 px-3 text-xs"
          aria-label={opt.label}
        >
          {opt.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
