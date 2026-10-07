import type { KeyboardEvent } from "react";
import { MagnifyingGlassIcon } from "@phosphor-icons/react";
import { Input, SearchSuggestionsPopover } from "@contentgrid/ui";
import type { ParamChipModel, SuggestionGroupModel } from "../util/build-suggestion-models";
import { paramLabel } from "../util/param-labels";
import { searchTypeIcon } from "./search-icons";
import { toSuggestionCount } from "./to-suggestion-count";

export interface SearchInputProps {
  readonly value: string;
  readonly onValueChange: (value: string) => void;
  readonly popoverOpen: boolean;
  readonly onPopoverOpenChange: (open: boolean) => void;
  readonly paramChips: readonly ParamChipModel[];
  readonly groups: readonly SuggestionGroupModel[];
  readonly onSelectParam: (name: string) => void;
  readonly onApplySuggestion: (paramName: string, value: string) => void;
  /** Enter with no suggestion highlighted. */
  readonly onSubmit: () => void;
  /** Keys the popover did not handle, other than Enter (e.g. Escape on a closed popover). */
  readonly onOtherKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void;
  readonly placeholder?: string;
  readonly error?: string;
}

/**
 * The free-text column of the main search bar: a search input anchoring the suggestions
 * popover (parameter chips with counts, grouped suggestions). Picking a suggestion applies it;
 * Enter with nothing highlighted submits the typed text.
 */
export function SearchInput({
  value,
  onValueChange,
  popoverOpen,
  onPopoverOpenChange,
  paramChips,
  groups,
  onSelectParam,
  onApplySuggestion,
  onSubmit,
  onOtherKeyDown,
  placeholder = "Search…",
  error,
}: Readonly<SearchInputProps>) {
  const errorId = "entity-search-bar-input-error";
  return (
    <div className="min-w-0 flex-1">
      <SearchSuggestionsPopover
        open={popoverOpen}
        onOpenChange={onPopoverOpenChange}
        anchorClassName="relative"
        chips={paramChips.map(({ descriptor, count }) => ({
          id: descriptor.name,
          label: paramLabel(descriptor),
          icon: searchTypeIcon(descriptor.valueKind, descriptor.mode),
          count: toSuggestionCount(count),
        }))}
        groups={groups.map(({ descriptor, count, status, items, retry }) => ({
          id: descriptor.name,
          label: paramLabel(descriptor),
          icon: searchTypeIcon(descriptor.valueKind, descriptor.mode),
          count: toSuggestionCount(count),
          status,
          items: items.map((item) => ({ id: item.value, label: item.label })),
          onRetry: retry,
        }))}
        onSelectChip={onSelectParam}
        onSelectItem={onApplySuggestion}
        onUnhandledKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            onSubmit();
          } else {
            onOtherKeyDown?.(event);
          }
        }}
        renderAnchor={(comboboxProps) => (
          <>
            <MagnifyingGlassIcon
              size={16}
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              {...comboboxProps}
              type="text"
              aria-label="Search"
              autoComplete="off"
              placeholder={placeholder}
              value={value}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? errorId : undefined}
              onChange={(event) => onValueChange(event.target.value)}
              onFocus={() => {
                if (value.trim()) onPopoverOpenChange(true);
              }}
              className="pl-8"
            />
          </>
        )}
      />
      {error && (
        <p id={errorId} role="alert" className="mt-1 text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
