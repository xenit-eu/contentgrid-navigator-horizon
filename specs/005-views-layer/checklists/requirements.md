# Specification Quality Checklist: Views Layer Between Apps and Features

**Purpose**: Validate specification completeness and quality before proceeding to implementation
**Created**: 2026-10-06
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs) — the spec names layers, targets, state and navigation as concepts; type shapes live only in `data-model.md` and `contracts/`, and library names only in `research.md` and `plan.md`
- [x] Focused on user value and business needs (one fix for both apps, restorable lists, reuse by other hosts)
- [x] Written for stakeholders who know the product; developer-facing stories are labelled as such
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain — the six unsettled points are recorded as Open questions and are deliberately left open for the team meeting
- [x] Requirements are testable and unambiguous (FR-001–FR-038)
- [x] Success criteria are measurable (SC-001–SC-008)
- [x] Success criteria are technology-agnostic
- [x] All acceptance scenarios are defined (user stories 1–7)
- [x] Edge cases are identified
- [x] Scope is clearly bounded (In/Out of scope section)
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements map to a user story, an edge case or a success criterion
- [x] User scenarios cover primary flows (item page, list state, link target, split view, reuse, enforcement, preferences)
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into the specification

## Notes

- Items still open by design: the six Open questions in `spec.md`. They do not block PRs 2–8; PR 8 marks its address scheme provisional, PR 7 leaves the unsaved-changes guard in place, PR 9 does not decide the preferences questions, and PR 10 marks the experimental-copy convention provisional.
- Points found while writing, for review: (1) the design lists six navigation functions, of which the first PRs need three; (2) "apps import only views" cannot mean literally nothing else, since apps bootstrap with the data and UI packages; (3) the router-setup code in the shells is router-bound, so "features never import the router" needs it to leave the features package first; (4) the design's navigation list includes functions whose pages are on other branches.
- Review path: human review of `spec.md`, ADR-018 and the constitution amendment in the pull request, then PR 2.
