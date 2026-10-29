import { BarChart3 } from "lucide-react";
import type { ReactNode } from "react";

interface ChartEmptyProps {
  message?: string;
}

export function ChartEmpty({
  message = "No data available for this period",
}: ChartEmptyProps): ReactNode {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
      <BarChart3 className="text-muted-foreground/50 h-8 w-8" aria-hidden="true" />
      <p className="text-muted-foreground text-sm">{message}</p>
    </div>
  );
}
