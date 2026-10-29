import { cn } from "../../../lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "../../../primitives/card";

export type RiskTone = "high" | "medium" | "low";

export interface RiskBand {
  label: string;
  count: number;
  tone: RiskTone;
}

export interface RiskBandsProps {
  title: string;
  bands: RiskBand[];
  /** Who the bands cover, e.g. "Business guests (1,712)" */
  footnote?: string;
  className?: string;
}

const TONE_FILL: Record<RiskTone, string> = {
  high: "bg-accent-dark",
  medium: "bg-accent",
  low: "bg-success",
};

/** A predicted score, shown as member counts per band. */
export function RiskBands({ title, bands, footnote, className }: RiskBandsProps) {
  const max = Math.max(1, ...bands.map((b) => b.count));
  return (
    <Card className={className}>
      <CardHeader variant="brand">
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <ul className="space-y-3">
          {bands.map((band) => (
            <li key={band.label} className="space-y-1">
              <div className="flex items-baseline justify-between text-sm">
                <span className="text-foreground font-medium">{band.label}</span>
                <span className="text-foreground font-mono tabular-nums">
                  {band.count.toLocaleString("en-US")}
                </span>
              </div>
              <div className="bg-muted h-2 overflow-hidden rounded-full" aria-hidden="true">
                <div
                  className={cn("h-full rounded-full", TONE_FILL[band.tone])}
                  style={{ width: `${(band.count / max) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
        {footnote && <p className="text-muted-foreground text-xs">{footnote}</p>}
      </CardContent>
    </Card>
  );
}
