/**
 * Picks the face values members can redeem a partner item at. A fixed-amount
 * item lists its amounts; a range item lists round amounts in the range and
 * takes a custom one. Only amounts the partner sells without a loss can be
 * picked; the rest show disabled.
 */
import { useId, useState, type FormEvent, type ReactNode } from "react";

import { Button } from "../../../primitives/button.js";
import { Checkbox } from "../../../primitives/checkbox.js";
import { Input } from "../../../primitives/input.js";
import {
  amountChoices,
  formatFaceValue,
  hasFixedAmounts,
  isOfferableAt,
  isSoldAt,
  MAX_LINK_DENOMINATIONS,
  type FaceValueSource,
} from "./face-values.js";

export interface AmountPickerProps {
  item: FaceValueSource;
  /** Ticked amounts. */
  value: number[];
  onValueChange: (amounts: number[]) => void;
  /** Accessible name of the group, e.g. the item's name. */
  label: string;
  disabled?: boolean;
}

export function AmountPicker({
  item,
  value,
  onValueChange,
  label,
  disabled = false,
}: AmountPickerProps): ReactNode {
  const groupId = useId();
  const currency = item.currency ?? "USD";
  const [custom, setCustom] = useState("");
  const [customError, setCustomError] = useState<string | null>(null);
  const choices = [...new Set([...amountChoices(item), ...value])].sort((a, b) => a - b);
  const full = value.length >= MAX_LINK_DENOMINATIONS;
  const someUnprofitable = choices.some((amount) => !isOfferableAt(item, amount));

  const toggle = (amount: number, checked: boolean) => {
    const next = checked ? [...value, amount] : value.filter((v) => v !== amount);
    onValueChange([...new Set(next)].sort((a, b) => a - b));
  };

  const addCustom = (event: FormEvent) => {
    event.preventDefault();
    const amount = Number(custom);
    if (!isSoldAt(item, amount)) {
      setCustomError(`This item isn't sold at ${custom || "that amount"}.`);
      return;
    }
    if (!isOfferableAt(item, amount)) {
      setCustomError(
        `${formatFaceValue(amount, currency)} costs more than it earns. Pick a higher amount.`
      );
      return;
    }
    setCustomError(null);
    setCustom("");
    if (!value.includes(amount)) toggle(amount, true);
  };

  return (
    <fieldset
      className="space-y-2"
      disabled={disabled}
      aria-describedby={value.length === 0 ? `${groupId}-empty` : undefined}
    >
      <legend className="sr-only">Amounts for {label}</legend>
      <div className="flex flex-wrap gap-2">
        {choices.map((amount) => {
          const id = `${groupId}-${amount}`;
          const checked = value.includes(amount);
          const offerable = isOfferableAt(item, amount);
          return (
            <label
              key={amount}
              htmlFor={id}
              className="border-border bg-background has-[button[data-state=checked]]:border-primary has-[button[data-state=checked]]:bg-primary/5 has-[button:disabled]:text-muted-foreground flex min-h-11 cursor-pointer items-center gap-2 rounded-md border px-3 text-sm has-[button:disabled]:cursor-not-allowed"
            >
              <Checkbox
                id={id}
                checked={checked}
                disabled={disabled || (!checked && (full || !offerable))}
                onCheckedChange={(state) => toggle(amount, state === true)}
              />
              <span className="font-mono tabular-nums">{formatFaceValue(amount, currency)}</span>
              {!offerable ? <span className="sr-only">, loses money</span> : null}
            </label>
          );
        })}
      </div>
      {!hasFixedAmounts(item) ? (
        <div className="flex flex-wrap items-start gap-2">
          <label htmlFor={`${groupId}-custom`} className="sr-only">
            Custom amount for {label}
          </label>
          <Input
            id={`${groupId}-custom`}
            inputMode="decimal"
            placeholder="Other amount"
            className="h-9 w-32 font-mono"
            value={custom}
            onChange={(event) => {
              setCustom(event.target.value);
              setCustomError(null);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") addCustom(event);
            }}
            aria-invalid={customError ? true : undefined}
            aria-describedby={customError ? `${groupId}-custom-error` : undefined}
            disabled={disabled || full}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addCustom}
            disabled={disabled || full}
          >
            Add amount
          </Button>
          {customError ? (
            <p
              id={`${groupId}-custom-error`}
              role="alert"
              className="text-destructive w-full text-xs"
            >
              {customError}
            </p>
          ) : null}
        </div>
      ) : null}
      {someUnprofitable ? (
        <p className="text-muted-foreground text-xs">
          Greyed-out amounts cost more than they earn, so they can&apos;t be offered.
        </p>
      ) : null}
      {value.length === 0 ? (
        <p id={`${groupId}-empty`} role="alert" className="text-destructive text-xs">
          Pick at least one amount.
        </p>
      ) : full ? (
        <p className="text-muted-foreground text-xs">
          Up to {MAX_LINK_DENOMINATIONS} amounts per offer.
        </p>
      ) : null}
    </fieldset>
  );
}
