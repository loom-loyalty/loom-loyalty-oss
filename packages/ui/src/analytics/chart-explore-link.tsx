/**
 * "Explore in Spindle" — the chart-level drill-down affordance.
 *
 * A link rather than a button because it navigates: that gives middle-click,
 * cmd-click, and "open in new tab" for free, and announces correctly to screen
 * readers. Apps without a SQL workbench pass no href, and nothing renders.
 */
import { Telescope } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "../primitives/button";
import type { LinkComponentProps } from "../shell/sidebar";

export interface ChartExploreLinkProps {
  href: string;
  /** Chart name, folded into the accessible label so it is unique on the page. */
  chartTitle: string;
  /** Optional app-level router adapter. Defaults to a native anchor. */
  LinkComponent?: React.ComponentType<LinkComponentProps>;
}

export function ChartExploreLink({
  href,
  chartTitle,
  LinkComponent = "a" as unknown as React.ComponentType<LinkComponentProps>,
}: ChartExploreLinkProps): ReactNode {
  const Link = LinkComponent;

  return (
    <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
      <Link href={href} aria-label={`Explore ${chartTitle} in Spindle`}>
        <Telescope className="h-4 w-4" aria-hidden="true" />
      </Link>
    </Button>
  );
}
