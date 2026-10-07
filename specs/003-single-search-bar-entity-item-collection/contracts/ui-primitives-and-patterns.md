# Contract: `@contentgrid/ui` primitives and patterns

**Layer rules** (`packages/ui/CLAUDE.md`, Principle III): no HAL, no entity concepts, no
`@contentgrid/hal*` imports, plain props only. Every new/changed component has a story
(`*.stories.tsx`, ADR-009) and a co-located `*.test.tsx`. Behavioural checks go in a single
`WithInteraction` story (tagged `no-visual-test`). All exports go through `src/index.ts`.

Icons are passed in as `ReactNode`; the feature chooses them. Colours use theme tokens, never
hex literals in new code.

---

## Primitives

### `Chip` (extend `src/primitives/chip.tsx`)

```ts
interface ChipProps {
  tone?: "neutral" | "applied";
  field?: string;
  mode?: string; // NEW — rendered as a distinct, muted segment between field and value
  modeIcon?: ReactNode; // NEW
  label: string; // the value
  valueIcon?: ReactNode; // NEW
  removable?: boolean;
  onRemove?: () => void;
  removeLabel?: string; // NEW — default `Remove ${field ?? ""} ${label} filter`
  className?: string;
}
```

- Existing callers (props without the new fields) render unchanged.
- The mode segment is always visible (never truncated before the value); the value truncates
  and shows in full as the native `title` tooltip. The mode text uses `text-foreground` on a
  faint pill (the muted foreground failed the axe contrast check on the applied tone).
- `removeLabel` defaults to `Remove ${field} ${label} filter`, without the field when there is
  none (so existing callers keep "Remove Finance filter").
- Hardcoded hex colours replaced by tokens in the same change (applied → `accent`/`ring`
  family, neutral → `background`/`border`).

### `CountIndicatorChip` (extend)

```ts
interface CountIndicatorChipProps {
  count: number | null; // null → "?"
  isEstimated?: boolean; // → "~" suffix, plus aria-label "about N results"
  isLoading?: boolean; // NEW — pulse placeholder, aria-busy
  variant?: "default" | "solid";
}
```

### `SelectionChip` (extend)

```ts
interface SelectionChipProps {
  // existing …
  icon?: ReactNode; // NEW — leading
  trailing?: ReactNode; // NEW — e.g. a CountIndicatorChip
}
```

### `FilterButton` (new, `src/primitives/filter-button.tsx`)

```ts
interface FilterButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  icon?: ReactNode;
  label: string;
  tone?: "idle" | "active" | "positive" | "negative"; // grey / blue / green / red outline
  onClear?: () => void; // when set and tone !== "idle", renders a separate × button
  clearLabel?: string; // default `Clear ${label} filter`
  ref?: Ref<HTMLButtonElement>; // usable as <PopoverTrigger asChild>
}
```

- The × is a sibling `<button>`, not nested inside the trigger (valid HTML, own focus stop).
- `aria-pressed` is **not** set (the tone is conveyed by the accessible name suffix, e.g.
  "Approved: true"), so a popover trigger keeps its `aria-expanded` semantics.
- Colour is never the only state signal (spec Assumptions): the feature passes an icon/label
  that reflects the state.
- Outlines: idle `border-border`, active `border-ring` on `bg-accent`, positive
  `border-success-foreground` on `bg-success`, negative `border-destructive` on
  `bg-destructive/10`. The root carries `data-tone`.

### Theme tokens (`src/styles/preset.css`)

Map `--success`, `--success-border`, `--success-foreground` into `@theme inline` so
`border-success` / `bg-success` / `text-success` exist in light and dark. No new colour values.

---

## Patterns

### `FilterChips` (rewrite `src/patterns/filter-chips/`)

```ts
interface FilterChipItem {
  id: string;
  field: string;
  mode: string;
  modeIcon?: ReactNode;
  value: string;
  valueIcon?: ReactNode;
}

interface FilterChipsProps {
  chips: readonly FilterChipItem[];
  onRemove: (id: string) => void;
  maxLines?: 1 | 2; // default 2 (FR-005)
  className?: string;
}
```

- Renders `Chip` (`tone="applied"`, `removable`) per item.
- Wraps to at most `maxLines` lines; beyond that the row scrolls horizontally. The existing
  `ScrollArea` primitive only mounts a vertical scrollbar, so the row uses native
  `overflow-x-auto` with the `scrollbar-subtle` utility; the wrapping list is sized from the
  measured chip widths (at least half their total plus the widest chip), so greedy wrapping can
  never need a third line. Keyboard focus on a chip scrolls it into view.
- The chips are a `list` (named by `label`, default "Active filters"); each remove button is
  named `Remove filter ${field} ${mode} ${value}`.
- Renders nothing (no reserved height) when `chips` is empty.
- `search-property-utils.ts` and the `SearchProperty` type are removed (no consumers today).

### `GroupedSelect` (new, `src/patterns/grouped-select.tsx`)

```ts
interface GroupedSelectOption {
  value: string;
  label: string;
  hint?: string; // e.g. "Prefix", "Integer" — the type indicator text
  icon?: ReactNode;
}
interface GroupedSelectGroup {
  id: string;
  label?: string; // omitted → no header (e.g. the leading "All" group)
  options: readonly GroupedSelectOption[];
}
interface GroupedSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  groups: readonly GroupedSelectGroup[];
  triggerLabel?: string; // accessible name, e.g. "Search in"
  size?: "sm" | "default";
  compact?: boolean | "below-sm"; // icon-only trigger, always or only on narrow screens
  className?: string;
}
```

