/**
 * @loom-loyalty/ui/ai
 *
 * AI Chat components for Loom Loyalty applications.
 * Loom chrome around OpenUI's headless chat store and message list, over the
 * AG-UI streaming protocol.
 */

// Must run before @openuidev/react-lang evaluates (see disable-devtools.ts).
import "../openui/disable-devtools";

// Components
export { AiChatProvider, useAiChat, useOptionalAiChat } from "./ai-chat-context";
export { AiChatPanel } from "./ai-chat-panel";
export { AiChatProviders } from "./ai-chat-providers";
export { AiLimitProvider, useAiLimitConfig } from "./ai-limit-context";
export { AiLimitNotice } from "./ai-limit-notice";
export { LoomAssistantMessage } from "./assistant-message";
export { AssistantNameContext, assistantNameFor, useAssistantName } from "./assistant-name";
export { AttachmentChip } from "./attachment-chip";
export { useAiChatCustomAction } from "./chat-action-context";
export { ChatThread } from "./chat-thread";
export { ChatWelcome } from "./chat-welcome";
export { LoomComposer } from "./composer";
export { HomePrompt } from "./home-prompt";
export { useInitialHandoffs } from "./initial-handoffs";
export { MemoryCitation } from "./memory-citation";
export { MemoryProposalCard } from "./memory-proposal-card";
export { RecentThreads } from "./recent-threads";
export { DEFAULT_CHAT_STARTERS } from "./starters";
export { LoomThinkingIndicator } from "./thinking-indicator";
export { LoomToolActivity } from "./tool-activity";
export { getToolLabel } from "./tool-labels";
export { useRecentThreads } from "./use-recent-threads";
export { LoomUserMessage } from "./user-message";
export { WeaveMark } from "./weave-mark";

// Types
export type { LoomAssistantMessageProps } from "./assistant-message";
export type { AssistantName } from "./assistant-name";
export type { AttachmentChipProps } from "./attachment-chip";
export type { AiChatCustomAction, AiChatCustomActionHandler } from "./chat-action-context";
export type { ChatThreadProps } from "./chat-thread";
export type { ChatWelcomeProps } from "./chat-welcome";
export type { LoomComposerProps } from "./composer";
export type { HomePromptProps } from "./home-prompt";
export type { InitialHandoffs } from "./initial-handoffs";
export type { CitedMemory, MemoryCitationProps, MemoryScope } from "./memory-citation";
export type { MemoryProposalCardProps } from "./memory-proposal-card";
export type { RecentThreadsProps } from "./recent-threads";
export type { LoomToolActivityProps } from "./tool-activity";
export type {
  AiChatConnectionProps,
  AiChatPanelProps,
  AiChatProvidersProps,
  AiLimitConfig,
  AiLimitLinkRenderProps,
  AiLimitLinkRenderer,
  AiLimitNoticeProps,
  ChatStarter,
  ToolLabel,
  ToolStepState,
} from "./types";
export type {
  RecentThread,
  UseRecentThreadsOptions,
  UseRecentThreadsResult,
} from "./use-recent-threads";
export type { LoomUserMessageProps } from "./user-message";
export type { WeaveMarkProps } from "./weave-mark";
