# Contract: ViewTarget and target resolution

**Requirements**: FR-007, FR-008, FR-009, FR-010, FR-011
**Packages**: type in `packages/views`; resolution helpers in `packages/navigator-data` (PR 3)

## Type

See [data-model.md](../data-model.md#viewtarget). One type covers both ways to open a view: by name (from our own routes) and by link (from the chat backend).

## Resolution

The data layer exposes helpers that turn a `ViewTarget` into loaded objects, for use in a view and in its preload.

- **Name target**: the profile entity is loaded by `entityName`; an item, if `itemId` is given, is loaded through `profileEntity.itemUrl(id)`.
- **Link target**: the response at `href` is fetched; its profile is found by
  1. following the profile link in the response;
  2. if there is none, looking through the profiles and finding the one whose `describes` link covers the resource.
- If neither yields a profile, resolution fails with a not-found outcome. The entity name is never taken from the link text, and no part of a link is parsed (constitution Principle I).
- The result is the same shape for both forms (see `ResolvedViewTarget`). The view does not branch on the input kind.

## Caching

- Loaded items are cached under the item's own self link.
- An item opened by name and by link therefore shares one cache entry and one request.
- A helper used by `preload` and a hook used by the view read and write the same keys, so a preload fills what the view later reads.

## Errors

- Unknown entity name, or no profile for a link: not-found outcome, shown through the shared gate (FR-006).
- A link that is not an entity item or collection: not-supported outcome.
- Network and problem responses surface as the existing problem-detail errors, narrowed with the provided guards.

## Non-goals

- Frontend addresses are not accepted as targets.
- Filters inside a link are not read back out (open question 5).
