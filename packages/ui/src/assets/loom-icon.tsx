import * as React from "react";

import { cn } from "../lib/utils";

interface LoomIconProps extends React.SVGProps<SVGSVGElement> {
  className?: string;
}

/**
 * Loom Loyalty brand icon mark.
 * Multi-colored geometric icon with teal, amber, emerald, and orange elements.
 */
export function LoomIcon({ className, ...props }: LoomIconProps) {
  return (
    <svg
      viewBox="18 15 112 112"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0", className)}
      aria-hidden="true"
      {...props}
    >
      {/* Amber bars */}
      <rect
        x="75.76"
        y="25.03"
        width="12.63"
        height="54.76"
        rx="6.32"
        transform="rotate(48.36 82.07 52.41)"
        fill="#f59e0b"
      />
      <rect
        x="37.51"
        y="70.94"
        width="12.63"
        height="30.94"
        rx="6.32"
        transform="rotate(48.36 43.83 86.42)"
        fill="#f59e0b"
      />
      {/* Teal bars */}
      <rect
        x="99.01"
        y="46.22"
        width="12.63"
        height="27.97"
        rx="6.32"
        transform="rotate(48.36 105.33 60.21)"
        fill="#0c8ead"
      />
      <rect
        x="61.38"
        y="65.04"
        width="12.63"
        height="57.21"
        rx="6.32"
        transform="rotate(48.36 67.69 93.66)"
        fill="#0c8ead"
      />
      <rect
        x="65.58"
        y="29.87"
        width="12.89"
        height="12.89"
        rx="6.45"
        transform="rotate(-41.64 72.02 36.31)"
        fill="#0c8ead"
      />
      <rect
        x="73.95"
        y="103.14"
        width="12.89"
        height="12.89"
        rx="6.45"
        transform="rotate(138.36 80.40 109.60)"
        fill="#0c8ead"
      />
      {/* Orange dots */}
      <rect
        x="33.87"
        y="58.06"
        width="12.89"
        height="12.89"
        rx="6.45"
        transform="rotate(-41.64 40.31 64.50)"
        fill="#d97706"
      />
      <rect
        x="105.66"
        y="74.95"
        width="12.89"
        height="12.89"
        rx="6.45"
        transform="rotate(138.36 112.11 81.40)"
        fill="#d97706"
      />
      {/* Emerald bars */}
      <rect
        x="44.93"
        y="31.63"
        width="12.89"
        height="26.4"
        rx="6.45"
        transform="rotate(-41.64 51.37 44.82)"
        fill="#059669"
      />
      <rect
        x="94.42"
        y="87.29"
        width="12.89"
        height="26.4"
        rx="6.45"
        transform="rotate(138.36 100.86 100.50)"
        fill="#059669"
      />
    </svg>
  );
}
