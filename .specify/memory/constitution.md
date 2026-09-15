<!--
Sync Impact Report
- Version change: 1.0.0 → 1.4.1
- Correction (1.4.0 → 1.4.1, PATCH): Principle III cited `HalFormsCodecs` as an example of an
  existing `navigator-data` re-export. It isn't one — the Layer-1 codec is only ever imported
  internally as the default export `halFormCodecs` (four accessor files), never re-exported, and
  features/ui never need it directly. Replaced with `HalFormValues`, which is actually exported.
  Found while auditing the real barrel for ADR-018's export-gaps section.
- Modified principles:
  - I. HAL Is the Only Interaction Model: added the binary-content exception (no HAL-FORMS
    template exists for `cg:content` PUT/GET) — the principle as written contradicted this
    documented, sanctioned behavior; corrected/completed.
  - II. Model-First — No Hardcoded Domain Knowledge: added a bullet requiring profile
    discovery to go through the `navigator-data` accessor classes rather than raw HAL JSON
    parsing (MINOR bump, 1.0.0 → 1.1.0).
  - III. Two-Layer Dependency Model & Package Boundaries: added a bullet permitting
    `navigator-data` to explicitly re-export selected Layer-1 functions/classes/types
    (`createValues`, `HalFormsCodecs`, etc.) for callers that need them (MINOR bump,
    1.1.0 → 1.2.0); added a bullet gating `packages/dev-tools` behind a dev-only import check.
  - V. Deny-by-Default ABAC: added the "gated both before and after the mutation" nuance for
    Update.
  - VI. Authentication, Token Handling & Webhook Verification: NEW principle (Bearer-token
    handling, OIDC Discovery, token refresh, webhook JWT/JWKS verification) — previously
    entirely unrepresented in this document.
  - VII. Supply-Chain Integrity for Dependencies: renumbered from VI (no content change) to
    make room for the new Authentication principle above it; cross-reference in "Development
    Workflow & Quality Gates" updated accordingly.
  - VIII. View-Owned Data Loading, App-View Contract & Transformation Placement: NEW principle
    condensing ADR-018's target architecture (app→view primitive-props contract, router-loader
    data-loading guarantee, shared profile-entity gate, view-owned default page content,
    util-layer transformation placement) — explicitly scoped as forward-looking/binding for new
    work only, not retroactive.
- Modified sections:
  - Error Handling & API Contracts: expanded from two short paragraphs into a concrete,
    testable contract grounded in the actual `packages/navigator-data/src/api/problem-details/`
    and `packages/features/src/problem-details/` implementations (MINOR bump, 1.2.0 → 1.3.0).
- Added sections: none new this amendment beyond the principles above (see 1.0.0 entry for the
  initial set: Core Principles I–VI as originally named; Error Handling & API Contracts;
  Development Workflow & Quality Gates; Governance)
- Removed sections: n/a
- Templates requiring follow-up: not checked — out of scope for this command (see its own
  Scope Guard); dependent templates/commands read this file at run time.
- Prior resolved item: RATIFICATION_DATE set to 2026-09-15 (PATCH bump, 1.3.0 → 1.3.1).
- Deferred items: none outstanding.
- This report is scratch material for reviewing the amendment and should be removed before
  the amended file is committed.
-->

# ContentGrid Navigator Horizon Constitution

## Core Principles

### I. HAL Is the Only Interaction Model (NON-NEGOTIABLE)

- Every mutation MUST be driven by the resource's own `_templates` (HAL-FORMS): read
  `method`, `target`, and `contentType` from the item's `default`/`delete`/`set-<rel>`/
  `add-<rel>`/`clear-<rel>` template, or the profile's `create-form` template. Hardcoding an
  HTTP method, URL, or Content-Type instead of reading it from a template is prohibited.
- **Binary content is the one documented exception to template-driven mutations**: a `cg:content`
  PUT/GET has no HAL-FORMS template at all. `entityItem.uploadContentRequest`/
  `downloadContentRequest` MAY construct a `Request` by hand for this case only — gated on the
  `cg:content` link's presence (`entityItem.canUploadContent(attrName)`), using `contentFetch`
  (not `apiFetch`) for the binary transfer. This, together with `unlinkItemRequest` (below), are
  the only two hand-built-`Request` exceptions in the codebase; neither is a precedent for a
  third.
