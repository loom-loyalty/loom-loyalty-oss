/**
 * Forms - Composite form components
 */
export {
  CodeInput,
  formatTransforms,
  useCodeInput,
  validateCode,
  type CodeFormat,
  type CodeInputProps,
  type CodePattern,
} from "./code-input";

export {
  CODE_GEN_ALGORITHMS,
  CODE_GEN_CHECK_DIGIT_ALGORITHMS,
  CODE_GEN_TYPES,
  CodeGenInformationInput,
  type CodeGenInformationInputProps,
} from "./code-gen-information-input";

export { CodeEditor, type CodeEditorProps } from "./code-editor";

export {
  FiatCurrencyInput,
  type FiatCurrencyInputProps,
  type FiatCurrencyValue,
} from "./fiat-currency-input";

export { DatePicker, type DatePickerProps } from "./date-picker";

export {
  DiscriminatorRadioGroup,
  type DiscriminatorRadioGroupOption,
  type DiscriminatorRadioGroupProps,
} from "./discriminator-radio-group";

export {
  DurationPeriodBuilder,
  type DurationPeriodBuilderProps,
  type DurationPeriodValue,
} from "./duration-period-builder";

export { ConsentCheckbox, type ConsentCheckboxProps } from "./consent-checkbox";
export {
  FieldErrorMessage,
  FieldErrorsProvider,
  WithFieldError,
  useFieldError,
  type FieldErrorMessageProps,
  type FieldErrorState,
  type FieldErrorsProviderProps,
  type FormFieldError,
  type WithFieldErrorProps,
} from "./field-errors";
export { FormErrorBanner, type FormErrorBannerProps } from "./form-error-banner";
export { FormSheet, type FormSheetError, type FormSheetProps } from "./form-sheet";

export { MaskedField, type MaskedFieldProps } from "./masked-field";

export {
  LocalizedStringInput,
  type LocalizedString,
  type LocalizedStringInputProps,
} from "./localized-string-input";

export { MultiSelect, type MultiSelectOption, type MultiSelectProps } from "./multi-select";

export {
  PopoverMultiSelect,
  type PopoverMultiSelectOption,
  type PopoverMultiSelectProps,
} from "./popover-multi-select";

export {
  FormSection,
  FormSectionCard,
  type FormSectionCardProps,
  type FormSectionProps,
} from "./form-section";

export {
  InlineToggleField,
  ToggleField,
  type InlineToggleFieldProps,
  type ToggleFieldProps,
} from "./toggle-field";

export {
  CompactRuleTemplateCard,
  RuleTemplateCard,
  RuleTemplateGrid,
  type CompactRuleTemplateCardProps,
  type RuleTemplate,
  type RuleTemplateCardProps,
  type RuleTemplateGridProps,
} from "./rule-template-card";

export {
  CategoryBadge,
  MetadataSelectBox,
  useMetadataSelection,
  type MetadataCategory,
  type MetadataOption,
  type MetadataSelectBoxProps,
  type SuggestedOption,
} from "./metadata-select-box";

export {
  MetadataCreateSheet,
  type CreateMetadataData,
  type DataModelOption,
  type MetadataCreateSheetProps,
  type MetadataTypeCategory,
} from "./metadata-create-sheet";

export {
  EMPTY_METADATA_SUB_TYPE_VALUES,
  METADATA_SUB_TYPE_CATEGORIES,
  MetadataSubTypeFields,
  buildMetadataSubTypePayload,
  isMetadataSubTypeCategory,
  useMetadataSubTypeOptions,
  useMetadataTypeCategory,
  validateMetadataForm,
  validateMetadataSubType,
  type MetadataSubTypeFieldsProps,
  type MetadataSubTypePayload,
  type MetadataSubTypeValues,
} from "./metadata-sub-type-fields";

