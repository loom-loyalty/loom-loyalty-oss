/**
 * CodeGenInformationInput - Code generation configuration component
 *
 * A composite form component for configuring code generation settings.
 * Supports type selection, prefix/suffix, algorithms, and check digit configuration.
 *
 * Uses SDK types for CodeGenInformation configuration.
 *
 * @example
 * ```tsx
 * const [codeGenInfo, setCodeGenInfo] = useState<CodeGenInformation | undefined>();
 *
 * <CodeGenInformationInput
 *   value={codeGenInfo}
 *   onChange={setCodeGenInfo}
 *   showCard
 *   title="Account ID Generation"
 *   description="Configure how account IDs are generated"
 * />
 * ```
 */

import type {
  CodeGenInformation,
  CodeGenInformationCheckDigitAlgorithm,
  CodeGenInformationPart1Algorithm,
  CodeGenInformationPart2Algorithm,
  CodeGenInformationType,
} from "@loom-loyalty/sdk";
import { Info } from "lucide-react";
import * as React from "react";

import { VisuallyHidden } from "../a11y/visually-hidden";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../primitives/card";
import { Input } from "../primitives/input";
import { Label } from "../primitives/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../primitives/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "../primitives/tooltip";

// ============================================================================
// Type Options
// ============================================================================

interface TypeOption {
  value: CodeGenInformationType;
  label: string;
  description: string;
}

const CODE_GEN_TYPES: TypeOption[] = [
  {
    value: "EXTERNAL",
    label: "External",
    description: "Code must be provided externally",
  },
  {
    value: "EXTERNAL_IF_NOT_PROVIDED",
    label: "External if not provided",
    description: "Use external code if provided, otherwise leave empty",
  },
  {
    value: "GENERATED",
    label: "Generated",
    description: "Always generate code automatically",
  },
  {
    value: "GENERATED_IF_NOT_PROVIDED",
    label: "Generated if not provided",
    description: "Generate code if not provided externally",
  },
  {
    value: "PROVIDED",
    label: "Provided",
    description: "Code must be provided",
  },
];

// ============================================================================
// Algorithm Options
// ============================================================================

interface AlgorithmOption {
  value: CodeGenInformationPart1Algorithm | CodeGenInformationPart2Algorithm;
  label: string;
}

const CODE_GEN_ALGORITHMS: AlgorithmOption[] = [
  { value: "ALPHABETICAL", label: "Alphabetical (A-Z)" },
  { value: "ALPHANUMERIC", label: "Alphanumeric (A-Z, 0-9)" },
  { value: "NUMERIC", label: "Numeric (0-9)" },
  { value: "UUID", label: "UUID" },
  { value: "NULL", label: "None" },
];

interface CheckDigitAlgorithmOption {
  value: CodeGenInformationCheckDigitAlgorithm;
  label: string;
}

const CODE_GEN_CHECK_DIGIT_ALGORITHMS: CheckDigitAlgorithmOption[] = [
  { value: "MOD_10", label: "Mod 10" },
  { value: "LUHN", label: "Luhn" },
];

// ============================================================================
// Sub-components
// ============================================================================

interface CodeGenTypeSelectProps {
  value?: CodeGenInformationType;
  onValueChange?: (value: CodeGenInformationType) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
}

