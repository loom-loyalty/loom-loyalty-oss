"use client";

import type { ToolActivity } from "@openuidev/react-headless";
import type { TimelineStep } from "@openuidev/react-ui";
import { ChevronRight } from "lucide-react";
import { useId, useState } from "react";

import { cn } from "../lib/utils";
import { useAssistantName } from "./assistant-name";
import { getToolLabel } from "./tool-labels";
import type { ToolStepState } from "./types";

export interface LoomToolActivityProps {
  activities: ToolActivity[];
  steps: TimelineStep[];
  /** True while this turn is the one the thread is running. */
  isLast: boolean;
  /** True between the last tool finishing and the answer's first tokens. */
  awaitingResponse: boolean;
}

// The AG-UI stream sends TOOL_CALL_START/END but no results, so a finished
// tool stays "executing" forever; once the turn is no longer live it is done.
function stepState(activity: ToolActivity, live: boolean): ToolStepState {
  if (activity.status === "error") return "error";
  if (activity.status === "complete") return "done";
  return live ? "running" : "done";
}

/**
 * One assistant turn's tool activity, as a quiet disclosure: a line of text
 * that says what Weave is doing (shimmering while it works) over a timeline
 * of the turn's steps. Open while the turn works, collapsed once the answer
 * arrives; a click on the line overrides that for the rest of the turn.
 */
export function LoomToolActivity({
  activities,
  steps,
  isLast,
  awaitingResponse,
}: LoomToolActivityProps) {
  const bodyId = useId();
  const [userExpanded, setUserExpanded] = useState<boolean | null>(null);
  const assistantName = useAssistantName();

  const states = activities.map((a) => stepState(a, isLast));
  const errorCount = states.filter((s) => s === "error").length;
  const working = isLast && (states.includes("running") || awaitingResponse);
  const expanded = userExpanded ?? working;

  // The header summarizes; the rows name each step, so the header never
  // repeats a row while the timeline is open.
  const onlyActivity = activities.length === 1 ? activities[0] : undefined;
  const title = working
    ? states.includes("running")
      ? `${assistantName.short} is working`
      : "Putting the answer together"
    : errorCount > 0
      ? `${errorCount} ${errorCount === 1 ? "step" : "steps"} failed`
      : onlyActivity
        ? getToolLabel(onlyActivity.toolName).done
        : `${activities.length} steps`;

  const rows: TimelineStep[] =
    steps.length > 0 ? steps : activities.map((activity) => ({ type: "activity", activity }));
  // Earlier calls never get results, so they stay "running"; only the latest
  // running step's dot lights up.
  let liveActivityId: string | undefined;
  if (working) {
    for (const row of rows) {
      if (row.type === "activity" && stepState(row.activity, isLast) === "running") {
        liveActivityId = row.activity.id;
      }
    }
  }

  return (
    <div data-testid="loom-tool-activity" data-state={working ? "working" : "done"}>
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={bodyId}
        onClick={() => setUserExpanded(!expanded)}
        className={cn(
          "text-muted-foreground hover:text-foreground -mx-1 inline-flex min-h-11 items-center gap-1 rounded-md px-1 text-sm transition-colors",
          "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
          !working && errorCount > 0 && "text-destructive hover:text-destructive"
        )}
      >
        {/* Open, the title sits to the right of the thread, in line with the
            step labels; the thread starts level with its middle. */}
        <span className={cn(expanded && "pl-5", working && "loom-shimmer")} aria-live="polite">
          {title}
        </span>
        <ChevronRight
          aria-hidden="true"
          className={cn(
            "size-3.5 shrink-0 transition-transform duration-150 motion-reduce:transition-none",
            expanded && "rotate-90"
          )}
        />
      </button>
      {expanded && (
        <ol
          id={bodyId}
          className={cn(
            // The thread's first segment: from the title's middle to the first dot.
            "relative pb-1",
            "before:bg-border before:absolute before:-top-[22px] before:left-[3px] before:h-[28px] before:w-px",
            working && "loom-thread-live"
          )}
        >
          {rows.map((row) =>
            row.type === "text" ? (
              <TimelineRow key={row.id} state="done">
                <p className="text-muted-foreground whitespace-pre-wrap">{row.text}</p>
              </TimelineRow>
            ) : (
              <ActivityRow
                key={row.activity.id}
                activity={row.activity}
                state={stepState(row.activity, isLast)}
                live={row.activity.id === liveActivityId}
              />
            )
          )}
        </ol>
      )}
    </div>
  );
}

function ActivityRow({
  activity,
  state,
  live,
}: {
  activity: ToolActivity;
  state: ToolStepState;
  live: boolean;
}) {
  const label = getToolLabel(activity.toolName);
  const input = hasContent(activity.input) ? JSON.stringify(activity.input, null, 2) : null;
  const output = activity.result || activity.errorText || null;
  return (
    <TimelineRow state={state} live={live}>
      <p
        className={cn(
          state === "running" && "loom-shimmer",
          state === "done" && "text-muted-foreground",
          state === "error" && "text-destructive"
        )}
      >
        {state === "running" ? label.running : label.done}
        {state === "error" && " · failed"}
      </p>
      {(input || output) && (
        <details className="mt-1">
          <summary className="text-muted-foreground hover:text-foreground inline-flex min-h-11 cursor-pointer items-center text-xs select-none">
            Details
          </summary>
          {input && <pre className={PRE_CLASS}>{input}</pre>}
          {output && <pre className={PRE_CLASS}>{output}</pre>}
        </details>
      )}
    </TimelineRow>
  );
}

const PRE_CLASS =
  "bg-muted text-muted-foreground mt-1 max-h-48 overflow-auto rounded-md p-2 font-mono text-xs whitespace-pre-wrap break-all";

const DOT_CLASS: Record<ToolStepState, string> = {
  running: "bg-primary",
  done: "bg-muted-foreground/50",
  error: "bg-destructive",
};

/**
 * One step on the timeline: a dot on the thread. Each segment of the thread
 * ends at a dot (the list draws the first, from the title; each row draws the
 * one from its dot down to the next), so while the turn works the glow that
 * travels down every segment reaches its dot at the same point in the cycle,
 * and the running dot lights up as it arrives.
 */
function TimelineRow({
  state,
  live = false,
  children,
}: {
  state: ToolStepState;
  live?: boolean;
  children: React.ReactNode;
}) {
  return (
    <li
      className={cn(
        "relative pb-2.5 pl-5 text-sm last:pb-0",
        "before:bg-border before:absolute before:top-[13px] before:-bottom-1.5 before:left-[3px] before:w-px last:before:hidden"
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "absolute top-1.5 left-0 size-[7px] rounded-full",
          DOT_CLASS[state],
          live && "loom-dot-live"
        )}
      />
      {children}
    </li>
  );
}

function hasContent(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === "object") return Object.keys(value).length > 0;
  return String(value).length > 0;
}
