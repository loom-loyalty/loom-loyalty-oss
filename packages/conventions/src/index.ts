/**
 * @loom-loyalty/conventions
 *
 * Platform naming conventions, in one place. Zero runtime dependencies so any
 * package or app can depend on it without pulling in a feature package.
 */

export {
  EVENT_TYPE_CODE_MESSAGE,
  EVENT_TYPE_CODE_PATTERN,
  RESOURCE_CODE_MESSAGE,
  RESOURCE_CODE_PATTERN,
  isEventTypeCode,
  isResourceCode,
  toEventTypeCode,
  toResourceCode,
} from "./codes.js";
