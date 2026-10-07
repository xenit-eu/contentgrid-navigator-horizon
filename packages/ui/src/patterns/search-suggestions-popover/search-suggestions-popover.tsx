import { type KeyboardEvent, type ReactNode, useId, useRef, useState } from "react";
import { cn } from "../../lib/utils";
import { Button } from "../../primitives/button";
import { CountIndicatorChip } from "../../primitives/count-indicator-chip";
import { Popover, PopoverAnchor, PopoverContent } from "../../primitives/popover";
import { Skeleton } from "../../primitives/skeleton";
import {
  type SuggestionEntryId,
  chipEntryId,
  itemEntryId,
  useSuggestionsKeyboard,
} from "./use-suggestions-keyboard";

export interface SuggestionCount {
  /** `null` when no count is known — shown as "?". */
  readonly count: number | null;
  readonly isEstimated?: boolean;
  readonly isLoading?: boolean;
}

export interface SuggestionChip {
  readonly id: string;
  readonly label: string;
  readonly icon?: ReactNode;
  readonly count: SuggestionCount;
}

export interface SuggestionGroup {
  readonly id: string;
  readonly label: string;
  readonly icon?: ReactNode;
  readonly count: SuggestionCount;
  readonly status: "loading" | "empty" | "error" | "ready";
  readonly items: readonly { readonly id: string; readonly label: string }[];
  readonly onRetry?: () => void;
}

/** ARIA and keyboard props the anchor's input must spread (combobox pattern). */
export interface SuggestionsComboboxProps {
  readonly role: "combobox";
  readonly "aria-expanded": boolean;
  /** Every listbox of the popover, space-separated (or its container while none is shown). */
  readonly "aria-controls": string;
  readonly "aria-autocomplete": "list";
  readonly "aria-activedescendant": string | undefined;
  readonly onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
}

export interface SearchSuggestionsPopoverProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  /** Top row: selectable chips, e.g. the parameters to search in, each with a count. */
  readonly chips: readonly SuggestionChip[];
  /** Grouped suggestion lists, each with a header and a count. */
  readonly groups: readonly SuggestionGroup[];
  readonly onSelectChip: (chipId: string) => void;
  readonly onSelectItem: (groupId: string, itemId: string) => void;
  /**
   * Renders the anchor — typically the search input — spreading `comboboxProps` onto the input.
   * The popover is positioned against it, and interacting with it never dismisses the popover.
   */
  readonly renderAnchor: (comboboxProps: SuggestionsComboboxProps) => ReactNode;
  /** Class of the element wrapping the anchor. */
  readonly anchorClassName?: string;
  /** Keys the popover did not handle, e.g. Enter with nothing highlighted. */
  readonly onUnhandledKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void;
  /** Accessible name of the suggestions region. */
  readonly listLabel?: string;
  readonly labels?: {
    readonly chips?: string;
    readonly noMatches?: string;
    readonly error?: string;
    readonly retry?: string;
  };
  readonly className?: string;
}

/**
 * A suggestions popover for a search input: a top row of selectable chips (each with a result
 * count) above grouped suggestion lists (each group with a header, a count, and its own
 * loading / no-matches / error-with-retry state, so one failing group never hides the others).
 *
 * Focus stays in the input; the popover follows the WAI-ARIA combobox pattern with
 * `aria-activedescendant`, and owns the keyboard model (see `useSuggestionsKeyboard`).
 * Generic: it knows nothing about what the chips or groups stand for.
 */
