# ADR-015 — Documentation surface split: in-repo docs, public docs site, Confluence

**Date:** 2026-05-08
**Status:** Accepted (with open action — see below)
**Phase:** 0 — Alignment & decisions (clarified during 2026-05-08 review meeting)
**Cross-references:** ADR-010 (cutover-first sequencing, Phase 9D)

---

## Context

Three documentation surfaces currently exist for ContentGrid navigator work:

| Surface                                           | Audience                 | Current content                                                                                                      |
| ------------------------------------------------- | ------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| In-repo `docs/` (this ADR set, analysis, roadmap) | Developers, architects   | Architecture decisions, migration plan                                                                               |
| Public docs site (planned for Phase 9D)           | End users                | How to use the navigator — deferred                                                                                  |
| Confluence                                        | Operators, internal team | Operational runbooks, deployment ops, internal notes, some design documentation                                      |
| Obsidian (author's PARA vault)                    | Author (Nick)            | Current home for in-flight planning docs (analysis, roadmap, ADR set) during pre-Phase-1 planning; transitional only |

Note: Today (pre-Phase 1) these planning docs live in the author's local Obsidian vault under the PARA structure (`01_Projects/ContentGrid/`), not yet in any git-tracked code repository. This is appropriate for the pre-Phase-1 planning phase. When Phase 1 scaffolds the monorepo, these docs migrate to the in-repo `docs/` directory.

No clear ownership rules have been documented. Design documentation is scattered — some in Confluence, some in ad-hoc files. Thijs flagged this on 2026-05-08: "we have documentation on Confluence, we have some website, we have some design documentation — I think we need to review clearly what goes where." A dedicated alignment meeting was proposed.

Without an explicit split, the risk is:

- ADRs and architecture decisions get written in Confluence (where they are disconnected from the code change that motivated them).
- User-facing content gets written in-repo before the app is stable enough to document.
- Operational runbooks get written in-repo where they're harder to discover for non-developer operators.

## Decision

**Four-surface ownership model:**

1. **In-repo `docs/adr/`** (post-Phase 1) — architecture decisions (this ADR set), the migration analysis, and the migration roadmap. Rationale: these documents change when the code changes; version-controlling them alongside the code enables code-review-linked ADR review, bisectable history, and a consistent source of truth for the team.

2. **Public docs site (Phase 9D)** — user-facing documentation: how to use the navigator, how-to guides, configuration reference. Deferred to Phase 9D. Do not write user docs until the app is stable enough to justify a committed docs surface. When Phase 9D runs, the site lives at a published URL (Docusaurus or VitePress, deployed from CI).

3. **Confluence** — operational runbooks (deployment procedures, environment setup, on-call guides) and internal-process notes (sprint cadence, contact lists). Existing convention; internal audience; not version-controlled with the codebase.

4. **Obsidian (author's local PARA vault)** — current home for in-flight planning docs (analysis, roadmap, ADR set) until Phase 1 scaffolds the monorepo's `docs/` directory. Migration is one-way (Obsidian → in-repo `docs/`); no canonical content stays in Obsidian post-Phase 1 except the author's personal notes.

**Migration of existing Confluence design documentation:** navigator-specific design documentation currently in Confluence is to be reviewed and migrated to in-repo `docs/` where it qualifies as architecture/design content rather than operational content. This review has not been completed; it is an explicit open action (see below).

**When Phase 1 scaffolds the monorepo:** this analysis, the roadmap, and the ADR set migrate from the WORK vault to the repo's `docs/` directory as part of Phase 1.1 (monorepo bootstrap). ADRs continue at `docs/adr/`.

## Open action (not yet decided)

**Confluence design documentation review:** Nick + Thijs to align on which Confluence pages qualify as in-repo architecture content before Phase 1 starts. Specifically: any design doc that records a decision about how the navigator is built or structured belongs in `docs/adr/` or `docs/`; any doc that records how to operate or deploy a running instance belongs in Confluence. Pages that are ambiguous go to the meeting for a case-by-case call.

**Deciding actors:** Nick Van Vynckt + Thijs
**Trigger:** before Phase 1 starts (monorepo bootstrap)

## Alternatives considered

| Option                               | Why rejected                                                                                                                                                                        |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Everything in Confluence**         | ADRs divorced from the code that implements them; no PR-review linkage; non-searchable from the IDE; breaks OSS consumers who have no Confluence access.                            |
| **Everything in-repo**               | Operational runbooks in-repo make the repo harder to navigate for non-developer operators; they don't belong in OSS scope; they change on deployment-ops cadence, not code cadence. |
| **Everything in a public docs site** | User-facing docs are premature until the app is stable; architecture docs need version-controlled history that a CMS cannot provide.                                                |

## Consequences

**Positive:**

- ADR and architecture doc history is in git — bisectable, linkable from PRs, reviewable alongside code changes.
- OSS contributors get the architecture context in the repo they're already reading.
- Operational runbooks stay in Confluence where operators already look for them.
- User-facing docs are deferred until the app justifies a committed docs surface — no premature documentation overhead.

**Negative / accepted:**

- Three surfaces to keep in sync when a topic spans more than one (e.g. a deployment change that requires both an ADR update and a Confluence runbook update). Accepted — the overlap should be rare if the ownership lines are respected.
- Confluence design documentation migration is an action item that must happen before Phase 1; it adds a small discovery and migration cost.
- OSS contributors cannot see operational runbooks. This is intentional — operational details are internal.

**Transitional state (Phases 0–0.5):**

- Until Phase 1: docs are not version-controlled with the code; they live in the author's Obsidian vault. Review happens by sharing the markdown files (or rendered exports) directly. This is appropriate for the pre-Phase-1 planning phase but not a long-term home.
- After Phase 1: docs live in-repo and follow the same PR-review flow as code changes. The migration from Obsidian to `docs/` is a one-way move bundled with Phase 1.1 (monorepo bootstrap).

## Reconsider when

- The team grows to the point where Confluence access and in-repo access are managed by different teams, creating a governance overhead. Then evaluate a unified docs platform.
- The public docs site grows to include architecture/ADR content (e.g. a "how it works" section for OSS contributors). At that point, the in-repo `docs/` content could be cross-published, but the source of truth stays in-repo.

---

## Authors

Nick Van Vynckt

---

**Hub:** [[README|ADR Index]]
