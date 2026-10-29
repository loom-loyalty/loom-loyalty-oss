import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { useState, type ReactNode } from "react";
import { cn } from "../lib/utils";
import { Button } from "../primitives/button";
import { Calendar } from "../primitives/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "../primitives/popover";

interface DatePresetOption {
  key: string;
  label: string;
  resolve: () => { startDate: string; endDate: string };
}

interface DateRangeValue {
  startDate: string;
  endDate: string;
  preset: string;
  label: string;
}

interface DateRangePickerProps {
  value: DateRangeValue;
  onChange: (range: DateRangeValue) => void;
  presets?: DatePresetOption[];
  className?: string;
}

export function DateRangePicker({
  value,
  onChange,
  presets = [],
  className,
}: DateRangePickerProps): ReactNode {
  const [open, setOpen] = useState(false);

  const handlePreset = (preset: DatePresetOption) => {
    const { startDate, endDate } = preset.resolve();
    onChange({ startDate, endDate, preset: preset.key, label: preset.label });
    setOpen(false);
  };

  const handleDateSelect = (range: { from?: Date; to?: Date } | undefined) => {
    if (range?.from && range?.to) {
      onChange({
        startDate: format(range.from, "yyyy-MM-dd"),
        endDate: format(range.to, "yyyy-MM-dd"),
        preset: "custom",
        label: `${format(range.from, "MMM d")} - ${format(range.to, "MMM d, yyyy")}`,
      });
      setOpen(false);
    }
  };

  const fromDate = value.startDate ? new Date(value.startDate + "T00:00:00") : undefined;
  const toDate = value.endDate ? new Date(value.endDate + "T00:00:00") : undefined;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className={cn("justify-start text-left font-normal", className)}>
          <CalendarIcon className="mr-2 h-4 w-4" aria-hidden="true" />
          <span>{value.label}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="flex">
          {presets.length > 0 && (
            <div className="border-border space-y-1 border-r p-3">
              {presets.map((preset) => (
                <button
                  key={preset.key}
                  type="button"
                  className={cn(
                    "block w-full rounded-md px-3 py-1.5 text-left text-sm transition-colors",
                    value.preset === preset.key
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-muted-foreground hover:bg-muted"
                  )}
                  onClick={() => handlePreset(preset)}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          )}
          <div className="p-3">
            <Calendar
              mode="range"
              selected={fromDate && toDate ? { from: fromDate, to: toDate } : undefined}
              onSelect={handleDateSelect}
              numberOfMonths={2}
              disabled={{ after: new Date() }}
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
