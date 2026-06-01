# ADR-009 — Visual regression: Playwright story snapshots (Chromatic rejected on cost)

**Date:** 2026-05-12
**Status:** Accepted
**Amendment 2026-05-12:** Added story-tooling decision (Storybook 10 adopted, Ladle rejected).
**Amendment 2026-05-12:** Narrowed VR scope to `packages/ui` only; page-level VR deferred.
**Amendment 2026-05-30:** Replaced the default `maxDiffPixelRatio: 0.01` with an absolute `maxDiffPixels: 100`; full-page capture explicitly retained over per-element (see Flake mitigation).
**Phase:** 0 — Alignment & decisions

---

## Context

We need visual regression testing for the component library and key pages. Two real options:

1. **Chromatic** — hosted, integrates with Storybook, friendly review UX. Paid product after a small free tier.
2. **Playwright snapshots** — self-hosted, runs in our existing CI, baselines committed to the repo.

The motivation is twofold: catch unintended UI diffs in PRs, and provide an "agent visual feedback loop" — agents write a component, CI shows them whether the rendered output changed.

Chromatic's free tier (~5,000 snapshots/month) is tight for a 25+ component library with multiple variants per story, plus pages. The team has flagged the paid tier as too expensive for the current scope.

Visual regression has been attempted before on this team and abandoned. The root cause was not just pixel flake but scope: page-level snapshots re-baselined on every intentional UI change, the team learned to lower thresholds to reduce noise, and VR stopped catching anything meaningful. This ADR explicitly addresses both root causes — scope is narrowed so VR only covers surfaces with a frozen visual contract, and the flake-mitigation section below makes the remaining snapshots deterministic. See "Scope: where VR applies (and where it doesn't)" below.

## Decision

**Use Playwright story snapshots for `packages/ui` primitives and patterns only. Do not adopt Chromatic. Do not snapshot application pages, console screens, or in-development surfaces.**

- Playwright runs against Storybook in CI, capturing one snapshot per variant for `packages/ui` stories only.
- Baselines committed under `tests/__snapshots__/` in the navigator monorepo.
- Diffs reviewed in PR exactly like any other code change.
- Every `packages/ui` primitive and pattern has a story; primitives in Phase 3+ are also snapshotted.

## Why Playwright snapshots

- **Free.** Self-hosted, runs in GitHub Actions on infrastructure we already pay for.
- **Reviewable in PR.** Diffs are git-tracked. Approval is a code review, not a third-party UI.
- **No external dependency.** No vendor lock-in, no SLA risk, no surprise pricing change.
- **Already in the stack.** Phase 2 ports the existing Playwright config; adding snapshot mode is a small extension.
- **Agent-feedback parity.** The "agent reads the visual diff" loop works identically — agents read the snapshot diff in CI output. Whether the diff is hosted by Chromatic or by GitHub Actions doesn't change the loop's substance.

## Story tooling: Storybook 10 (Ladle rejected)

**Use Storybook 10 (currently 10.3.6, ESM-only, CSF Factories) as the story authoring tool. Ladle is rejected.**

### Why Storybook 10

- **MDX/autodocs.** First-class documentation alongside components; Ladle has neither.
- **`@storybook/addon-a11y` with CI test-runner integration.** Structured pass/fail a11y results that a CI agent can read and act on — not just visual diffs.
- **Vitest-integrated test runner.** Interaction tests run in the same pipeline as unit tests; no separate process to wire up.
- **1000+ addons, industry-standard CSF.** External contributors to an Apache-2.0 library already know Storybook. Onboarding friction is lower when the tooling is the ecosystem default.
- **Funded, active maintainer (Chromatic).** Long-term maintenance risk is lower than Ladle.

### Why not Ladle

- Ladle 5.1.1 (Nov 2024) is the latest release; no meaningful features shipped in ~18 months.
- Single maintainer (Uber-affiliated). Bus factor of one is unacceptable for a long-lived OSS library.
- No addon ecosystem. A11y, interaction testing, and autodocs all require addons Ladle does not support.
- No MDX or batch a11y CI runner. The agent-feedback loop relies on structured test results, not just visual diffs; Ladle cannot provide them.

### Trade-offs accepted

Storybook 10's ESM-only design reduces the transitive dependency footprint compared to v8/v9, but the install is still heavier than Ladle's minimal footprint and the dev-server cold start is slower. One-time setup cost includes wiring Tailwind v4: add `@tailwindcss/vite` to the shared Vite config and import `tailwind.css` in `.storybook/preview.ts` (~10 minutes). Before adopting, verify that nothing in the monorepo is CJS-only — SB10's ESM-only constraint is a hard requirement, not a soft preference.

## What we lose (vs. Chromatic)

