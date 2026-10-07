# Quickstart: validating the single search bar

**Feature**: [spec.md](spec.md) | **Contracts**: [contracts/](contracts/) | **Data model**: [data-model.md](data-model.md)

A run guide that proves the feature works, layer by layer. It does not describe the
implementation.

## Prerequisites

- Node ≥ 20, pnpm pinned through `packageManager` (Corepack). `pnpm install --frozen-lockfile`.
  No new dependencies are expected for this feature (research R6); if one turns out to be
  needed, Principle VII applies (pinned version, 14-day minimum release age, review).
- A ContentGrid application to run against (configured as for any Navigator dev session), whose
  model has at least: a prefix and a full-text text attribute, an allowed-values attribute, an
  integer and a decimal attribute with range search, a date and a datetime attribute, a boolean,
  audit created/modified dates, and one relation with a prefix search parameter. The `search-bar`
  MSW fixture (contracts/navigator-data.md §6) describes the same shape for tests.

## 1. Static checks

```sh
pnpm typecheck
pnpm lint          # includes x-stability, barrel-export and missing-story checks
pnpm format:check
```

Expected: clean. `entity-search-bar/package.json` declares `"x-stability": "stable"`.

## 2. Unit and contract tests

```sh
pnpm test
```

Must include and pass:

| Area                                               | What is proven                                                                                                                                                                       | Spec                          |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------- |
| `util/build-search-param-descriptors`              | valueKind/mode per fixture param; relation params typed via target attribute; audit role from constraints, not names                                                                 | FR-007, FR-027                |
| `util/apply-search-inclusion`                      | excluded attribute drops all its params; relation params never dropped                                                                                                               | FR-034–FR-036                 |
| `util/classify-search-input`, `select-param-chips` | text hides numbers; integer shows numbers first; "12.5" hides integer; all-direct hides relations                                                                                    | FR-013, FR-021                |
| `util/build-active-filter-chips`                   | range pair → one chip; unknown key → unresolved chip; removal keys                                                                                                                   | FR-003, FR-004a, FR-037       |
| `util/build-quick-filters`                         | one model per attribute; boolean cycle; isActive from any source                                                                                                                     | FR-024–FR-029                 |
| `util/date-presets`                                | last day/week/month/year bounds; date-only vs datetime; exclusive bound shift                                                                                                        | FR-026                        |
| `useSearchParamSuggestions` (MSW)                  | one request per direct param; relation = 2 requests with count from current entity; estimated total; error + refetch; no request below min length; no stale result under newer query | FR-014–FR-016, FR-022         |
| `useSearchAttributeInclusion`                      | user override > backend > default "all"; arrays replace                                                                                                                              | FR-035                        |
| `filterOptionsByPrefix` (ui)                       | prefix, word-start, case/accent-insensitive                                                                                                                                          | FR-016, FR-030                |
| ui component tests                                 | Chip mode segment, FilterButton tones + separate clear button, FilterChips overflow, popover keyboard model                                                                          | FR-003–FR-005, FR-023, FR-025 |

## 3. Storybook (visual, a11y, interaction)

```sh
pnpm storybook                 # browse Primitives/* and Patterns/* listed in contracts/ui-primitives-and-patterns.md
pnpm test:a11y
pnpm test:storybook            # runs WithInteraction stories
pnpm test:visual               # new baselines generated on the pinned Linux image
```

Expected: every story in "Stories that need visual baselines" renders in light and dark; no a11y
violations; `SearchSuggestionsPopover` `WithInteraction` walks chips → items with arrows, selects
with Enter, closes with Escape.

## 4. In the running app (required before reporting done — constitution "Quality Gates")

```sh
pnpm dev:navigator             # http://localhost:5173
```

Open an entity collection with the model above and check:

1. **All mode** (US1): type `a` → popover; top row shows text parameter chips with counts, exact
   ones with "?"; groups per prefix/full-text parameter with ≤ 10 values and a count in the
   header. Click a value → chip appears, list narrows, input clears, selector back to "All".
2. **Numbers** (US1): type `12` → integer and decimal chips first, text after; type `12.5` → no
   integer chip.
3. **Param mode** (US2): pick an integer parameter, type `abc`, Enter → inline error, no filter.
   Type `42`, Enter → chip. Pick an allowed-values parameter → client-filtered list, no loading
   flash. Pick "All except relations" → no relation chips/groups.
4. **Chips** (US3): set filters from the bar, a quick filter and the advanced dialog → all show
   as chips; a date range is one chip; close one → list updates at once. Add many filters → two
   lines, then horizontal scroll.
5. **Quick filters** (US4–US7): date preset "Last week" + Apply → blue outline + ×; × clears.
   Created/modified show their own icons. Boolean cycles grey → green → red → grey with true/false
   icons. Number: exact on top, Min/Max side by side, Apply/Clear. Allowed values: typing narrows
   the list instantly. Set a date filter in the advanced dialog → the date quick filter turns blue.
6. **State** (FR-032): copy the URL, open in a new tab → same chips, same quick-filter states,
   same results. Browser back restores the previous filters.
7. **Configuration** (US8): on the entity configuration page, untick an attribute under
   "Searchable attributes" → it disappears from selector, popover and quick filters; relation
   parameters stay; a URL filter on it still shows as a chip.
8. **Failure paths**: block the API in devtools while typing → per-group error with Retry,
   distinct from "No matches"; other groups unaffected.
9. **Keyboard only**: complete scenarios 1 and 3 without a mouse.
10. **Narrow viewport** (≈ 375 px): rows stay usable; chip and quick-filter rows scroll
    horizontally; date popover stacks calendar and presets.

If any step cannot be exercised in a session, say so explicitly in the PR rather than implying
end-to-end verification.