- URLs MUST come only from HAL links: collection URLs from `cg:entity` links, item URLs from
  the profile's templated `describes` link (or `profileEntity.itemUrl(id)`), relation/content
  URLs from `cg:relation`/`cg:content` links. String-building, concatenating, or
  regex-replacing a URL (`href.replace(...)`, `${collectionHref}/${id}`, `.split("/").pop()`)
  is prohibited, with no exception beyond the single explicitly-documented workaround in
  `packages/navigator-data/CLAUDE.md` (`unlinkItemRequest`'s per-item DELETE, pending a
  server-provided template — not a model for any other URL construction).
- HAL-FORMS template property values MUST be set through the template's own value API
  (`createValues(template).withValue(name, val)`) and encoded by `HalFormsCodecs`. Building a
  request body or URL by string-interpolating a value into it, instead of setting it as a
  template value, is prohibited — the codec owns encoding; hand-rolling it produces requests
  the server cannot reliably parse and silently skips validation the template already encodes.
- Entity item IDs MUST be read from the `id` field. Parsing an ID out of a self href
  (`selfHref.split("/").pop()` or any href-parsing idiom) is prohibited — URL structure is a
  server implementation detail the client must not depend on.
- Pagination cursors MUST never be parsed or constructed by hand — follow `next`/`prev`/`self`
  links directly. The one narrow exception is using an opaque `_cursor` value as a lookup key
  into a client-side registry that maps back to the exact link it came from; the value itself
  is never decoded, and no fetch URL is ever built from it by hand.
- Every mutating request MUST carry `If-Match` from a verbatim, unmodified ETag, stored only
  for the session (never persisted). A 412 (`unsatisfied-version`) MUST be handled by
  re-fetching, re-applying the user's change, and retrying — a hook MUST NOT swallow or
  auto-retry a 412 itself.

Rationale: the REST/HAL API is the platform's only integration point. Every deviation above
re-encodes a piece of server-owned structure — a path shape, a cursor format, a template
encoding rule — into client code, which breaks the moment the server changes that structure.
This is exactly the failure mode hypermedia-driven APIs exist to prevent, and it is the most
frequently violated class of rule in past HAL-Forms audits of this codebase.

### II. Model-First — No Hardcoded Domain Knowledge

- Entities, attributes, relations, and operations MUST be discovered at runtime from the
  Profile API (`/profile`, `/profile/{entity}`) — never hardcoded.
- Entity collection paths MUST use the plural `href` from the profile's `cg:entity` link,
  never the singular `name` field.
- Content attributes MUST be identified via `attr.isContent` (object type with embedded
  `blueprint:attribute` children), never via a `type === "content"` check (no such enum
  member exists) or by probing for sub-field names (`filename`, `mimetype`, `length`).
- Audit-role fields (created/modified date/by) MUST be discovered via `blueprint:constraint`
  system-managed types, never via literal field-name matching (`created_date`, etc.).
- Profile discovery MUST go through the `navigator-data` accessor classes — `ProfileEntity`,
  `ProfileAttribute`, `ProfileRelation`, and the HAL-FORMS template accessors
  (`SearchHalFormTemplate`, `CreateHalFormTemplate`) — and the hooks built on them
  (`useProfileEntity`, `useProfileEntities`). Parsing the raw `/profile`/`/profile/{entity}`
  HAL JSON directly in a feature or UI component, instead of going through these accessors, is
  prohibited.

Rationale: Navigator renders one generic UI over an arbitrary, customer-defined data model.
A hardcoded name is a hidden assumption that breaks the first time a different application's
model doesn't happen to share it.

### III. Two-Layer Dependency Model & Package Boundaries

- `packages/ui` MUST NOT import `@contentgrid/hal`, `@contentgrid/hal-forms`, or any other
  Layer-1 package, and MUST NOT import from `packages/features` or `apps/*`. `@radix-ui/*`
  MUST only be imported inside `packages/ui`.
- `packages/navigator-data` MUST NOT import from `packages/ui`, `packages/features`, or
  `apps/*`. All seven Layer-1 `@contentgrid/*` packages MUST remain `peerDependencies` —
  re-vendoring or re-implementing what they provide is prohibited.
- `packages/navigator-data` MAY explicitly re-export selected functions, classes, and types
  straight from the underlying `@contentgrid/*` Layer-1 packages — e.g. `createValues`,
  `HalFormValues`, `HalFormsProperty`, `HalFormsTemplate` — when a caller in
  `packages/features` or `packages/ui` needs them to build or type HAL-FORMS values/templates.
  This is the sanctioned way those packages reach Layer-1 capability without importing a
  Layer-1 package directly; the re-export MUST be explicit and named, never a blanket
  `export *` of the whole Layer-1 package.
