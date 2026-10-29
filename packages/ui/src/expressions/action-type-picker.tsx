import { Plus } from "lucide-react";
import { useState, type ReactNode } from "react";

import { Button } from "../primitives/button.js";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "../primitives/command.js";
import { Popover, PopoverContent, PopoverTrigger } from "../primitives/popover.js";
import { ACTION_CATEGORIES, ACTION_TYPE_NAMES } from "./utils.js";

export interface ActionTypePickerProps {
  onSelect: (type: string) => void;
  disabled?: boolean;
}

export function ActionTypePicker({ onSelect, disabled }: ActionTypePickerProps): ReactNode {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          disabled={disabled}
          className="text-primary min-h-11 px-0 font-semibold"
        >
          <Plus className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
          Add action
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-0">
        <Command>
          <CommandInput placeholder="Search actions..." aria-label="Search actions" />
          <CommandList>
            <CommandEmpty>No actions found.</CommandEmpty>
            {Object.entries(ACTION_CATEGORIES).map(([category, actionTypes]) => (
              <CommandGroup key={category} heading={category}>
                {actionTypes.map((type) => (
                  <CommandItem
                    key={type}
                    value={`${ACTION_TYPE_NAMES[type] ?? type} ${category}`}
                    onSelect={() => {
                      onSelect(type);
                      setOpen(false);
                    }}
                  >
                    {ACTION_TYPE_NAMES[type] ?? type}
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
