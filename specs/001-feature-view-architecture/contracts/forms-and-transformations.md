# Contract: Shared Forms and Transformations

## Shared Forms

The forms responsibility accepts server form metadata through types explicitly re-exported by
`@contentgrid/navigator-data` and produces ordered field descriptors, layout information, and plain
values/callbacks for a consumer-supplied renderer set.

It does not fetch route data, build page chrome, navigate, or import views, components, or apps.

## Field Descriptor

Every descriptor includes a stable field name and presentation kind; label, required/read-only
state, and optional description; kind-specific constraints and resolved presentation options; and
enough source metadata for the feature adapter to submit values without exposing it to UI.

## Wire-Type Classification

| Wire type                    | Shared presentation category |
| ---------------------------- | ---------------------------- |
| `checkbox`                   | boolean                      |
| `date`                       | date                         |
| `datetime`, `datetime-local` | datetime                     |
| `number`, `range`            | number                       |
| all other supported values   | text                         |

Consumers may refine the category with feature-specific time inclusion, options, format hints, or
value coercion. They do not duplicate the base classification switch.

## Transformation Rules

- Pure and deterministic for equivalent inputs.
- No React hooks, rendering, navigation, mutable global state, or network access.
- Feature-specific transformations live under `util/<feature>/`.
- A transformation used by two or more features moves to the util root or a cross-feature group.
- Existing behavior receives characterization tests before extraction.