- `packages/features` MUST NOT import a Layer-1 `@contentgrid/*` package directly (go through
  `@contentgrid/navigator-data`), and MUST NOT import from `apps/*`. A `stable` feature MUST
  NOT import a `candidate` or `experimental` feature.
- The primitive/pattern boundary in `packages/ui` MUST hold: primitives (`src/primitives/`)
  carry no Navigator-domain or HAL knowledge; the HAL-Forms field-renderer patterns take only
  plain scalar props (`name`, `label`, `required`, `value`, `onChange`, `error?`, …), never a
  `FieldDescriptor` or other HAL-Forms-shaped type.
- `packages/dev-tools` (dev-only tooling such as the Application Selector) MUST only be
  imported behind an explicit dev-only guard (e.g. `import.meta.env.DEV`) so bundlers
  tree-shake it out of production builds. It carries no `x-stability` flag and has no
  promotion path to production regardless of track — it is not a product feature under
  Principle IV, and MUST NOT be treated as one.

Rationale: this boundary is what keeps a backend contract change from forcing a rewrite of
the UI layer, and what keeps `packages/ui` reusable independent of any ContentGrid-specific
data concern.

### IV. Three-Track Delivery & Stability Gating

- Every feature directory in `packages/features/src/` MUST declare an `x-stability` field
  (`experimental` | `candidate` | `stable`) in its `package.json`. A new feature MUST start
  at `experimental`.
- `apps/navigator` (generic track) MUST import only `stable` features and MUST NOT contain
  customer-specific code, in-flight demos, or half-built features. `apps/navigator-experimental`
  may import `experimental`, `candidate`, or `stable` features, and MUST NOT be hosted on a
  public URL.
- Promotion (an `x-stability` flip) MUST NOT move code between directories — no fork drift —
  and MUST go through code review, gated on every dependency of the feature being at or above
  the target stability tier.

Rationale: this is the mechanism that lets one shared codebase serve a production track and
an experimentation track without either contaminating the other.

### V. Deny-by-Default ABAC — Template/Link Presence Is the Permission Signal

- Access is denied by default. A UI operation MUST be gated on the presence of its HAL-FORMS
  template or link, never assumed from a role or a client-side flag. Absence of
  `_templates.delete` (or any other template) means that operation MUST NOT be rendered or
  invoked.
- Capability MUST be read through a named boolean derived from template presence
  (`canUpdate`, `canDelete`, `canCreate`, `canSet`, `canClear`, `canAdd`, …) — feature code
  MUST NOT re-check a raw template inline.
- A 403, or a 404 on a single-item read, MUST be treated as an authorization outcome, not an
  error to retry — the application API does not expose permission conditions, and a collection
  query silently filters out items the current user cannot see.
- **Update is gated both before and after the mutation**: an ABAC policy's conditions must be
  satisfied by both the pre-mutation and the post-mutation state of the item. A client MUST NOT
  assume that passing the pre-mutation check (e.g. a visible `default` template) guarantees the
  mutation will succeed — a 403 after submitting a value that would violate a condition on the
  resulting state is expected, policy-correct behavior, not a bug to work around.

Rationale: template/link presence is the only signal the frontend has for what the
centrally-evaluated ABAC policy allows for the current user. Treating anything else as the
permission source either renders a control the user cannot actually use, or hides one they
can.

### VI. Authentication, Token Handling & Webhook Verification

- All API access MUST use an OIDC-based Bearer token (RFC 6750), sent in the `Authorization`
  header only — never as a query parameter, cookie, or embedded elsewhere in the request.
- Token endpoints MUST be discovered via OIDC Discovery (`/.well-known/openid-configuration`);
  hardcoding a token or authorization endpoint URL is prohibited.
- Tokens are short-lived (5 minutes by default). A client MUST refresh proactively rather than
  reacting to expiry failures as the primary refresh trigger.
- A webhook's `ContentGrid-Signature` header (an RS256-signed JWT) MUST be verified using the
  public keys at `GET ${CONTENTGRID_URL}/.well-known/jwks.json`, selecting the key by the `kid`
  in the JWT header (keys rotate) — verification MUST use an established JWT library, never a
  hand-rolled signature check.

Rationale: token handling and webhook verification are the platform's actual trust boundary.
A hardcoded endpoint breaks silently on issuer rotation; a hand-rolled signature check is the
highest-risk place in the codebase to get subtly wrong.

### VII. Supply-Chain Integrity for Dependencies (NON-NEGOTIABLE)

- A package install MUST pin an explicit version. `latest`, an unpinned install, or a
  `"*"`/`"latest"` range in `package.json` is prohibited.
