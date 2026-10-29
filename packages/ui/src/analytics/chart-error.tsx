import { AlertCircle } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "../primitives/button";

interface ChartErrorProps {
  message?: string;
  onRetry?: () => void;
}

export function ChartError({
  message = "Failed to load chart data",
  onRetry,
}: ChartErrorProps): ReactNode {
  return (
    <div
      role="alert"
      aria-live="assertive"
      className="flex flex-col items-center justify-center gap-3 py-12 text-center"
    >
      <AlertCircle className="text-destructive h-8 w-8" aria-hidden="true" />
      <p className="text-muted-foreground text-sm">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}