- **No hosted review UI.** Reviewers see PNG diffs in PR rather than a polished side-by-side view. Workable, but less ergonomic.
- **No automatic baseline approval workflow.** Updating baselines is an explicit `pnpm test:visual --update-snapshots` commit. Slight friction; also a feature (changes are deliberate).
- **No cross-browser visual matrix out of the box.** We snapshot in Chromium by default. WebKit and Firefox visual coverage is opt-in for select stories (e.g. PDF/extraction work in Phase 6, where engine differences matter).
- **No flake-handling magic.** Some stories will be inherently variable (animations, randomised data). We disable them per-story or stub the variability — same problem Chromatic has, just less polished tooling.

## Flake mitigation: keeping pixel-shift noise out of the loop

Prior attempts at visual regression testing failed because trivial rendering differences — sub-pixel antialiasing, font hinting, OS-level rendering — produced false-positive diffs that the team learned to ignore, which defeats the purpose entirely. The mitigations below are mandatory, not optional.

**Baselines are generated in CI, never on developer machines.** macOS and Linux render fonts differently in ways no threshold can paper over. CI runs on Linux (`ubuntu-latest` or a pinned Docker image). Updating a baseline means triggering the dedicated CI workflow with `--update-snapshots`, downloading the artefact, and committing it. Running locally is for diagnosing failures — not for authoring baselines.

**Pin the rendering environment.** Use a pinned Playwright Docker image (`mcr.microsoft.com/playwright:v<version>-jammy`) for both the CI snapshot job and any local re-baselining. Fixed viewport: 1280×720 default, 390×844 for mobile-tagged stories. Fixed `deviceScaleFactor: 1`, fixed locale and timezone in the Playwright `use` config.

**Normalize fonts.** Bundle web fonts into the Storybook static build — do not rely on Google Fonts CDN or system fallbacks. Before each screenshot, `await page.evaluate(() => document.fonts.ready)`. Use `font-display: block` during tests to eliminate FOIT/FOUT noise.

**Disable animations and transitions.** Use `toHaveScreenshot({ animations: 'disabled' })` plus a global `<style>` injection in the Storybook preview: `* { animation-duration: 0s !important; transition-duration: 0s !important; }`. Also set `caret: 'hide'` to suppress text-input cursor blinking.

**Stub all non-determinism at the story level.** No `new Date()` in render paths — stories pass fixed dates. Seed any RNG. No real network calls — MSW handlers return fixed responses. No `Math.random()` for IDs; use a deterministic counter in stories instead.

**Freeze the page clock before navigation.** The harness calls `await page.clock.setFixedTime(new Date("2025-01-15T12:00:00Z"))` before each `page.goto(...)`. This pins `Date` at the browser level so date-dependent components (e.g. Calendar, which renders the current month and today highlight via react-day-picker) are deterministic regardless of the CI run date. `setFixedTime` pins the clock without pausing timers, so `document.fonts.ready` still resolves normally.

**Set sensible thresholds, but treat them as a safety net.** Default: `maxDiffPixels: 100` (an absolute count) with `threshold: 0.2` per-pixel — superseding the original `maxDiffPixelRatio: 0.01`. The ratio was the wrong default for this setup: snapshots are full-page (1280×720 ≈ 921k px) but most stories are a single small centered component, so 1% (~9,200 px) is larger than an entire button — a small component could lose all of its styling and still pass, which is exactly the "VR that catches nothing" failure this ADR exists to prevent. Because baselines and CI render in the _same_ pinned Docker image, an unchanged component diffs at ~0 px; a tight absolute cap is therefore both sensitive (any real regression shifts far more than 100 px) and flake-safe. Stories that need stricter — icons — override down (e.g. `maxDiffPixels: 20`); stories that need looser — charts, gradients — override up explicitly with a comment explaining why.

**Capture stays full-page, not per-element.** Per-element screenshots (`#storybook-root`) were considered — they would make the threshold component-relative — but rejected: Radix/shadcn overlays (Dialog, AlertDialog, Sheet, Popover, DropdownMenu, Tooltip, Select content) render through portals to `document.body`, _outside_ the story root, so an element screenshot captures only the trigger and misses the overlay entirely. Full-page capture covers both inline and portaled content; the absolute pixel cap above is what restores small-component sensitivity, so we keep full-page and tighten the threshold rather than narrowing the frame.

**Mask known-dynamic regions** with Playwright's `mask:` option rather than trying to make them deterministic when stubbing isn't practical (e.g. live status indicators in a Phase 6 PDF preview).

If flake exceeds ~1% of CI runs despite these mitigations, that's the trigger from "Reconsider when" — don't paper over it with looser thresholds.

## Scope: where VR applies (and where it doesn't)