function CodeGenTypeSelect({
  value,
  onValueChange,
  placeholder = "Select type...",
  disabled = false,
  className,
  id,
}: CodeGenTypeSelectProps): React.ReactNode {
  return (
    <Select value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger className={className} id={id}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {CODE_GEN_TYPES.map((type) => (
          <SelectItem key={type.value} value={type.value}>
            {type.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

interface CodeGenAlgorithmSelectProps {
  value?: CodeGenInformationPart1Algorithm | CodeGenInformationPart2Algorithm;
  onValueChange?: (
    value: CodeGenInformationPart1Algorithm | CodeGenInformationPart2Algorithm
  ) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
}

function CodeGenAlgorithmSelect({
  value,
  onValueChange,
  placeholder = "Select algorithm...",
  disabled = false,
  className,
  id,
}: CodeGenAlgorithmSelectProps): React.ReactNode {
  return (
    <Select value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger className={className} id={id}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {CODE_GEN_ALGORITHMS.map((algorithm) => (
          <SelectItem key={algorithm.value} value={algorithm.value}>
            {algorithm.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

interface CodeGenCheckDigitAlgorithmSelectProps {
  value?: CodeGenInformationCheckDigitAlgorithm;
  onValueChange?: (value: CodeGenInformationCheckDigitAlgorithm) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
  "aria-describedby"?: string;
}

function CodeGenCheckDigitAlgorithmSelect({
  value,
  onValueChange,
  placeholder = "Select check digit algorithm...",
  disabled = false,
  className,
  id,
  "aria-describedby": ariaDescribedBy,
}: CodeGenCheckDigitAlgorithmSelectProps): React.ReactNode {
  return (
    <Select value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger className={className} id={id} aria-describedby={ariaDescribedBy}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {CODE_GEN_CHECK_DIGIT_ALGORITHMS.map((algorithm) => (
          <SelectItem key={algorithm.value} value={algorithm.value}>
            {algorithm.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export interface CodeGenInformationInputProps {
  /** Current CodeGenInformation value */
  value?: CodeGenInformation;
  /** Callback when value changes */
  onChange?: (value: CodeGenInformation | undefined) => void;
  /** Disable all inputs */
  disabled?: boolean;
  /**
   * Show as a card with header
   * @default true
   */
  showCard?: boolean;
  /**
   * Card title (when showCard is true)
   * @default "Code Generation"
   */
  title?: string;
  /**
   * Card description (when showCard is true)
   */
  description?: string;
  /**
   * Hide the internal "Code Type" select, rendering only the conditional
   * algorithm sub-fields (prefix/suffix/part1/part2/check-digit). For a
   * caller that owns its own discriminator for `type` (e.g. the Offer
   * create sheet's "Coupon Code Source" field) — avoids two uncoordinated
   * type controls in the same form. The caller must set `value.type`
   * itself when this is enabled; this component no longer offers a way to.
   * @default false
   */
  hideTypeSelector?: boolean;
}

/**
 * CodeGenInformationInput - Composite component for code generation configuration
 *
 * Renders type selection and conditionally shows algorithm configuration
 * fields when the type is GENERATED or GENERATED_IF_NOT_PROVIDED.
 */
function CodeGenInformationInput({
  value,
  onChange,
  disabled = false,
  showCard = true,
  title = "Code Generation",
  description = "Configure how codes are generated for this entity",
  hideTypeSelector = false,
}: CodeGenInformationInputProps): React.ReactNode {
  const checkDigitTriggerId = React.useId();
  const checkDigitDescId = React.useId();
  const handleFieldChange = <K extends keyof CodeGenInformation>(
    field: K,
    fieldValue: CodeGenInformation[K]
  ) => {
    const newValue = {
      ...value,
      [field]: fieldValue,
    } as CodeGenInformation;

    onChange?.(newValue);
  };

  // Only show part1/part2 fields for GENERATED types
  const showGeneratedFields =
    value?.type === "GENERATED" || value?.type === "GENERATED_IF_NOT_PROVIDED";

  const content = (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Type (Required) — omitted when hideTypeSelector is set; the caller
          owns its own discriminator for `type` in that case (e.g. the Offer
          create sheet's "Coupon Code Source" field) and sets it directly on
          `value`, so rendering this Select too would create two uncoordinated
          controls for the same underlying field. */}
      {!hideTypeSelector && (
        <div className="space-y-2 lg:col-span-2">
          {/* "Code Type", not the bare "Type" the label used to read: this component is
              embedded inside forms (e.g. the Offer create sheet) that already have their
              own unrelated "Type" field, and a bare label here now that it's actually
              wired to a real control (previously htmlFor pointed at a non-existent id) is
              ambiguous for anyone querying by accessible name. */}
          <Label htmlFor="codeGenType">
            Code Type <span className="text-destructive">*</span>
          </Label>
          <CodeGenTypeSelect
            id="codeGenType"
            value={value?.type}
            onValueChange={(val) => handleFieldChange("type", val)}
            disabled={disabled}
          />
        </div>
      )}

      {/* All generation fields - only for GENERATED types */}
      {showGeneratedFields && (
        <>
          {/* Prefix */}
          <div className="space-y-2">
            <Label htmlFor="prefix">Prefix</Label>
            <Input
              id="prefix"
              value={value?.prefix || ""}
              onChange={(e) => handleFieldChange("prefix", e.target.value)}
              disabled={disabled}
              placeholder="e.g., PRG-"
            />
          </div>

          {/* Suffix */}
          <div className="space-y-2">
            <Label htmlFor="suffix">Suffix</Label>
            <Input
              id="suffix"
              value={value?.suffix || ""}
              onChange={(e) => handleFieldChange("suffix", e.target.value)}
              disabled={disabled}
              placeholder="e.g., -001"
            />
          </div>

          {/* Part 1 Algorithm */}
          <div className="space-y-2">
            <Label htmlFor="part1Algorithm">Part 1 Algorithm</Label>
            <CodeGenAlgorithmSelect
              id="part1Algorithm"
              value={value?.part1Algorithm}
              onValueChange={(val) =>
                handleFieldChange("part1Algorithm", val as CodeGenInformationPart1Algorithm)
              }
              disabled={disabled}
            />
          </div>

          {/* Part 1 Length */}
          <div className="space-y-2">
            <Label htmlFor="part1Length">Part 1 Length</Label>
            <Input
              id="part1Length"
              type="number"
              min="0"
              value={value?.part1Length ?? ""}
              onChange={(e) =>
                handleFieldChange(
                  "part1Length",
                  e.target.value ? parseInt(e.target.value, 10) : undefined
                )
              }
              disabled={disabled || !value?.part1Algorithm || value.part1Algorithm === "NULL"}
              placeholder="e.g., 8"
            />
          </div>

          {/* Part 2 Algorithm */}
          <div className="space-y-2">
            <Label htmlFor="part2Algorithm">Part 2 Algorithm</Label>
            <CodeGenAlgorithmSelect
              id="part2Algorithm"
              value={value?.part2Algorithm}
              onValueChange={(val) =>
                handleFieldChange("part2Algorithm", val as CodeGenInformationPart2Algorithm)
              }
              disabled={disabled}
            />
          </div>

          {/* Part 2 Length */}
          <div className="space-y-2">
            <Label htmlFor="part2Length">Part 2 Length</Label>
            <Input
              id="part2Length"
              type="number"
              min="0"
              value={value?.part2Length ?? ""}
              onChange={(e) =>
                handleFieldChange(
                  "part2Length",
                  e.target.value ? parseInt(e.target.value, 10) : undefined
                )
              }
              disabled={disabled || !value?.part2Algorithm || value.part2Algorithm === "NULL"}
              placeholder="e.g., 4"
            />
          </div>

          {/* Check Digit Algorithm */}
          <div className="space-y-2 lg:col-span-2">
            <div className="flex items-center gap-1.5">
              <Label htmlFor={checkDigitTriggerId}>Check Digit Algorithm</Label>
              <Tooltip>
                <TooltipTrigger
                  type="button"
                  aria-label="Check Digit Algorithm help"
                  className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 inline-flex h-11 w-11 items-center justify-center rounded-sm focus-visible:ring-2 focus-visible:outline-none"
                >
                  <Info className="h-4 w-4" aria-hidden="true" />
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs text-left">
                  <p className="mb-1">
                    <strong>Mod 10</strong> — Simple modulo-10 checksum. Detects single-digit
                    errors. Use for internal IDs.
                  </p>
                  <p>
                    <strong>Luhn</strong> — Credit-card-grade checksum. Detects single-digit errors
                    and adjacent-digit transpositions. Use for customer-facing IDs.
                  </p>
                </TooltipContent>
              </Tooltip>
            </div>
            <CodeGenCheckDigitAlgorithmSelect
              id={checkDigitTriggerId}
              aria-describedby={checkDigitDescId}
              value={value?.checkDigitAlgorithm}
              onValueChange={(val) => handleFieldChange("checkDigitAlgorithm", val)}
              disabled={disabled}
            />
            <VisuallyHidden>
              <span id={checkDigitDescId}>
                Mod 10 is a simple modulo-10 checksum that detects single-digit errors; use it for
                internal IDs. Luhn is a credit-card-grade checksum that detects single-digit errors
                and adjacent-digit transpositions; use it for customer-facing IDs.
              </span>
            </VisuallyHidden>
          </div>
        </>
      )}
    </div>
  );

  if (!showCard) {
    return content;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>{content}</CardContent>
    </Card>
  );
}

// Export the algorithm constants for external use
export {
  CODE_GEN_ALGORITHMS,
  CODE_GEN_CHECK_DIGIT_ALGORITHMS,
  CODE_GEN_TYPES,
  CodeGenInformationInput,
};
