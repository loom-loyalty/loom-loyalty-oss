import "@testing-library/jest-dom/vitest";

import type { ToolActivity } from "@openuidev/react-headless";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { LoomToolActivity } from "../tool-activity";
import { getToolLabel } from "../tool-labels";

function activity(
  id: string,
  toolName: string,
  status: ToolActivity["status"] = "executing"
): ToolActivity {
  const toolCall = { id, type: "function" as const, function: { name: toolName, arguments: "" } };
  if (status === "complete" || status === "error") {
    return {
      id,
      toolName,
      toolCall,
      status,
      toolMessage: { id: `tm-${id}`, role: "tool", toolCallId: id, content: "ok" },
      input: {},
      result: "ok",
      isError: status === "error",
    } as ToolActivity;
  }
  return {
    id,
    toolName,
    toolCall,
    status,
    toolMessage: null,
    input: {},
    isError: false,
  } as ToolActivity;
}

describe("getToolLabel", () => {
  it("names the supervisor's sub-agents in plain language", () => {
    expect(getToolLabel("weave")).toEqual({
      running: "Working with your program",
      done: "Worked with your program",
    });
  });

  it("humanizes any other tool name", () => {
    expect(getToolLabel("list_programs").done).toBe("List programs");
    expect(getToolLabel("getCustomer").running).toBe("Get customer");
  });
});

describe("LoomToolActivity", () => {
  it("opens and lists the running step while the turn is live", () => {
    render(
      <LoomToolActivity
        activities={[activity("a", "weave")]}
        steps={[]}
        isLast
        awaitingResponse={false}
      />
    );
    const header = screen.getByRole("button", { name: /weave is working/i });
    expect(header).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Working with your program")).toBeInTheDocument();
    expect(screen.getByTestId("loom-tool-activity")).toHaveAttribute("data-state", "working");
  });

  it("treats a call with no result as done once the turn is over", () => {
    // The AG-UI stream carries no tool results, so calls stay "executing".
    render(
      <LoomToolActivity
        activities={[activity("a", "weave"), activity("b", "analytics")]}
        steps={[]}
        isLast={false}
        awaitingResponse={false}
      />
    );
    const header = screen.getByRole("button", { name: /2 steps/i });
    expect(header).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByTestId("loom-tool-activity")).toHaveAttribute("data-state", "done");
  });

  it("stays open between the last tool and the first answer token", () => {
    render(
      <LoomToolActivity
        activities={[activity("a", "weave", "complete")]}
        steps={[]}
        isLast
        awaitingResponse
      />
    );
    expect(screen.getByRole("button", { name: /putting the answer together/i })).toHaveAttribute(
      "aria-expanded",
      "true"
    );
  });

  it("reports failed steps", () => {
    render(
      <LoomToolActivity
        activities={[activity("a", "weave", "error")]}
        steps={[]}
        isLast={false}
        awaitingResponse={false}
      />
    );
    expect(screen.getByRole("button", { name: /1 step failed/i })).toBeInTheDocument();
  });

  it("names a lone finished step in the header", () => {
    render(
      <LoomToolActivity
        activities={[activity("a", "weave")]}
        steps={[]}
        isLast={false}
        awaitingResponse={false}
      />
    );
    expect(screen.getByRole("button", { name: "Worked with your program" })).toBeInTheDocument();
  });

  it("expands on click to list steps, interleaving thinking text", async () => {
    const user = userEvent.setup();
    const a = activity("a", "list_programs");
    render(
      <LoomToolActivity
        activities={[a]}
        steps={[
          { type: "text", id: "t1", text: "Let me look that up." },
          { type: "activity", activity: a },
        ]}
        isLast={false}
        awaitingResponse={false}
      />
    );
    await user.click(screen.getByRole("button", { name: "List programs" }));
    expect(screen.getByText("Let me look that up.")).toBeInTheDocument();
    expect(screen.getAllByText("List programs")).toHaveLength(2);
  });
});