Scope discipline is as important as flake discipline. Both failures come from the same root cause: VR that produces too much noise gets ignored. Tight scope is what makes the signal meaningful.

**In scope — VR snapshots required:**

`packages/ui` primitives and patterns (Button, Input, Card, Dialog, Form primitives, etc.), but only once they reach Phase 3 exit (stable API, frozen visual contract). One snapshot per variant. Design tokens are covered by representative snapshots of the components that use them — no standalone token snapshots.

**Out of scope — VR snapshots NOT taken:**

Application pages, console screens, dashboard layouts, and anything under active visual iteration. These surfaces still have stories — stories are mandatory across the board for development and a11y/interaction testing — but no pixel comparison is applied. The reason: page-level surfaces change often by design. Pixel-pinning them creates re-baselining churn that exceeds the regression value. They rely on a11y assertions (`@storybook/addon-a11y` + CI test runner) and interaction tests instead.

**Re-baselining is a normal, frictionless step.**

A dedicated CI workflow (`pnpm test:visual:update`, triggered manually) generates updated baselines in the pinned environment, attaches the snapshot diff PNG as an artefact link in the PR, and produces a single commit. If the team treats re-baselining as a battle, the same failure mode as before will repeat. The workflow being painless is a non-negotiable part of this decision, not a nice-to-have.

**When VR fires, the default question is "is this change intentional?" — not "is this a bug?"**

Most diffs will be intentional. The signal value is the small minority that are not: a design token tweak that accidentally shifts an unrelated component, a refactor that changes padding on a Button variant. That signal is worth the cost only if noise is kept low — tight scope, deterministic stories, and a smooth re-baseline path. All three are required together.

## What this requires from Storybook coverage

Every primitive and pattern in `packages/ui` must have a story. This is **mandatory**, not aspirational:

- Phase 3 exit criteria: 100% of `packages/ui` exports covered by stories.
- New primitives/patterns added later: enforced by an ESLint rule (`eslint-plugin-storybook` + a custom rule that flags exports without an adjacent `*.stories.tsx`).

Story coverage and snapshot coverage are separate requirements:

- **Stories:** all `packages/ui` primitives/patterns, plus all application surfaces. Stories are mandatory everywhere — they drive development, a11y tests, and interaction tests regardless of whether snapshots are taken.
- **Snapshots:** `packages/ui` primitives and patterns only, from Phase 3 exit onwards. CI fails if a `packages/ui` story lacks a snapshot baseline (or an explicit `meta: { snapshot: false }` for stories that genuinely cannot be snapshotted). Application stories are not snapshotted by default and do not trigger this check.

## Setup outline (for Phase 1)

1. `pnpm add -D @playwright/test @storybook/test-runner` (or use Playwright directly against the static Storybook build).
2. CI step: build Storybook static, serve it locally, run Playwright against it.
3. Snapshot strategy: full-page screenshot per story at a fixed viewport (1280×720 default; mobile 390×844 for stories tagged `mobile`).
4. Baselines committed; diffs surface in PR via Playwright's HTML report uploaded as a CI artefact.
5. Re-baseline command: `pnpm test:visual --update-snapshots` — run locally, commit the diff, justify in PR description.

## Consequences

**Positive:**

- Zero recurring cost for visual regression.
- Baselines are version-controlled artefacts. History of UI changes lives in git.
- No new account, no new dashboard, no new permissions to manage.
- OSS consumers inherit the testing setup without needing a Chromatic account.

**Negative / accepted:**

- Snapshot diffs are PNG-in-PR, not a hosted UI. Reviewers must look at the artefact link.
- Repo size grows with baselines. Mitigated by limiting to one viewport per story by default; PNG storage is cheap.
- Re-baselining a wide UI change (e.g. design token tweak) touches many files in one PR. Acceptable; the alternative is a hidden "approve all" button.
- Cross-browser visual coverage is opt-in. We accept Chromium-only as default; explicit opt-ins for stories where engine difference is the point.

## Reconsider when

- Visual review becomes a meaningful PR bottleneck for non-engineering reviewers (e.g. designers). Then a hosted UI may justify the cost — start with the Chromatic free tier as a probe before committing to paid.
- Snapshot flake exceeds ~1% of CI runs and we can't isolate the cause. Then evaluate Chromatic's flake-detection or a different tool.
- The `@contentgrid/ui` package is published externally with many consumers (ADR-008): a hosted UI might help downstream teams more than it helps us.
- Page-level VR is considered only after `packages/ui` primitives have shipped two stable release cycles with sub-1% flake and a routine re-baselining workflow. Until then, application-level visual checks rely on a11y + interaction tests, not pixel comparison.

---

**Hub:** [[README|ADR Index]]
