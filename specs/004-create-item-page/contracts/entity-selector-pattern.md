# Contract: `ProfileEntitySelector` pattern (`@contentgrid/ui`)

**File**: `packages/ui/src/patterns/entity-selector/entity-selector.tsx` (extended in place)
**Requirements**: FR-011, FR-012, FR-013

```ts
export interface ProfileEntityOption {
  /** Selection value — the entity's profile name. */
  name: string;
  title: string;
  description?: string;
  /** Rendered left of the title. The pattern never resolves icons itself. */
  icon?: ReactNode;
}

export interface ProfileEntitySelectorProps {
  entities: readonly ProfileEntityOption[];
  selectedEntity?: ProfileEntityOption;
  onSelect: (entity: ProfileEntityOption) => void;
  /** Field label rendered above the trigger (like `AttributeSelector`). */
  label?: string;
  /** Trigger height, as `AttributeSelect`: "default" (h-9) or "sm" (h-8, toolbar). */
  size?: "sm" | "default";
}
```

## Behaviour

- Renders for any number of entities. The trigger fills its container; callers size the wrapper.
- Trigger: compact label — `icon` + `title` of the selected entity, or the "Select entity" placeholder.
- Option row: `icon`, `title` (medium weight), `description` (muted, below the title, truncated to one line), check mark on the selected row (Radix `SelectItem` indicator).
- `label` renders a `Label` above the trigger and names it (`aria-label`); without `label` the trigger is named "Select entity".
- Keyboard and screen-reader behaviour is Radix `Select`'s.
- Exported types: `ProfileEntityOption` and `ProfileEntitySelectorProps` from the pattern's `index.ts`.

## Forbidden

- Importing `@contentgrid/navigator-data` or `@contentgrid/features`.
- Filtering entities (e.g. on create permission) — callers pass only what they want shown.

## Tests (`entity-selector.test.tsx`)

- Shows the selected entity's title in the trigger.
- Option rows show descriptions when given.
- Selecting an option calls `onSelect` with the full option (including `description`/`icon`).
- `label` is associated with the trigger.

## Stories

`SingleEntity` (now visual-tested), `TwoEntities`, `ManyEntities`, `NoSelection`, `WithLabel`, `WithIconsAndDescriptions`. Snapshots are re-baselined by CI.
