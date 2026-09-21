# Research: Feature View Architecture

## Decision 1: Keep One Application-Level Primary Gate

**Decision**: Retain one gate around each entity route subtree. It resolves the primary profile
context and owns page-level loading, problem, and unavailable outcomes. A feature view mounts only
after that context is ready.

**Rationale**: `EntityProfileGate` is already shared by both apps and by entity and configuration
route trees. This matches the approved specification and avoids repeating one whole-page state
machine in every view.

**Alternatives considered**:

- Gate in every view: rejected because it duplicates the primary state owner.
- Route prefetch only: rejected because current prefetch deliberately swallows failures and does not
  provide the user outcome by itself.
- Block on all view data: rejected because secondary regions should not hide usable page content.

## Decision 2: Localize Secondary Loading to Components

**Decision**: After the primary gate opens, components querying additional data render their own
pending, error, empty, and ready states without replacing the containing view.

**Rationale**: Relation sections already use independent query results and scoped skeleton/problem
states. This gives earlier access to ready content and isolates failure to the affected region.

**Alternatives considered**:

- Aggregate all queries into view readiness: rejected because one slow region blocks unrelated data.
- Universal query-state wrapper: rejected because component outcomes and actions differ.

## Decision 3: Enforce a One-Way Feature Import Graph

**Decision**: Enforce `views -> components -> forms`, with each allowed to depend on `util` and
approved lower packages. `util` depends only on util modules and navigator-data. Apps and Layer-1
imports remain forbidden throughout features.

**Rationale**: The direction makes ownership mechanically reviewable and prevents cycles between
orchestration and transformation.

**Alternatives considered**:

- Documentation only: rejected because unenforced stability boundaries have already drifted.
- Separate workspace packages: rejected because they add publishing and migration overhead without
  a required runtime boundary.

## Decision 4: Extend the Existing ESLint Plugin

**Decision**: Implement path-aware rules in `packages/eslint-config/rules`, test them with the
existing RuleTester pattern, and apply them to feature and UI source globs.

**Rationale**: The monorepo already compiles and tests a custom stability rule. Reusing that
mechanism needs no dependency and gives immediate author feedback.

**Alternatives considered**:

- Generic restricted-import lists: rejected because allowed imports depend on the importer folder.
- A dependency-cruiser tool: rejected because it adds a package and separate CI configuration.

## Decision 5: Make Field Values a UI-Owned Contract

**Decision**: Export `FieldValue` from `@contentgrid/ui` as
`string | number | boolean | Date | File | undefined`. UI renderers import this local type. Feature
adapters map domain/form values into it.

**Rationale**: Six UI renderers currently import a Navigator data type, forcing UI to declare
Navigator data as peer and development dependencies. The underlying union is plain presentation
data and carries no HAL behavior.

**Alternatives considered**:

- Keep a type-only peer: rejected because standalone consumers must still install it.
- Use `unknown`: rejected because it weakens all renderer contracts.
- Re-export the Navigator type: rejected because it preserves transitive coupling.

## Decision 6: Extract Shared Ownership Without Migrating a View

**Decision**: Introduce `forms` and `util` ownership surfaces, move only reusable contracts and pure
duplicated logic, and preserve old import paths through forwarding exports.

**Rationale**: The specification excludes individual view migration. Compatibility exports let the
architecture land independently and give later migrations stable targets.

**Alternatives considered**:

- Move every feature at once: rejected because it combines mechanical churn with behavior changes.
- Create empty folders only: rejected because empty structure proves no boundary or reuse.

## Decision 7: Share Wire-Type Classification, Not Encoding

**Decision**: Share one pure classifier for text, boolean, date, datetime, and number presentation
kinds. Keep descriptor details, value coercion, and request encoding in their owning adapters.

**Rationale**: Search and form projection maintain matching switches, but their complete output
models differ. Sharing the stable classification removes duplication without merging unlike logic.

**Alternatives considered**:

- Share complete projection functions: rejected because consumer-specific details differ.
- Leave duplicate switches: rejected because current comments require manual synchronization.

## Decision 8: Preserve Public Exports During Moves

**Decision**: Add `forms` and `util` subpath exports while existing feature subpaths forward current
names. Remove forwarding exports only in a separately announced breaking change.

**Rationale**: Both apps and tests consume subpaths directly. Architecture work should not force an
unrelated app migration.

**Alternatives considered**:

- Rename imports atomically: rejected because it expands blast radius.
- Expose deep source paths: rejected because folder layout would become a permanent public API.

## Decision 9: Align Governance Before Code Delivery

**Decision**: Amend Constitution Principle VIII so the app-level primary gate is authoritative and
secondary component loading is permitted. Keep primitive host props, view-owned default chrome, and
transformation placement unchanged.

**Rationale**: The approved specification supersedes the constitution's shared view-gate sentence.
Governance permits a documented plan deviation, but code must not leave the contradiction unresolved.

**Alternatives considered**:

- Ignore the mismatch: rejected because plans and tasks must comply or justify deviations.
- Restore view-level primary gating: rejected because it contradicts the approved specification.
