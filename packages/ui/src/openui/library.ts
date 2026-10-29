import { createLibrary } from "@openuidev/react-lang";

// Layout components
import { Card } from "./components/layout/card";
import { Section } from "./components/layout/section";
import { Stack } from "./components/layout/stack";
import { Tabs } from "./components/layout/tabs";
import { Text } from "./components/layout/text";

// Form components
import { CurrencyInput } from "./components/forms/currency-input";
import { DatePicker } from "./components/forms/date-picker";
import { DateTimeInput } from "./components/forms/date-time-input";
import { EntitySelect } from "./components/forms/entity-select";
import { FormGroup } from "./components/forms/form-group";
import { JsonInput } from "./components/forms/json-input";
import { MetadataSelect } from "./components/forms/metadata-select";
import { MultiSelect } from "./components/forms/multi-select";
import { NumberInput } from "./components/forms/number-input";
import { PercentageInput } from "./components/forms/percentage-input";
import { ReadOnlyField } from "./components/forms/read-only-field";
import { Select } from "./components/forms/select";
import { TagsInput } from "./components/forms/tags-input";
import { TextInput } from "./components/forms/text-input";
import { Toggle } from "./components/forms/toggle";

// Data display components
import { BadgeGroup } from "./components/data-display/badge-group";
import { DataTable } from "./components/data-display/data-table";
import { ListBlock } from "./components/data-display/list-block";
import { StatCard } from "./components/data-display/stat-card";

// Onboarding components
import { FeatureCard } from "./components/onboarding/feature-card";
import { IndustrySelect } from "./components/onboarding/industry-select";
import { RuleTemplate } from "./components/onboarding/rule-template";
import { SetupSummary } from "./components/onboarding/setup-summary";
import { TierConfig } from "./components/onboarding/tier-config";

// Feedback components
import { Alert } from "./components/feedback/alert";
import { Confirmation } from "./components/feedback/confirmation";
import { Download } from "./components/feedback/download";
import { FollowUp } from "./components/feedback/follow-up";
import { Progress } from "./components/feedback/progress";
import { RuleOrFlowDraft } from "./components/feedback/rule-or-flow-draft";
import { ValidationReport } from "./components/feedback/validation-report";

/**
 * Creates the Loom Loyalty OpenUI component library.
 *
 * This library provides 35 components across 5 groups:
 * - Layout: Stack (root), Text, Card, Section, Tabs
 * - Forms: FormGroup, TextInput, NumberInput, Select, Toggle, DatePicker, MetadataSelect, EntitySelect,
 *          MultiSelect, DateTimeInput, CurrencyInput, PercentageInput, TagsInput, ReadOnlyField, JsonInput
 * - Data Display: DataTable, StatCard, ListBlock, BadgeGroup
 * - Onboarding: FeatureCard, IndustrySelect, TierConfig, RuleTemplate, SetupSummary
 * - Feedback: Alert, FollowUp, Confirmation, Download, Progress, ValidationReport, RuleOrFlowDraft
 */
export function createLoomLibrary() {
  return createLibrary({
    components: [
      // Layout
      Stack,
      Text,
      Card,
      Section,
      Tabs,
      // Forms
      FormGroup,
      TextInput,
      NumberInput,
      Select,
      Toggle,
      DatePicker,
      MetadataSelect,
      EntitySelect,
      MultiSelect,
      DateTimeInput,
      CurrencyInput,
      PercentageInput,
      TagsInput,
      ReadOnlyField,
      JsonInput,
      // Data Display
      DataTable,
      StatCard,
      ListBlock,
      BadgeGroup,
      // Onboarding
      FeatureCard,
      IndustrySelect,
      TierConfig,
      RuleTemplate,
      SetupSummary,
      // Feedback
      Alert,
      FollowUp,
      Confirmation,
      Download,
      Progress,
      ValidationReport,
      RuleOrFlowDraft,
    ],
    componentGroups: [
      { name: "Layout", components: ["Stack", "Text", "Card", "Section", "Tabs"] },
      {
        name: "Forms",
        components: [
          "FormGroup",
          "TextInput",
          "NumberInput",
          "Select",
          "Toggle",
          "DatePicker",
          "MetadataSelect",
          "EntitySelect",
          "MultiSelect",
          "DateTimeInput",
          "CurrencyInput",
          "PercentageInput",
          "TagsInput",
          "ReadOnlyField",
          "JsonInput",
        ],
      },
      {
        name: "Data Display",
        components: ["DataTable", "StatCard", "ListBlock", "BadgeGroup"],
      },
      {
        name: "Onboarding",
        components: ["FeatureCard", "IndustrySelect", "TierConfig", "RuleTemplate", "SetupSummary"],
      },
      {
        name: "Feedback",
        components: [
          "Alert",
          "FollowUp",
          "Confirmation",
          "Download",
          "Progress",
          "ValidationReport",
          "RuleOrFlowDraft",
        ],
      },
    ],
    root: "Stack",
  });
}

let loomLibrary: ReturnType<typeof createLoomLibrary> | undefined;

/**
 * Returns the shared Loom library, building it on first use.
 *
 * Not built at module load: createLibrary() generates a random library id, and
 * Cloudflare Workers forbid random values in global scope, so importing this
 * module during SSR would fail every request.
 */
export function getLoomLibrary() {
  loomLibrary ??= createLoomLibrary();
  return loomLibrary;
}
