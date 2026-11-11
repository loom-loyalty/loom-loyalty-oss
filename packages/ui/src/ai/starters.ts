import type { ChatStarter } from "./types";

/** The one-click prompts the chat offers when nothing better is known about the account. */
export const DEFAULT_CHAT_STARTERS: ChatStarter[] = [
  { label: "Set up a new loyalty program", prompt: "Set up a new loyalty program" },
  { label: "Show me my program analytics", prompt: "Show me my program analytics" },
  { label: "Create a new Event Rule", prompt: "Create a new Event Rule" },
];
