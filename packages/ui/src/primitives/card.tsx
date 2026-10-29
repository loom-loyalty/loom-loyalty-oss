import * as React from "react";

import { cn } from "../lib/utils";

function Card({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card"
      className={cn(
        "bg-card text-card-foreground flex flex-col rounded-xl border-0 shadow-sm",
        className
      )}
      {...props}
    />
  );
}

interface CardHeaderProps extends React.ComponentProps<"div"> {
  /**
   * `brand` renders the olive-sage title bar with a teal rule and dark text
   * used by the overview cards; `default` keeps the neutral surface header.
   */
  variant?: "default" | "brand";
}

function CardHeader({ className, variant = "default", ...props }: CardHeaderProps) {
  return (
    <div
      data-slot="card-header"
      data-variant={variant}
      className={cn(
        "flex flex-row items-center justify-between gap-2 rounded-t-xl",
        variant === "brand"
          ? "border-chrome-border bg-chrome text-chrome-foreground h-10 border-b px-5"
          : "border-chrome-border bg-surface border-b px-6 py-4",
        className
      )}
      {...props}
    />
  );
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-title"
      className={cn("text-card-foreground text-lg leading-none font-semibold", className)}
      {...props}
    />
  );
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  );
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn("col-start-2 row-span-2 row-start-1 self-start justify-self-end", className)}
      {...props}
    />
  );
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-content" className={cn("px-6 py-4", className)} {...props} />;
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn("flex items-center px-6 py-4", className)}
      {...props}
    />
  );
}

export { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle };
export type { CardHeaderProps };