export {
  MetadataField,
  SUGGESTED_BADGE_TYPES,
  SUGGESTED_COMPLETION_TARGET_TYPES,
  SUGGESTED_COUNTER_TARGET_TYPES,
  SUGGESTED_CURRENCY_TYPES,
  SUGGESTED_EVENT_TYPES,
  SUGGESTED_MILESTONE_TARGET_TYPES,
  SUGGESTED_OPTIONS_MAP,
  SUGGESTED_PARTNER_TYPES,
  SUGGESTED_PROGRAM_TYPES,
  SUGGESTED_TIER_TYPES,
  SUGGESTED_XOFY_TARGET_TYPES,
  useMetadataField,
  type AnyCreatePayload,
  type MetadataFieldProps,
  type UseMetadataFieldReturn,
} from "./metadata-field";

export {
  filterTypesInFamily,
  useAllDataModelTypes,
  useDataModelField,
  type TypeFamilyResult,
  type UseDataModelFieldReturn,
} from "./data-model-field";

export { EntitySelectBox, type EntityOption, type EntitySelectBoxProps } from "./entity-select-box";

export {
  PartnerField,
  usePartnerField,
  type PartnerFieldProps,
  type UsePartnerFieldReturn,
} from "./partner-field";

export {
  LocationField,
  useLocationField,
  type LocationFieldProps,
  type UseLocationFieldReturn,
} from "./location-field";

export {
  ProgramField,
  ProgramMultiField,
  useProgramField,
  type ProgramFieldProps,
  type ProgramMultiFieldProps,
  type UseProgramFieldReturn,
} from "./program-field";

export {
  TierField,
  useTierField,
  type TierFieldProps,
  type UseTierFieldReturn,
} from "./tier-field";

export {
  BadgeField,
  useBadgeField,
  type BadgeFieldProps,
  type UseBadgeFieldReturn,
} from "./badge-field";

export {
  AudienceField,
  useAudienceField,
  type AudienceFieldProps,
  type UseAudienceFieldReturn,
} from "./audience-field";

export {
  CustomerAudienceField,
  useCustomerAudienceField,
  type CustomerAudienceFieldProps,
  type UseCustomerAudienceFieldOptions,
  type UseCustomerAudienceFieldReturn,
} from "./customer-audience-field";

export {
  TargetField,
  useTargetField,
  type TargetFieldProps,
  type UseTargetFieldReturn,
} from "./target-field";

export {
  ProgramCurrencyField,
  useProgramCurrencyField,
  type ProgramCurrencyFieldProps,
  type UseProgramCurrencyFieldReturn,
} from "./program-currency-field";

export {
  OfferField,
  useOfferField,
  type OfferFieldProps,
  type UseOfferFieldReturn,
} from "./offer-field";

export {
  EventRuleField,
  useEventRuleField,
  type EventRuleFieldProps,
  type UseEventRuleFieldReturn,
} from "./event-rule-field";

export {
  EventTypeField,
  useEventTypeField,
  type EventTypeFieldProps,
  type UseEventTypeFieldReturn,
} from "./event-type-field";

export {
  EventTriggerField,
  useEventTriggerField,
  type EventTriggerFieldProps,
  type EventTriggerValue,
  type UseEventTriggerFieldReturn,
} from "./event-trigger-field";

export {
  MetadataTypeField,
  metadataTypeChildParams,
  metadataTypeChildrenQueryKey,
  metadataTypeChildrenQueryOptions,
  metadataTypeParentsQueryKey,
  metadataTypeParentsQueryOptions,
  useMetadataTypeField,
  type MetadataTypeFieldProps,
  type UseMetadataTypeFieldReturn,
} from "./metadata-type-field";

export { CurrencyInput, type CurrencyInputProps } from "./currency-input";

export { DateTimeInput, type DateTimeInputProps } from "./date-time-input";

export { JsonInput, type JsonInputProps } from "./json-input";

export { PercentageInput, type PercentageInputProps } from "./percentage-input";

export { ReadOnlyField, type ReadOnlyFieldProps } from "./read-only-field";

export { TagsInput, type TagsInputProps } from "./tags-input";

// Schema-driven form system
export { ImageUploadField, type ImageUploadFieldProps } from "./image-upload-field";
export * from "./schema-form";