- A package version published more recently than `pnpm-workspace.yaml`'s
  `minimumReleaseAge` (currently 14 days) MUST NOT be installed; this setting MUST NOT be
  lowered or bypassed per-install.
- `blockExoticSubdeps`, the empty `onlyBuiltDependencies` allowlist, and `approve-builds=false`
  MUST NOT be disabled or bypassed. Adding a package to `onlyBuiltDependencies` requires
  understanding why it needs a build script, plus review.
- `pnpm-lock.yaml` is the source of truth; CI MUST install with `--frozen-lockfile`.
- GitHub Actions MUST be pinned to full 40-character commit SHAs with a trailing
  human-readable version comment, never a mutable tag.
- `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `.npmrc`, and `.github/workflows/**` are
  CODEOWNERS-protected and MUST go through review before merging, with the single documented
  exception of the Renovate app's own bypass for its minor/patch dependency PRs — never
  extended to a human contributor or to an AI agent.

Rationale: this is the concrete set of controls already in place against a compromised or
just-published dependency version; loosening any one of them for convenience defeats the
others.

### VIII. View-Owned Data Loading, App-View Contract & Transformation Placement

Forward-looking target architecture (ADR-018, `docs/adr/ADR-018-feature-view-component-viewmodel-split.md`
— a living spec, not a frozen decision record). Binding for new `packages/features` work
generated through `/speckit-plan`/`/speckit-tasks`; existing code that has not yet migrated
(e.g. `EntityProfileGate` and its route-mounted gate) is not retroactively non-compliant, but
MUST NOT be used as a model for new work.

- An app (`apps/*`) MUST pass a view only primitive props — string identifiers and plain
  callback functions. Passing a resolved domain object (`ProfileEntity`, `EntityItem`, …) that
  the app itself fetched is prohibited; the view resolves its own data via `navigator-data`
  hooks.
- An app's route-level responsibility is exactly: choose which view to mount, choose the
  layout wrapping it, supply identifiers/callbacks, and guarantee — via the router's own
  `loader` plus `pendingComponent`/`errorComponent`/`notFoundComponent`, not a swallow-and-hope
  `beforeLoad` — that the view's required data is loaded before it mounts.
- A view MUST gate its own loading/error/not-found state through one shared, reusable
  primitive (e.g. a `useProfileEntityGate`-style hook in `packages/features/src/util/`) rather
  than each view hand-rolling the same three-way branch.
- A view computes its own default page content (e.g. breadcrumb labels) from the data it
  resolved, while remaining overridable via explicit props (e.g. `breadcrumbs`, `actions`) for
  a caller that needs different chrome.
- Transformation logic (data reshaping, formatting, HAL-wire-type mapping, etc.) MUST live in
  a feature's `util/` layer — or the cross-feature `packages/features/src/util/` root when used
  by 2+ features — never duplicated inline inside a view or component. A view's job is
  orchestration only; a component consumes already-transformed data.

Rationale: an app holding a resolved domain object forces every app to re-derive anything built
from it (e.g. breadcrumb labels), once per call site — the exact duplication pattern already
found in this codebase (independent, drifting "item count" strings in the collection view and
table; a hand-duplicated HAL wire-type switch between `search/` and `entity-item-create/`).
Concentrating data loading, gating, and transformation in one owner per concern removes the
class of bug, not just today's two instances of it.

## Error Handling & API Contracts

All error responses use `Content-Type: application/problem+json` (RFC 9457): `type` (URI),
`title`, `detail`, `status`, plus problem-specific fields. A mutation/query function MUST
reject with `Error` as its typed error (never a narrower `ProblemDetailError` generic) —
every non-2xx HTTP response surfaces as `ProblemDetailError` (via `checkResponse`), but a
pre-fetch affordance/ABAC guard or a network failure rejects with a plain `Error`; `Error` is
the accurate common supertype, and callers narrow at the point of use.

- **Narrowing MUST use the provided guards** (`packages/navigator-data/src/api/problem-details/guards.ts`)
  — `isProblemDetailError`, `isProblemOfType`, `isProblemWithStatus`, `isValidationProblem`,
  `getValidationFieldErrors` — never a raw `instanceof ProblemDetailError` plus manual
  `.problemDetail.status`/`.type` comparison. `isProblemWithStatus` MUST be used for
  status-only checks (e.g. 412) so an opaque, typeless problem (masked 403, Spring Boot
  default 500) is still matched correctly.
- **Every caught error MUST be converted to a `ProblemDisplayModel` via `toProblemDisplayModel`
  before being rendered.** This is the only bridge from a caught `Error`/`ProblemDetailError`
  to presentation data; hand-rolling problem-detail rendering from a raw
  `ContentGridProblemDetail` in feature code is prohibited. A problem `type` this module does
  not (yet) recognize, or a validation `errors[]` entry whose `type` isn't modeled, MUST fall
  back to `kind: "unknown"` / `kind: "unknownField"` rather than throwing — the bridge is
  forward-compatible with problem types the server may add later.
- **Rendering MUST go through the `ProblemAlert` dispatcher** (`packages/features/src/problem-details/`),
  which switches on `model.kind` to the matching component — `ValidationAlert`,
  `RelationConflictAlert`, `VersionConflictAlert`, or `GenericProblemAlert` (the fallback for
  `queryParameter`/`requestBody`/`header`/`notFound`/`unknown`) — or render one of those
  kind-specific components directly when the call site already knows its problem kind. All of
  them build on the shared `ProblemAlertFrame` shell; a feature MUST NOT construct its own
  status/title/detail alert shell in parallel.
- **A validation problem's entity-level errors (no `field`) and any field-scoped error whose
  `field` doesn't match a rendered form field MUST still reach the user** — typically via the
  non-field-error fallback path a form's container computes (see `entity-item-create`'s
  `nonFieldError` handling), never silently dropped because no `FieldRenderer` exists for that
  field name.
- **Dismissal is scoped to the specific error's identity** (`status|title|detail`), not a bare
  boolean — `ProblemAlertFrame` re-surfaces automatically when a _different_ error of the same
  `kind` arrives, even if the user already dismissed a prior one. A feature MUST NOT add its
  own always-hide-after-dismiss state that would suppress a genuinely new error.
- Every alert MUST offer the RFC 9457 `type` URI as a "view problem type documentation" link
  when `type` is known (§3.1.1: dereferencing `type` should show human-readable docs). An
  opaque (typeless) problem — masked 403, Spring Boot default 500 — MUST NOT be assumed to
  carry one.

`ProblemDisplayModel.kind` — the contract UI code actually switches on — is one of:
`validation`, `queryParameter`, `requestBody`, `header`, `unsatisfiedVersion`, `notFound`,
`blindRelationOverwrite`, `requiredRelation`, `unknown`. These map from the RFC 9457 problem
`type` families: `input/validation` (400, with `errors[]`), `invalid-query-parameter/*` and
`invalid-request/*` (400), `unsatisfied-version` (412), `not-found/*` (404),
`integrity/blind-relation-overwrite` and `integrity/required-relation` (409).

## Development Workflow & Quality Gates

- HAL contract tests (MSW-backed) live alongside the hooks they cover. Adding or changing a
  hook MUST come with an updated MSW handler fixture so contract tests catch shape drift.
- Visual regression is covered by Playwright story snapshots; a UI-affecting pattern/primitive
  change MUST keep its story current.
- A UI/frontend change MUST be exercised against a running dev server in a browser (golden
  path and edge cases) before being reported complete. Passing type checks and unit/contract
  tests verifies code correctness, not feature correctness — if the UI genuinely cannot be
  exercised in a given session, that limitation MUST be stated explicitly rather than implying
  the feature was verified end-to-end.
- Code review is the sole gate for both CODEOWNERS-protected files (Principle VII) and feature
  promotion (Principle IV) — no automated bypass beyond the single documented Renovate
  exception.

## Governance

This constitution condenses and elevates governance rules already distributed across the
repo's per-package `CLAUDE.md` files (root, `packages/ui`, `packages/navigator-data`,
`packages/features`, `packages/dev-tools`, `apps/navigator`, `apps/navigator-experimental`)
and the ADRs under `docs/adr/`. Those files remain the detailed, authoritative reference for
implementation specifics; this document is the condensed set that Spec Kit-generated
specs/plans/tasks are checked against.

- **Amendment**: a change to this file MUST go through the same review path as the
  `CLAUDE.md` files it summarizes. When a `CLAUDE.md` rule that a principle here depends on
  changes, this constitution MUST be amended in the same PR (or an immediately-following one)
  — a stale principle is worse than a missing one.
- **Versioning**: semantic versioning. MAJOR for a removed or redefined principle, MINOR for
  an added principle or materially expanded guidance, PATCH for wording/clarification only.
- **Compliance**: every `/speckit-plan` and `/speckit-tasks` output MUST comply with the Core
  Principles above. A deviation requires an explicit, documented justification in that plan's
  own Complexity/Deviation section — not silent divergence.

**Version**: 1.4.1 | **Ratified**: 2026-09-15 | **Last Amended**: 2026-09-15
