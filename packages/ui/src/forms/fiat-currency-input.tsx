/**
 * FiatCurrencyInput - Composite input for a monetary amount and currency code.
 */

import { useId, useState, type ReactNode } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../primitives/card";
import { Input } from "../primitives/input";
import { Label } from "../primitives/label";
import { MetadataField } from "./metadata-field/index.js";

export interface FiatCurrencyValue {
  amount?: number;
  currencyTypeCode?: string;
}

export interface FiatCurrencyInputProps {
  /** Base id used to derive the amount and currency control ids. */
  id?: string;
  /** Current FiatCurrency value */
  value?: FiatCurrencyValue;
  /** Callback when either part of the value changes */
  onChange?: (value: FiatCurrencyValue | undefined) => void;
  /** Disable both controls */
  disabled?: boolean;
  /** Show as a card with a header */
  showCard?: boolean;
  /** Card title (when showCard is true) */
  title?: string;
  /** Card description (when showCard is true) */
  description?: string;
  /** Additional class name applied to both controls. */
  className?: string;
  /** Marks the field invalid for assistive technology. */
  "aria-invalid"?: boolean;
  /** IDs of the field's associated hint and error text. */
  "aria-describedby"?: string;
  /** Whether both parts of the value are required. */
  required?: boolean;
}

function isCompleteNumber(value: string): boolean {
  return /^[+-]?(?:\d+|\d+\.\d+|\.\d+)(?:[eE][+-]?\d+)?$/.test(value);
}

export function FiatCurrencyInput({
  id: providedId,
  value,
  onChange,
  disabled = false,
  showCard = true,
  title = "Fiat Currency",
  description = "Enter an amount and select its currency.",
  className,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy,
  required = false,
}: FiatCurrencyInputProps): ReactNode {
  const generatedId = useId();
  const id = providedId ?? generatedId;
  const amountId = `${id}-amount`;
  const currencyId = `${id}-currency`;
  const [amountText, setAmountText] = useState(() => String(value?.amount ?? ""));
  const [syncedAmount, setSyncedAmount] = useState(value?.amount);
  if (value?.amount !== syncedAmount) {
    setSyncedAmount(value?.amount);
    setAmountText(String(value?.amount ?? ""));
  }

  const handleFieldChange = <K extends keyof FiatCurrencyValue>(
    field: K,
    fieldValue: FiatCurrencyValue[K]
  ) => {
    const nextValue = { ...value, [field]: fieldValue };
    onChange?.(
      nextValue.amount === undefined && nextValue.currencyTypeCode === undefined
        ? undefined
        : nextValue
    );
  };

  const content = (
    <div className="grid gap-6 sm:grid-cols-2">
      <div className="space-y-2">
        <Label htmlFor={amountId}>
          Amount {required && <span className="text-destructive">*</span>}
        </Label>
        <Input
          id={amountId}
          type="text"
          inputMode="decimal"
          value={amountText}
          onChange={(event) => {
            const raw = event.target.value;
            setAmountText(raw);
            if (raw === "") {
              handleFieldChange("amount", undefined);
              return;
            }
            if (isCompleteNumber(raw)) {
              const amount = Number(raw);
              if (Number.isFinite(amount)) {
                handleFieldChange("amount", amount);
              }
            }
          }}
          disabled={disabled}
          placeholder="e.g., 12.50"
          className={className}
          aria-invalid={ariaInvalid}
          aria-describedby={ariaDescribedBy}
          aria-required={required || undefined}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={currencyId}>
          Currency {required && <span className="text-destructive">*</span>}
        </Label>
        <MetadataField
          id={currencyId}
          typeCode="FIAT_CURRENCY_TYPE"
          typeLabel="Currency"
          value={value?.currencyTypeCode ?? ""}
          onValueChange={(currencyTypeCode) =>
            handleFieldChange("currencyTypeCode", currencyTypeCode || undefined)
          }
          placeholder="Select a currency..."
          disabled={disabled}
          className={className}
          aria-invalid={ariaInvalid}
          aria-describedby={ariaDescribedBy}
          aria-required={required || undefined}
        />
      </div>
    </div>
  );

  if (!showCard) return content;

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
