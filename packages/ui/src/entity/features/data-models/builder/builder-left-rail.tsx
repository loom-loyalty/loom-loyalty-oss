/**
 * BuilderLeftRail
 *
 * Identity (name, `extends`), the START FROM mode grid, then the active mode's
 * panel in the `children` slot.
 *
 * Every child is `flex-shrink-0` and the rail itself scrolls. Letting flex
 * absorb a vertical deficit here is what hides the generate button. Budget the
 * space, don't compress it.
 */

import type { ReactNode } from "react";

import { EntitySelectBox } from "../../../../forms/entity-select-box.js";
import { Input } from "../../../../primitives/input.js";
import { Label } from "../../../../primitives/label.js";
import { Separator } from "../../../../primitives/separator.js";
import { StartFromModeGrid } from "./start-from-mode-grid.js";
import type { BuilderLeftRailProps } from "./types.js";

export function BuilderLeftRail({
  name,
  onNameChange,
  extendsCode,
  onExtendsChange,
  extendsOptions,
  extendsLoading = false,
  extendsRequired = false,
  mode,
  onModeChange,
  disabled = false,
  children,
}: BuilderLeftRailProps): ReactNode {
  return (
    <div className="border-border flex min-h-0 flex-col gap-5 overflow-y-auto border-r p-6">
      <div className="flex-shrink-0 space-y-2">
        <Label htmlFor="builder-name">
          Name <span className="text-destructive">*</span>
        </Label>
        <Input
          id="builder-name"
          value={name}
          onChange={(event) => onNameChange(event.target.value)}
          disabled={disabled}
          placeholder="Order completed"
        />
      </div>

      <div className="flex-shrink-0 space-y-2">
        <Label htmlFor="builder-extends">
          Extends {extendsRequired ? <span className="text-destructive">*</span> : null}
        </Label>
        <EntitySelectBox
          id="builder-extends"
          entityLabel="Data Model Type"
          options={extendsOptions}
          value={extendsCode}
          onValueChange={onExtendsChange}
          isLoading={extendsLoading}
          placeholder={extendsRequired ? "Select a parent data model..." : "Nothing, start empty"}
          disabled={disabled}
        />
        <p className="text-muted-foreground text-xs">
          Starts from the parent type&apos;s fields so you only declare what&apos;s different.
        </p>
      </div>

      <Separator className="flex-shrink-0" />

      <div className="flex-shrink-0 space-y-2">
        <p
          aria-hidden="true"
          className="text-muted-foreground text-xs font-semibold tracking-wide uppercase"
        >
          Start from
        </p>
        <StartFromModeGrid value={mode} onValueChange={onModeChange} disabled={disabled} />
      </div>

      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}
