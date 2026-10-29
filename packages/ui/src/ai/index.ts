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
export { AiLimitProvider, useAiLimitConfig } from "./ai-limit-context";
export { AiLimitNotice } from "./ai-limit-notice";
export { LoomAssistantMessage } from "./assistant-message";
export { AssistantNameContext, assistantNameFor, useAssistantName } from "./assistant-name";
export { AttachmentChip } from "./attachment-chip";
export { useAiChatCustomAction } from "./chat-action-context";
export { LoomComposer } from "./composer";
export { MemoryCitation } from "./memory-citation";
export { MemoryProposalCard } from "./memory-proposal-card";
export { LoomThinkingIndicator } from "./thinking-indicator";
export { LoomToolActivity } from "./tool-activity";
export { getToolLabel } from "./tool-labels";
export { LoomUserMessage } from "./user-message";
export { WeaveMark } from "./weave-mark";

// Types
export type { LoomAssistantMessageProps } from "./assistant-message";
export type { AssistantName } from "./assistant-name";
export type { AttachmentChipProps } from "./attachment-chip";
export type { AiChatCustomAction, AiChatCustomActionHandler } from "./chat-action-context";
export type { LoomComposerProps } from "./composer";
export type { CitedMemory, MemoryCitationProps, MemoryScope } from "./memory-citation";
export type { MemoryProposalCardProps } from "./memory-proposal-card";
export type { LoomToolActivityProps } from "./tool-activity";
export type {
  AiChatPanelProps,
  AiLimitConfig,
  AiLimitLinkRenderProps,
  AiLimitLinkRenderer,
  AiLimitNoticeProps,
  ChatStarter,
  ToolLabel,
  ToolStepState,
} from "./types";
export type { LoomUserMessageProps } from "./user-message";
export type { WeaveMarkProps } from "./weave-mark";
