import { Download } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "../primitives/button";

interface ChartExportButtonProps {
  onClick: () => void;
  isExporting?: boolean;
}

export function ChartExportButton({ onClick, isExporting }: ChartExportButtonProps): ReactNode {
  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={onClick}
        disabled={isExporting}
        aria-label={isExporting ? "Exporting chart data..." : "Export chart data as CSV"}
      >
        <Download className="h-4 w-4" aria-hidden="true" />
      </Button>
      <span className="sr-only" aria-live="polite">
        {isExporting ? "Exporting data..." : ""}
      </span>
    </>
  );
}
