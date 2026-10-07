import type { KeyboardEvent } from "react";

/** Identifies a highlighted entry: a chip in the top row, or an item in a group. */
export type SuggestionEntryId = `chip:${string}` | `item:${string}:${string}`;

export const chipEntryId = (chipId: string): SuggestionEntryId => `chip:${chipId}`;
export const itemEntryId = (groupId: string, itemId: string): SuggestionEntryId =>
  `item:${groupId}:${itemId}`;

interface KeyboardChip {
  readonly id: string;
}
interface KeyboardGroup {
  readonly id: string;
  readonly status: "loading" | "empty" | "error" | "ready";
  readonly items: readonly { readonly id: string }[];
}

export interface UseSuggestionsKeyboardOptions {
  readonly open: boolean;
  readonly activeId: string | null;
  readonly onActiveIdChange: (id: string | null) => void;
  readonly onSelectChip: (chipId: string) => void;
  readonly onSelectItem: (groupId: string, itemId: string) => void;
  /** Escape. The popover itself does not decide what Escape means beyond closing. */
  readonly onEscape: () => void;
}

/**
 * Keyboard model of `SearchSuggestionsPopover` (FR-023), for the input that keeps focus while the
 * popover is open (WAI-ARIA combobox with `aria-activedescendant`):
 *
 * - ArrowDown / ArrowUp walk the entries in visual order, wrapping: the chip row counts as one
 *   stop above the first item; from a chip, ArrowDown goes to the first item.
 * - ArrowLeft / ArrowRight move within the chip row while a chip is highlighted; otherwise they
 *   are left to the input (caret movement).
 * - Enter selects the highlighted entry. With nothing highlighted it is NOT handled, so the
 *   caller decides (e.g. apply the typed text).
 * - Escape calls `onEscape`.
 *
 * `onKeyDown` returns whether it handled the key (and then already called `preventDefault`).
 */
export function useSuggestionsKeyboard(
  chips: readonly KeyboardChip[],
  groups: readonly KeyboardGroup[],
  options: UseSuggestionsKeyboardOptions,
): { onKeyDown: (event: KeyboardEvent<HTMLElement>) => boolean; activeId: string | null } {
  const chipIds: string[] = chips.map((chip) => chipEntryId(chip.id));
  const itemIds = groups.flatMap((group) =>
    group.status === "ready" ? group.items.map((item) => itemEntryId(group.id, item.id)) : [],
  );
  const known = new Set<string>([...chipIds, ...itemIds]);
  // A highlight that no longer exists (results changed) is treated as no highlight.
  const activeId =
    options.activeId !== null && known.has(options.activeId) ? options.activeId : null;

  function move(direction: 1 | -1): string | null {
    const firstChip = chipIds[0];
    const stops: string[] = firstChip ? [firstChip, ...itemIds] : itemIds;
    if (stops.length === 0) return null;
    const isChip = activeId !== null && activeId.startsWith("chip:");
    const current = activeId === null ? -1 : isChip ? 0 : stops.indexOf(activeId);
    if (current === -1) return direction === 1 ? stops[0]! : stops[stops.length - 1]!;
    return stops[(current + direction + stops.length) % stops.length]!;
  }

  function moveWithinChips(direction: 1 | -1): string | null {
    const index = activeId === null ? -1 : chipIds.indexOf(activeId);
    if (index === -1) return null;
    return chipIds[(index + direction + chipIds.length) % chipIds.length]!;
  }

  function select(id: string) {
    if (id.startsWith("chip:")) {
      options.onSelectChip(id.slice("chip:".length));
      return;
    }
    const rest = id.slice("item:".length);
    const group = groups.find((g) => rest.startsWith(`${g.id}:`));
    if (group) options.onSelectItem(group.id, rest.slice(group.id.length + 1));
  }

  function onKeyDown(event: KeyboardEvent<HTMLElement>): boolean {
    if (!options.open) return false;
    switch (event.key) {
      case "ArrowDown":
      case "ArrowUp": {
        event.preventDefault();
        options.onActiveIdChange(move(event.key === "ArrowDown" ? 1 : -1));
        return true;
      }
      case "ArrowLeft":
      case "ArrowRight": {
        const next = moveWithinChips(event.key === "ArrowRight" ? 1 : -1);
        if (next === null) return false;
        event.preventDefault();
        options.onActiveIdChange(next);
        return true;
      }
      case "Enter": {
        if (activeId === null) return false;
        event.preventDefault();
        select(activeId);
        return true;
      }
      case "Escape": {
        event.preventDefault();
        options.onEscape();
        return true;
      }
      default:
        return false;
    }
  }

  return { onKeyDown, activeId };
}