export function SearchSuggestionsPopover({
  open,
  onOpenChange,
  chips,
  groups,
  onSelectChip,
  onSelectItem,
  renderAnchor,
  onUnhandledKeyDown,
  listLabel = "Suggestions",
  labels,
  className,
  anchorClassName,
}: Readonly<SearchSuggestionsPopoverProps>) {
  const baseId = useId();
  const anchorRef = useRef<HTMLDivElement>(null);
  const containerId = `${baseId}-suggestions`;
  const chipsListboxId = `${baseId}-chips`;
  const groupListboxId = (groupIndex: number) => `${baseId}-group-${groupIndex}-options`;
  const [requestedActiveId, setRequestedActiveId] = useState<string | null>(null);
  const showContent = open && (chips.length > 0 || groups.length > 0);
  const controlledIds = [
    ...(chips.length > 0 ? [chipsListboxId] : []),
    ...groups.flatMap((group, index) =>
      group.status === "ready" && group.items.length > 0 ? [groupListboxId(index)] : [],
    ),
  ];

  const keyboard = useSuggestionsKeyboard(chips, groups, {
    open: showContent,
    activeId: requestedActiveId,
    onActiveIdChange: setRequestedActiveId,
    onSelectChip,
    onSelectItem,
    onEscape: () => onOpenChange(false),
  });
  const activeId = keyboard.activeId;

  // DOM ids must be safe whatever the chip/item ids contain, so they are index-based.
  const domIds = new Map<string, string>();
  chips.forEach((chip, index) => domIds.set(chipEntryId(chip.id), `${baseId}-chip-${index}`));
  groups.forEach((group, groupIndex) =>
    group.items.forEach((item, index) =>
      domIds.set(itemEntryId(group.id, item.id), `${baseId}-item-${groupIndex}-${index}`),
    ),
  );

  const comboboxProps: SuggestionsComboboxProps = {
    role: "combobox",
    "aria-expanded": showContent,
    "aria-controls": controlledIds.length > 0 ? controlledIds.join(" ") : containerId,
    "aria-autocomplete": "list",
    "aria-activedescendant": activeId === null ? undefined : domIds.get(activeId),
    onKeyDown: (event) => {
      if (!keyboard.onKeyDown(event)) onUnhandledKeyDown?.(event);
    },
  };

  const entryProps = (entryId: SuggestionEntryId, onSelect: () => void) => ({
    id: domIds.get(entryId),
    role: "option" as const,
    "aria-selected": activeId === entryId,
    tabIndex: -1,
    // Keep focus (and the input's blur handling) where it is.
    onMouseDown: (event: { preventDefault: () => void }) => event.preventDefault(),
    onMouseEnter: () => setRequestedActiveId(entryId),
    onClick: onSelect,
  });

  return (
    <Popover
      open={showContent}
      onOpenChange={(next) => {
        setRequestedActiveId(null);
        onOpenChange(next);
      }}
    >
      <PopoverAnchor ref={anchorRef} className={anchorClassName}>
        {renderAnchor(comboboxProps)}
      </PopoverAnchor>
      <PopoverContent
        align="start"
        className={cn(
          "w-[max(var(--radix-popover-trigger-width),20rem)] max-w-[calc(100vw-2rem)] p-0",
          className,
        )}
        onOpenAutoFocus={(event) => event.preventDefault()}
        onFocusOutside={(event) => event.preventDefault()}
        onInteractOutside={(event) => {
          // Typing in or clicking the input is part of using the popover, not leaving it.
          if (anchorRef.current?.contains(event.target as Node)) event.preventDefault();
        }}
      >
        {/*
          Each set of options is its own listbox — the chip row, and every group that has
          suggestions — so status text (loading, no matches, an error with Retry) can sit next to
          them without ever being a child of a listbox, which ARIA forbids. The input controls
          all of them (`aria-controls` lists every listbox) and follows the highlight across them
          with `aria-activedescendant`.
        */}
        <div
          id={containerId}
          aria-label={listLabel}
          role="region"
          className="scrollbar-subtle max-h-[min(24rem,60vh)] overflow-y-auto p-1"
        >
          {chips.length > 0 && (
            <div
              id={chipsListboxId}
              role="listbox" // NOSONAR: no native-element alternative for an async, custom-styled combobox popup
              aria-label={labels?.chips ?? "Search in"}
              aria-orientation="horizontal"
              className="flex flex-wrap gap-1.5 border-b p-1.5 pb-2"
            >
              {chips.map((chip) => {
                const entryId = chipEntryId(chip.id);
                return (
                  <div
                    key={chip.id}
                    data-slot="suggestion-chip"
                    {...entryProps(entryId, () => onSelectChip(chip.id))}
                    className={cn(
                      "inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md border bg-background px-2 py-1 text-xs hover:bg-accent",
                      activeId === entryId && "border-ring bg-accent ring-2 ring-ring/40",
                    )}
                  >
                    {chip.icon}
                    <span>{chip.label}</span>
                    <CountIndicatorChip {...chip.count} />
                  </div>
                );
              })}
            </div>
          )}

          {groups.map((group, groupIndex) => {
            const headerId = `${baseId}-group-${groupIndex}`;
            const hasItems = group.status === "ready" && group.items.length > 0;
            return (
              <div
                key={group.id}
                data-slot="suggestion-group"
                data-status={group.status}
                aria-busy={group.status === "loading" || undefined}
                className="py-1"
              >
                <div
                  id={headerId}
                  className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-muted-foreground"
                >
                  {group.icon}
                  <span className="truncate">{group.label}</span>
                  <CountIndicatorChip {...group.count} className="ml-auto" />
                </div>
                {group.status === "loading" && (
                  <div aria-hidden className="space-y-1 px-2 py-1">
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-5 w-1/2" />
                  </div>
                )}
                {(group.status === "empty" || (group.status === "ready" && !hasItems)) && (
                  <p className="px-2 py-1 text-sm text-muted-foreground">
                    {labels?.noMatches ?? "No matches"}
                  </p>
                )}
                {group.status === "error" && (
                  <div className="flex items-center gap-2 px-2 py-1 text-sm text-destructive">
                    <span>{labels?.error ?? "Could not load suggestions"}</span>
                    {group.onRetry && (
                      <Button
                        type="button"
                        variant="link"
                        size="xs"
                        className="h-auto p-0"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={group.onRetry}
                      >
                        {labels?.retry ?? "Retry"}
                      </Button>
                    )}
                  </div>
                )}
                {hasItems && (
                  <div
                    id={groupListboxId(groupIndex)}
                    role="listbox" // NOSONAR: see the chip row above
                    aria-labelledby={headerId}
                  >
                    {group.items.map((item) => {
                      const entryId = itemEntryId(group.id, item.id);
                      return (
                        <div
                          key={item.id}
                          {...entryProps(entryId, () => onSelectItem(group.id, item.id))}
                          className={cn(
                            "cursor-pointer truncate rounded-sm px-2 py-1.5 text-sm hover:bg-accent",
                            activeId === entryId && "bg-accent",
                          )}
                        >
                          {item.label}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
