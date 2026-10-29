/**
 * Calendar
 *
 * A date calendar component built on react-day-picker v9.
 * Follows the shadcn/ui Calendar pattern adapted for our design system.
 * Uses semantic color tokens for theming.
 */

"use client";

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { DayFlag, DayPicker, SelectionState, UI } from "react-day-picker";

import { cn } from "../lib/utils";
import { buttonVariants } from "./button";

export type CalendarProps = ComponentProps<typeof DayPicker>;

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps): ReactNode {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        [UI.Months]: "relative",
        [UI.Month]: "ml-0 space-y-4",
        [UI.MonthCaption]: "flex h-7 items-center justify-center",
        [UI.CaptionLabel]: "text-sm font-medium",
        [UI.PreviousMonthButton]: cn(
          buttonVariants({ variant: "outline" }),
          "absolute left-1 top-0 h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100"
        ),
        [UI.NextMonthButton]: cn(
          buttonVariants({ variant: "outline" }),
          "absolute right-1 top-0 h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100"
        ),
        [UI.MonthGrid]: "w-full border-collapse space-y-1",
        [UI.Weekdays]: "flex",
        [UI.Weekday]: "text-muted-foreground w-9 rounded-md text-[0.8rem] font-normal",
        [UI.Week]: "mt-2 flex w-full",
        [UI.Day]:
          "relative h-9 w-9 rounded-md p-0 text-center text-sm focus-within:relative focus-within:z-20 [&:has([aria-selected])]:bg-primary/10 first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md",
        [UI.DayButton]: cn(
          buttonVariants({ variant: "ghost" }),
          "hover:bg-primary hover:text-primary-foreground h-9 w-9 p-0 font-normal aria-selected:opacity-100"
        ),
        [SelectionState.selected]:
          "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
        [SelectionState.range_middle]: "aria-selected:bg-primary/10 aria-selected:text-foreground",
        [DayFlag.today]: "bg-muted text-foreground font-semibold",
        [DayFlag.outside]:
          "text-muted-foreground opacity-50 aria-selected:bg-primary/5 aria-selected:text-muted-foreground aria-selected:opacity-30",
        [DayFlag.disabled]: "text-muted-foreground opacity-50",
        [DayFlag.hidden]: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation }) => {
          if (orientation === "left") return <ChevronLeftIcon className="h-4 w-4" />;
          return <ChevronRightIcon className="h-4 w-4" />;
        },
      }}
      {...props}
    />
  );
}

Calendar.displayName = "Calendar";

export { Calendar };
