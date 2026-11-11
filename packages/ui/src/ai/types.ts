/**
 * AI Chat UI Component Types
 *
 * Props and configuration types for the AI chat panel.
 */

import type { AiLimit } from "@loom-loyalty/core";
import type { ReactNode } from "react";

import type { AiChatCustomActionHandler } from "./chat-action-context";
import type { InitialHandoffs } from "./initial-handoffs";

// =============================================================================
// Panel Props
// =============================================================================

/** Connection and behavior shared by every chat surface (`AiChatProviders`). */
export interface AiChatConnectionProps {
  /** AI API base URL */
  baseUrl: string;
  /** Token provider for direct JWT auth (omit for BFF cookie auth) */
  getToken?: () => Promise<string>;
  /** Fetch credentials mode */
  credentials?: RequestCredentials;
  /** Initial message to send automatically when the panel opens */
  initialMessage?: string;
  /** Called after the initial message has been consumed */
  onInitialMessageSent?: () => void;
  /** An existing thread to select as soon as the chat mounts (the home page's recent list) */
  initialThreadId?: string;
  /** Called once the initial thread has been selected */
  onInitialThreadOpened?: () => void;
  /**
   * Handles card actions the chat doesn't handle itself, such as opening a drafted
   * rule in an editor. Return true when handled. Params come from the model: validate them.
   */
  onCustomAction?: AiChatCustomActionHandler;
  /**
   * Upgrade link for the daily AI limit notice (shown to trial orgs only).
   * Falls back to the nearest `AiLimitProvider`.
   */
  aiLimitUpgradeHref?: string;
  /**
   * The white-label brand the assistant speaks for: the chat calls the
   * assistant "<brand> AI" instead of Weave. Omit on Loom Loyalty's own hosts.
   */
  brandName?: string;
}

/** Props for {@link AiChatProviders}: the connection plus the surface it wraps. */
export interface AiChatProvidersProps extends AiChatConnectionProps {
  children: ReactNode;
  /**
   * Claim-once handoffs built by a component that outlives the providers
   * (`useInitialHandoffs` in `AiChatPanel`). Omit to build them here.
   */
  handoffs?: InitialHandoffs;
}

/** Props for the AiChatPanel Sheet. */
export interface AiChatPanelProps extends AiChatConnectionProps {
  /** Whether the panel is open */
  open: boolean;
  /** Callback when open state changes */
  onOpenChange: (open: boolean) => void;
}

// =============================================================================
// Tool activity
// =============================================================================

/** Display state of one tool step in the activity card. */
export type ToolStepState = "running" | "done" | "error";

/** Present- and past-tense labels for one tool. */
export interface ToolLabel {
  running: string;
  done: string;
}

/** A one-click prompt on the empty chat. */
export interface ChatStarter {
  label: string;
  prompt: string;
}

// =============================================================================
// AI daily limit
// =============================================================================

/** Props handed to a custom upgrade-link renderer (e.g. a router `Link`). */
export interface AiLimitLinkRenderProps {
  href: string;
  className: string;
  children: ReactNode;
}

/** Renders the notice's upgrade link; lets an app swap in its router link. */
export type AiLimitLinkRenderer = (props: AiLimitLinkRenderProps) => ReactNode;

/** App-wide settings for AI limit notices, supplied by `AiLimitProvider`. */
export interface AiLimitConfig {
  /** Where "See plans" points. Omit to show the notice without a link. */
  upgradeHref?: string;
  /** Custom link renderer; defaults to a plain anchor. */
  renderLink?: AiLimitLinkRenderer;
}

/** Props for {@link AiLimitNotice}. */
export interface AiLimitNoticeProps extends AiLimitConfig {
  /** The parsed refusal from `readAiLimit`. */
  limit: AiLimit;
  className?: string;
}

/** Chat-panel state for a limit refusal captured from the stream. */
export interface ChatAiLimitState {
  limit: AiLimit | null;
  clear: () => void;
}
