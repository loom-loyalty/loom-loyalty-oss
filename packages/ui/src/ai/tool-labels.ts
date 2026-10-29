import type { ToolLabel } from "./types";

/**
 * Plain-language labels for the supervisor's sub-agent tools
 * (apps/ai-server/src/agents/supervisor.ts). Any other tool name is humanized.
 */
const KNOWN_TOOL_LABELS: Record<string, ToolLabel> = {
  weave: { running: "Working with your program", done: "Worked with your program" },
  onboarding: { running: "Planning your program setup", done: "Planned your program setup" },
  analytics: { running: "Querying analytics", done: "Queried analytics" },
};

function humanize(toolName: string): string {
  const words = toolName
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim()
    .toLowerCase();
  if (!words) return "Tool";
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function getToolLabel(toolName: string): ToolLabel {
  const known = KNOWN_TOOL_LABELS[toolName];
  if (known) return known;
  const name = humanize(toolName);
  return { running: name, done: name };
}
