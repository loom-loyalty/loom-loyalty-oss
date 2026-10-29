/**
 * @loom-loyalty/ui/openui
 *
 * OpenUI component library for Loom Loyalty.
 * Wraps the existing UI primitives as OpenUI components
 * for use with AI-powered generative interfaces.
 */

// Must run before @openuidev/react-lang evaluates (see disable-devtools.ts).
import "./disable-devtools";

// Library
export { createLoomLibrary, getLoomLibrary } from "./library";

// Runtime context for components that need server access (auth + baseUrl).
export {
  OpenUIRuntimeProvider,
  useOpenUIRuntime,
  type OpenUIRuntimeConfig,
  type OpenUIRuntimeProviderProps,
} from "./runtime-context";

// Types and utilities
export { actionSchema, resolveIcon, sizeSchema, variantSchema } from "./types";

// Layout components
export { Card } from "./components/layout/card";
export { Section } from "./components/layout/section";
export { Stack } from "./components/layout/stack";
export { Tabs } from "./components/layout/tabs";
export { Text } from "./components/layout/text";

// Form components
export { CurrencyInput } from "./components/forms/currency-input";
export { DatePicker } from "./components/forms/date-picker";
export { DateTimeInput } from "./components/forms/date-time-input";
export { EntitySelect } from "./components/forms/entity-select";
export { FormGroup } from "./components/forms/form-group";
export { JsonInput } from "./components/forms/json-input";
export { MetadataSelect } from "./components/forms/metadata-select";
export { MultiSelect } from "./components/forms/multi-select";
export { NumberInput } from "./components/forms/number-input";
export { PercentageInput } from "./components/forms/percentage-input";
export { ReadOnlyField } from "./components/forms/read-only-field";
export { Select } from "./components/forms/select";
export { TagsInput } from "./components/forms/tags-input";
export { TextInput } from "./components/forms/text-input";
export { Toggle } from "./components/forms/toggle";

// Data display components
export { BadgeGroup } from "./components/data-display/badge-group";
export { DataTable } from "./components/data-display/data-table";
export { ListBlock } from "./components/data-display/list-block";
export { StatCard } from "./components/data-display/stat-card";

// Onboarding components
export { LoomDiffView } from "./components/onboarding/diff-view";
export { FeatureCard } from "./components/onboarding/feature-card";
export { IndustrySelect } from "./components/onboarding/industry-select";
export { PendingExtractionList } from "./components/onboarding/pending-extraction-list";
export { RuleTemplate } from "./components/onboarding/rule-template";
export { SetupSummary } from "./components/onboarding/setup-summary";
export { TierConfig } from "./components/onboarding/tier-config";

// Feedback components
export { Alert } from "./components/feedback/alert";
export { Confirmation } from "./components/feedback/confirmation";
export { Download } from "./components/feedback/download";
export { FollowUp } from "./components/feedback/follow-up";
export { Progress } from "./components/feedback/progress";
export {
  OPEN_DRAFT_IN_EDITOR_ACTION,
  RuleOrFlowDraft,
  ruleOrFlowDraftSchema,
} from "./components/feedback/rule-or-flow-draft";
export type {
  DraftTargetData,
  RuleOrFlowDraftData,
} from "./components/feedback/rule-or-flow-draft";
export { ValidationReport } from "./components/feedback/validation-report";
