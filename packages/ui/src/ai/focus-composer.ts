/**
 * Moves focus to the chat composer in the Sheet that contains `from`. Used by
 * controls that disable themselves after a click, so keyboard users aren't
 * dropped to <body>.
 */
export function focusComposerNear(from: Element): void {
  from
    .closest('[role="dialog"]')
    ?.querySelector<HTMLTextAreaElement>("[data-loom-composer-input]")
    ?.focus();
}
