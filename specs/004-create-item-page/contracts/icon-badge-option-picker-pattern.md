# Contract: `IconBadgeOptionPicker` pattern (`@contentgrid/ui`)

**File**: `packages/ui/src/patterns/icon-badge-option-picker/icon-badge-option-picker.tsx` (the existing `ProfileEntitySelector`, extended and renamed: it holds no entity knowledge)
**Requirements**: FR-011, FR-012, FR-013

```ts
export interface IconBadgeOption {
  /** Unique key — used as the selection value. */
  name: string;
  title: string;
  description?: string;
  /** Rendered left of the title, typically an `IconBadge`. The pattern never resolves icons itself. */
  icon?: ReactNode;
}

export interface IconBadgeOptionPickerProps {
  options: readonly IconBadgeOption[];
  selectedOption?: IconBadgeOption;
  onSelect: (option: IconBadgeOption) => void;
  /** Field label rendered above the trigger (like `AttributeSelector`). */
  label?: string;
  /** Trigger text while nothing is selected; default "Select an option". */
  placeholder?: string;
  /** Trigger height, as `AttributeSelect`: "default" (h-9) or "sm" (h-8, toolbar). */
  size?: "sm" | "default";
}
```

## Behaviour

- Renders for any number of options. The trigger fills its container; callers size the wrapper.
- Trigger: compact label — `icon` + `title` of the selected option, or the `placeholder`.
- Option row: `icon`, `title` (medium weight), `description` (muted, below the title, truncated to one line), check mark on the selected row (Radix `SelectItem` indicator).
- `label` renders a `Label` above the trigger and names it (`aria-label`); without `label` the trigger is named by `placeholder`. The trigger grows past its fixed height so an icon badge keeps vertical padding.
- Keyboard and screen-reader behaviour is Radix `Select`'s.
- Exported types: `IconBadgeOption`, `IconBadgeOptionPickerProps` and `IconBadgeOptionPickerListProps` from the pattern's `index.ts`.

## `IconBadgeOptionPickerList` — inline list

```ts
export interface IconBadgeOptionPickerListProps {
  options: readonly IconBadgeOption[];
  selectedOption?: IconBadgeOption;
  onSelect: (option: IconBadgeOption) => void;
  /** Rendered above the list; names the radio group. */
  label: string;
}
```

- The same options laid out as an always-visible, scrollable list instead of a dropdown (as `AttributeMultiSelectContent` is to `AttributeMultiSelect`). Used on the Create Item page.
- A `radiogroup` named by `label`; each row is a `radio` with `icon`, `title`, `description`, and a check mark when selected.

## Forbidden

- Importing `@contentgrid/navigator-data` or `@contentgrid/features`.
- Filtering options (e.g. on create permission) — callers pass only what they want shown.

## Tests (`icon-badge-option-picker.test.tsx`)

- Dropdown: selected title or placeholder in the trigger; `label` shown and naming the trigger, absent without it; descriptions in option rows.
- List: only the selected row is checked; descriptions in rows.

## Stories

`SingleEntity`, `TwoEntities`, `ManyEntities`, `NoSelection`, `WithLabel`, `WithIconsAndDescriptions`, `List`, `ListNoSelection`. Snapshots are re-baselined by CI.

## Features wrappers (`entity-item-create/entity-profile-selector.tsx`)

`EntityProfileSelector` and `EntityProfileSelectorList` take `profiles: readonly ProfileEntity[]`, `selectedProfile?: ProfileEntity` and `onSelect(profile: ProfileEntity)`, map each `profileEntity` to an `IconBadgeOption` (`EntityIconBadge`, muted; small badges for `size="sm"`) and map the chosen option back to its `profileEntity`. Callers never handle options.