- Built on `Select`/`SelectGroup`/`SelectLabel`/`SelectSeparator`. Trigger shows the selected
  option's icon + label (+ hint).

### `SearchSuggestionsPopover` (new, `src/patterns/search-suggestions-popover/`)

```ts
interface SuggestionCount {
  count: number | null;
  isEstimated?: boolean;
  isLoading?: boolean;
}

interface SuggestionChip {
  id: string;
  label: string;
  icon?: ReactNode;
  count: SuggestionCount;
}

interface SuggestionGroup {
  id: string;
  label: string;
  icon?: ReactNode;
  count: SuggestionCount;
  status: "loading" | "empty" | "error" | "ready";
  items: readonly { id: string; label: string }[];
  onRetry?: () => void;
}

/** What the anchor's input must spread (combobox pattern). */
interface SuggestionsComboboxProps {
  role: "combobox";
  "aria-expanded": boolean;
  "aria-controls": string; // every listbox id, space-separated
  "aria-autocomplete": "list";
  "aria-activedescendant": string | undefined;
  onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
}

interface SearchSuggestionsPopoverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chips: readonly SuggestionChip[]; // top row; may be empty
  groups: readonly SuggestionGroup[];
  onSelectChip: (chipId: string) => void;
  onSelectItem: (groupId: string, itemId: string) => void;
  renderAnchor: (comboboxProps: SuggestionsComboboxProps) => ReactNode;
  anchorClassName?: string;
  onUnhandledKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void; // e.g. Enter with nothing highlighted
  listLabel?: string; // accessible name of the suggestions region
  labels?: { chips?: string; noMatches?: string; error?: string; retry?: string };
  className?: string;
}
```

- **The popover owns the keyboard model and the highlight** (`useSuggestionsKeyboard`, also
  exported): the caller spreads `comboboxProps` onto its input via `renderAnchor`, and receives
  only selections and the keys it did not handle.
- **Keyboard** (FR-023): the input keeps focus. ArrowDown/ArrowUp walk the entries in visual
  order, wrapping — the chip row is one stop above the first item; ArrowLeft/ArrowRight move
  within the chip row while a chip is highlighted; Enter selects the highlighted entry (with
  nothing highlighted it goes to `onUnhandledKeyDown`); Escape closes.
- **ARIA**: the content is a `region` named `listLabel`. The chip row and every group that has
  items are each their own `listbox` (chips: `aria-orientation="horizontal"`; a group: labelled
  by its header) with `role="option"` entries; status text (loading skeleton, "No matches", an
  error with Retry) sits outside any listbox, because ARIA forbids anything but options and
  groups inside one (found by the axe audit). `aria-controls` lists every listbox.
- Chips are option elements styled as chips (not `SelectionChip` buttons — interactive elements
  inside a listbox trip axe's `nested-interactive` rule).
- Interacting with the anchor never dismisses the popover; it renders nothing when there are
  neither chips nor groups.

### `DateRangeFilter` (new, `src/patterns/date-range-filter.tsx`)

```ts
interface DateRange {
  from?: Date;
  to?: Date;
}
interface DateRangeFilterProps {
  value: DateRange; // draft, controlled
  onValueChange: (value: DateRange) => void;
  presets: readonly { id: string; label: string }[];
  activePresetId?: string;
  onPresetSelect: (id: string) => void; // parent computes the range and sets value
  onApply: () => void;
  onClear: () => void;
  numberOfMonths?: 1 | 2; // default 1; 2 at ≥ md widths
  labels?: { apply?: string; clear?: string; presets?: string };
}
```

- Calendar (`mode="range"`) left, presets list right, Clear / Apply footer (FR-026). Stacks
  vertically on narrow widths. Pure dates: time handling belongs to the caller.
- With react-day-picker 10, the first click on an empty range selects a one-day range (`from`
  = `to`); a second click extends it. Apply is disabled while the range is empty.

### `SearchableOptionList` (new, `src/patterns/searchable-option-list.tsx`)

```ts
interface SearchableOptionListProps {
  options: readonly { value: string; label: string }[];
  value: string | undefined;
  onValueChange: (value: string) => void;
  searchPlaceholder?: string;
  emptyLabel?: string;
  autoFocus?: boolean;
}
```

- Search input above a single-select list (`role="listbox"`), filtered with
  `filterOptionsByPrefix` on every keystroke, no debounce (FR-030, SC-003).
- The search input is the list's combobox: arrows move the highlight, Enter picks it, and
  Enter with exactly one remaining option picks that one. It takes a `label` prop (the list's
  name). With no matches the list is not rendered and the input's `aria-controls` is dropped.
- Stories: `Default`, `Interactive`, `NoMatches`.

### `filterOptionsByPrefix` (new, `src/lib/filter-options.ts`)

```ts
function filterOptionsByPrefix<T extends { label: string; value: string }>(
  options: readonly T[],
  query: string,
  limit?: number,
): T[];
```

- Case- and accent-insensitive prefix match on `label`, falling back to `value`; also matches at
  word starts inside the label ("Approved by manager" matches "man"). Stable order. Shared by
  `SearchableOptionList` and the feature's allowed-value suggestions.

---

## Stories that need visual baselines

`Primitives/Chip` (with mode), `Primitives/CountIndicatorChip` (loading),
`Primitives/SelectionChip` (icon + count), `Primitives/FilterButton` (all tones, with clear),
`Patterns/FilterChips` (one line, two lines, overflow), `Patterns/GroupedSelect`,
`Patterns/SearchSuggestionsPopover` (chips + groups, loading, empty, error, "?" counts),
`Patterns/DateRangeFilter`, `Patterns/SearchableOptionList`.
