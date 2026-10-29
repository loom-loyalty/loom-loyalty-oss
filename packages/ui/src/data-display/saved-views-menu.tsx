"use client";

// Compact saved-views dropdown for a FilterBar trailing slot: trigger + popover with views list and a save form. Sized to match SelectTrigger so it sits inline with the other filter dropdowns.

import { Bookmark, ChevronDown, X } from "lucide-react";
import { useId, useState } from "react";

import { cn } from "../lib/utils";
import { Button } from "../primitives/button";
import { Input } from "../primitives/input";
import { Popover, PopoverContent, PopoverTrigger } from "../primitives/popover";
import type { SavedView } from "./saved-views-store";

export interface SavedViewsMenuProps {
  /** Saved presets to list. */
  views: readonly SavedView[];
  /** Id of the view matching the current URL state, if any. */
  activeViewId?: string | null;
  /** Apply a saved view. */
  onApplyView: (id: string) => void;
  /** Delete a saved view. */
  onDeleteView: (id: string) => void;
  /** Save the current list state under a name. */
  onSaveCurrent: (name: string) => void;
  /** Whether saving is allowed (e.g. disabled when no filters are active). */
  canSave?: boolean;
  /** Hint shown in the save section when {@link canSave} is false. */
  saveDisabledHint?: string;
  className?: string;
}

export function SavedViewsMenu({
  views,
  activeViewId,
  onApplyView,
  onDeleteView,
  onSaveCurrent,
  canSave = true,
  saveDisabledHint = "Apply a filter or search first.",
  className,
}: SavedViewsMenuProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const nameInputId = useId();

  const trimmed = name.trim();
  const activeView = views.find((v) => v.id === activeViewId);

  const handleSave = () => {
    if (!trimmed) return;
    onSaveCurrent(trimmed);
    setName("");
    setOpen(false);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setName("");
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label={activeView ? `Saved view: ${activeView.name}` : "Saved views"}
          className={cn(
            "border-input-border bg-input flex h-9 w-full items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm shadow-xs sm:w-[180px]",
            "focus:border-ring focus:ring-ring/50 focus:ring-[3px] focus:outline-none",
            "data-[state=open]:border-ring",
            activeView && "border-primary bg-primary/5 text-primary-dark",
            className
          )}
        >
          <span className="flex min-w-0 items-center gap-2">
            <Bookmark
              className={cn("h-4 w-4 shrink-0", !activeView && "text-muted-foreground")}
              aria-hidden="true"
            />
            <span className="line-clamp-1">{activeView ? activeView.name : "Views"}</span>
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-50" aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-1">
        {views.length > 0 ? (
          <div role="group" aria-label="Saved views" className="max-h-64 overflow-y-auto">
            {views.map((view) => {
              const isActive = view.id === activeViewId;
              return (
                <div
                  key={view.id}
                  className={cn(
                    "group flex items-center rounded-sm",
                    isActive ? "bg-primary/5" : "hover:bg-muted"
                  )}
                >
                  <button
                    type="button"
                    aria-pressed={isActive}
                    onClick={() => {
                      onApplyView(view.id);
                      setOpen(false);
                    }}
                    className={cn(
                      "focus-visible:ring-ring flex-1 truncate rounded-sm py-1.5 pr-1 pl-3 text-left text-sm focus-visible:ring-2 focus-visible:outline-none",
                      isActive && "text-primary-dark font-medium"
                    )}
                  >
                    {view.name}
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteView(view.id)}
                    aria-label={`Delete view ${view.name}`}
                    className="hover:bg-muted-foreground/20 focus-visible:ring-ring mr-1 rounded-full p-1 focus-visible:ring-2 focus-visible:outline-none"
                  >
                    <X className="h-3 w-3" aria-hidden="true" />
                  </button>
                </div>
              );
            })}
          </div>
        ) : null}

        {views.length > 0 && <div className="bg-border my-1 h-px" aria-hidden="true" />}

        <div className="space-y-2 px-2 py-1.5">
          {canSave ? (
            <>
              <label htmlFor={nameInputId} className="text-foreground text-xs font-medium">
                Save current view
              </label>
              <Input
                id={nameInputId}
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleSave();
                  }
                }}
                placeholder="Name this view"
                maxLength={120}
                className="h-8"
              />
              <Button size="sm" onClick={handleSave} disabled={!trimmed} className="w-full">
                Save view
              </Button>
            </>
          ) : (
            <p className="text-muted-foreground text-xs">{saveDisabledHint}</p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
