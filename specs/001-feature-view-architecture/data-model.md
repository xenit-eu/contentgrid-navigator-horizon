# Data Model: Feature View Architecture

This feature introduces no persisted business data. The model describes frontend contracts,
ownership, and runtime state.

## Application Host

**Fields**: plain resource identifier, navigation/action callbacks, selected layout, main gate.

**Relationships**:

- Owns one main gate for a routed domain subtree.
- Mounts a feature view only after the gate reaches `ready`.
- Does not pass a resolved domain object into the view.

**Validation rules**:

- Identifiers are plain serializable values.
- Callbacks remain distinct when navigation-guard behavior differs.
- An embedding host supplies an equivalent gate outside the primary app.

## Main Gate

**Fields**: resource identifier, state, optional problem, ready primary context.

**State transitions**:

```text
idle -> loading -> ready
                -> error -> loading (retry)
                -> unavailable -> navigation away
ready -> loading (identifier changes)
```

**Validation rules**:

- The view subtree is absent in `idle`, `loading`, `error`, and `unavailable`.
- Failures use the established problem-display path.
- Authorization-hidden and missing resources share the unavailable outcome when indistinguishable.

## Feature View

**Fields**: plain identifier, callbacks, toolbar configuration, ready primary context, page content.

**Relationships**:

- Is mounted by an application host.
- Composes domain-aware components.
- May contain independently loading components.
- Depends on forms and util contracts; neither imports it.

**Validation rules**:

- Does not require a resolved domain object as a prop.
- Does not duplicate the app's primary loading gate.
- Derives default labels and navigation context from domain data.

## Component Data State

**Fields**: `idle | loading | error | empty | ready`, optional data, optional local problem.

**State transitions**:

```text
idle -> loading -> ready
                -> empty
                -> error -> loading (retry)
```

**Validation rules**:

- State changes affect only the owning component's region.
- Loading or failure does not remove ready sibling content.
- Data from a previous primary context is never presented as current.

## Toolbar Configuration

**Fields**: optional breadcrumb override, optional action override, or explicit disabled chrome.

**Validation rules**:

- Regions are independently overridable.
- Disabled chrome preserves feature content and behavior.
- Ordinary navigation remains guarded against unsaved changes.

## Form Representation

**Fields**: ordered field descriptors, feature-independent layout, consumer-supplied renderers.

**Relationships**:

- Is derived from form metadata by the forms layer.
- Supplies plain renderer props to ContentGrid UI.
- May use pure utilities but does not depend on views or components.

## Transformation

**Fields**: immutable input, deterministic output, feature or cross-feature scope.

**Validation rules**:

- Equivalent inputs produce equivalent outputs.
- A transformation used by two or more features moves to cross-feature scope.
- Transformations do not depend on rendering, UI, forms, components, views, or apps.

## ContentGrid UI Contract

**Fields**: plain props and callbacks; `FieldValue` is
`string | number | boolean | Date | File | undefined`; public primitives, patterns, styles, and
presentation types.

**Relationships**:

- May be consumed by Navigator features or any standalone product.
- Has no direct or transitive dependency on Navigator data, features, or applications.
