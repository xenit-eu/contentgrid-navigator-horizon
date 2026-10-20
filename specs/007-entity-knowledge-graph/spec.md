# Feature Specification: Entity Knowledge Graph

**Feature Branch**: `graph-vis`

**Created**: 2026-09-30

**Status**: Draft

**Input**: User description: "I want to build a knowledge graph visualisation tool that will visualize all the different entities in the contentgrid application. the graph should be traversable and display the relations between entities. the graph starts out at a main entity. each entity is identified by its id, which is unique over the different entity types. when clicked i want to see the related items of a certain item . the nodes in the graph should adhere to the user preference color of that profileEntity. The different relations are displayed aswell. for a one to one relation there is only one target , for to many targets there can be unlimited. I want the first 10 displayed and it should be clear to the user that there are more (also from the estimated count) the more remaining resulting items should be inspectable. When clicking a relation a pop up menu should allow me to break or unlink the relation. clicking an entity itself should display itsdetails on the other side of the screen next to the graph. think about the different context and make sure that relations are named in the process. navigating to a related entity should then show the relations of the related item and still keep the old context in view. but keep the total nodes comprehendable"

## Overview

The knowledge graph gives a user a visual, traversable view of how the items in their
ContentGrid application connect to each other. It always starts from one **root item** (the
"main entity"), shows that item's relations as named edges to related items, and lets the user
walk outward one item at a time. The view is split in two: the graph on one side and a
**details panel** on the other showing the item currently selected in the graph.

Like the rest of Navigator, the graph knows nothing about any specific data model: which
entity types exist, which relations they have, their cardinality, and what the current user is
allowed to do are all discovered at runtime from the application's profile and from each item.

## Terminology

- **Node** — one entity item drawn in the graph. A node is identified by the item's `id`, which
  is unique across all entity types, so the same item is always the same node, however many
  paths lead to it.
- **Edge** — one relation link between two nodes, labelled with the relation's name.
- **Focus item** — the item whose relations are currently expanded. At the start the root item
  is the focus item.
- **Overflow node** — a single placeholder node that stands in for the related items of a
  to-many relation that are not drawn individually ("+ N more").
- **Trail** — the ordered path of focus items the user has visited, starting at the root item.
- **Node action menu** — a small pop-up anchored to a clicked node offering the actions available
  for that item (view, explore, delete).
- **Edge menu** — a small pop-up anchored to a clicked edge offering the actions available for
  that relation link (select either end, remove link).

## Clarifications

### Session 2026-09-30

- Q: When the node limit would be exceeded, how is older context reduced? → A: The last 2 focus
  items (the current one and the one before it) stay fully expanded; anything older collapses to
  trail-only (the trail item and the edge along the trail stay visible, its other relations are
  hidden).
- Q: What do "break" and "unlink" mean? → A: One and the same action, "Remove link": for a
  to-one relation it clears the relation, for a to-many relation it removes only this one target.
  Neither item is ever deleted by it.
- Q: (added by the user) Nodes also get an action pop-up with view and delete functions.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - See an item and its direct relations as a graph (Priority: P1)

A user viewing an item (for example an invoice) opens it in the knowledge graph. The invoice
appears as the central node. Every relation the invoice has is shown as a named edge leading to
the related item(s): a to-one relation leads to its single target (e.g. `supplier`), a to-many
relation leads to up to 10 of its targets (e.g. `products`). Each node is drawn in the colour
the user has configured for that item's entity type, and carries the item's display name.

**Why this priority**: This is the core value — seeing at a glance how one item connects to the
rest of the data. Every other story builds on it.

**Independent Test**: Open the graph for an item that has at least one to-one and one to-many
relation; verify the root node, one edge per relation labelled with its name, the related
nodes, and node colours matching the entity-type preferences.

**Acceptance Scenarios**:

1. **Given** an item with a to-one relation `supplier` that is set, **When** the graph opens on
   that item, **Then** exactly one edge labelled `supplier` connects the root node to the
   supplier's node.
2. **Given** an item with a to-one relation that is empty, **When** the graph opens, **Then**
   no edge or target node is drawn for that relation, and the relation is still listed as
   "not set" in the details panel.
3. **Given** an item whose to-many relation `products` has 4 targets, **When** the graph opens,
   **Then** 4 product nodes are drawn, each connected by an edge labelled `products`, and no
   overflow node is shown.
4. **Given** the user has configured the colour "green" for entity type `supplier`, **When** a
   supplier node is drawn, **Then** it uses green; an entity type without a user preference
   uses its default display colour.
5. **Given** two different relations of the root item point at the same item, **When** the
   graph is drawn, **Then** that item appears as one node with two separately labelled edges.

---

### User Story 2 - Inspect an item's details next to the graph (Priority: P1)

Clicking a node selects it, shows that item's details (its attributes and relations, the way
the item detail view shows them) in the panel beside the graph without changing what the graph
shows, and opens the node action menu next to the node. The menu offers **View** (open the item's
full detail page), **Explore relations** (story 3) and **Delete** (story 6), each only when it
applies.

**Why this priority**: A graph of names alone is not enough to understand the data; the user
needs to read the item without losing their place in the graph.

**Independent Test**: Click any node other than the focus item; verify the details panel shows
that item's attributes and the graph layout is unchanged.

**Acceptance Scenarios**:

1. **Given** the graph is open, **When** the user clicks a node, **Then** the node is visibly
   marked as selected and the details panel shows that item's details.
2. **Given** a node is selected, **When** the user clicks another node, **Then** the details
   panel switches to the newly clicked item.
3. **Given** the details panel shows an item, **When** the user wants to open the item on its
   own page, **Then** a link to that item's regular detail page is available in the panel.
4. **Given** the user clicks a node, **When** the node action menu opens, **Then** it offers
   "View" and "Explore relations", plus "Delete" only when the user may delete that item.
5. **Given** the node action menu is open, **When** the user chooses "View", **Then** the item's
   regular detail page opens.
6. **Given** the node action menu is open, **When** the user clicks elsewhere or presses Escape,
   **Then** the menu closes and the item stays selected in the details panel.

---

### User Story 3 - Traverse to a related item while keeping context (Priority: P1)

From a selected node, the user chooses to explore it. That item becomes the new focus item: its
own relations are expanded and drawn around it, while the path that led here (the previous focus
items and the edges between them) remains visible so the user can see where they came from. The
user can step back to any earlier item in the trail.

**Why this priority**: "Traversable" is the defining characteristic of the feature; without it
the graph is a static diagram of one item.

**Independent Test**: From the root, explore a related node; verify that node's relations are
now drawn, the root and the connecting edge are still visible, and a trail shows
"root → explored item" with a way to return to the root.

**Acceptance Scenarios**:

1. **Given** the root item is focused, **When** the user explores related item B, **Then** B's
   relations are drawn around B, the root node and the named edge between root and B stay
   visible, and the trail reads root → B.
2. **Given** the trail is root → B → C, **When** the user selects B in the trail, **Then** B
   becomes the focus item again and the view returns to B's expanded relations.
3. **Given** item C (being expanded) is related to an item already visible in the graph,
   **When** C's relations are drawn, **Then** the existing node is reused and an additional
   named edge is drawn to it — no duplicate node appears.
4. **Given** the trail is root → B → C and C is the focus item, **When** the graph is drawn,
   **Then** C's and B's relations are fully expanded, while the root is shown only as a trail
   item with its edge to B (the root's other relations are hidden).
5. **Given** the trail is root → B → C, **When** the user returns to the root, **Then** the
   root's relations are expanded again (the root and nothing older are now the last 2 focus
   items).
6. **Given** the two expanded focus items together would still exceed 50 nodes, **When** the
   graph is drawn, **Then** the previous focus item's relations are collapsed first, and the
   current focus item always keeps its expansion (each to-many relation is capped at 10 anyway).

---

### User Story 4 - See and browse the rest of a large to-many relation (Priority: P2)

When a to-many relation has more than 10 targets, the graph draws the first 10 and adds an
overflow node reading, for example, "+ 1 240 more (estimated)". Clicking the overflow node opens
a paged list of all targets of that relation in the details panel, from which the user can open
any target's details or bring a specific target into the graph.

**Why this priority**: Large to-many relations are common; without this, the user either sees
an unreadable graph or silently misses data. It builds on story 1 and can ship after it.

**Independent Test**: Open the graph on an item with a to-many relation of more than 10
targets; verify 10 target nodes, one overflow node showing the remaining count (marked as
estimated when the count is an estimate), and that clicking it lists all targets.

**Acceptance Scenarios**:

1. **Given** a to-many relation with 25 targets (exact count), **When** it is drawn, **Then** 10
   target nodes and one overflow node reading "+ 15 more" are shown.
2. **Given** a to-many relation whose total is only an estimate of about 1 250, **When** it is
   drawn, **Then** the overflow node reads "+ ~1 240 more" (or equivalent wording) and is marked
   as estimated.
3. **Given** the overflow node of relation `products`, **When** the user clicks it, **Then** the
   details panel shows a paged list of the relation's targets titled with the relation name and
   the total count, and the user can load further pages.
4. **Given** the overflow list is open, **When** the user chooses "show in graph" on one listed
   target, **Then** that target is added to the graph as a node connected by the relation's
   edge, and the overflow count drops by one.
5. **Given** the overflow list is open, **When** the user clicks a listed target, **Then** its
   details are shown in the details panel.

---

### User Story 5 - Remove a relation link from the graph (Priority: P2)

Clicking an edge opens a small menu for that relation link naming the relation and both ends
(e.g. "invoice INV-001 — supplier → ACME"). From it the user can remove the link: for a to-one
relation the relation is cleared; for a to-many relation only this one target is removed from
the relation. The related items themselves are not deleted. After confirming, the edge (and any
node that is no longer connected to anything visible) disappears.

**Why this priority**: Editing relations in context is a strong productivity gain, but the graph
is valuable read-only first.

**Independent Test**: On an item where the user may change a relation, click an edge, remove the
link, confirm, and verify the edge disappears and the item's detail view no longer lists that
target.

**Acceptance Scenarios**:

1. **Given** the user is allowed to clear a to-one relation, **When** they click its edge,
   **Then** the menu offers "Remove link" naming the relation and both items.
2. **Given** the menu is open, **When** the user chooses "Remove link" and confirms, **Then** the
   link is removed, the edge disappears, and a confirmation message is shown.
3. **Given** the user is not allowed to change that relation, **When** they click the edge,
   **Then** the menu shows the relation information but no removal option.
4. **Given** removal is rejected by the server (e.g. a required relation, a conflict, a changed
   item, or lack of permission), **When** the result arrives, **Then** the edge stays in place and
   the user sees an explanation of why the link could not be removed.
5. **Given** the user dismisses the confirmation, **When** the menu closes, **Then** nothing is
   changed.
6. **Given** the edge menu is open, **When** the user wants more than removal, **Then** the menu
   also offers to select either end item (showing its details).

---

### User Story 6 - Delete an item from the graph (Priority: P2)

From the node action menu the user can delete the item itself. After confirming, the item is
deleted in the application, and its node and all its edges disappear from the graph.

**Why this priority**: Lets users clean up data they discover while exploring, without leaving
the graph. Destructive, so it comes after the read-only stories.

**Independent Test**: On an item the user may delete, open the node action menu, choose Delete,
confirm, and verify the node and its edges disappear and the item no longer exists.

**Acceptance Scenarios**:

1. **Given** the user may delete an item, **When** they choose "Delete" in its node action menu,
   **Then** a confirmation names the item and its entity type and states that this deletes the
   item permanently (not just the link).
2. **Given** the user confirms, **When** deletion succeeds, **Then** the node and all its edges
   are removed, overflow counts it was part of drop by one, a confirmation message is shown, and
   nodes that are no longer connected to the trail or focus item are removed.
3. **Given** the user may not delete an item, **When** the node action menu opens, **Then** no
   Delete option is shown.
4. **Given** deletion is refused because another item requires a relation to it (or for any
   other reason), **When** the result arrives, **Then** the node stays in place and the user sees
   the reason.
5. **Given** the deleted item was the current focus item, **When** deletion succeeds, **Then**
   the focus moves back to the previous item in the trail.
6. **Given** the deleted item was the root item, **When** deletion succeeds, **Then** the graph
   shows a "this item was deleted" state with a way back to the collection of its entity type.

---

### User Story 7 - Start the graph from any item (Priority: P3)

The user can open the knowledge graph from an item's regular detail view, and can share or
reload a graph that starts at a given item.

**Why this priority**: Entry point convenience; the graph can be tested via a direct address
before this is added.

**Independent Test**: From an item's detail view choose "Open in graph"; verify the graph opens
with that item as root. Reload the page; verify the same root is shown.

**Acceptance Scenarios**:

1. **Given** the user is on an item's detail view, **When** they choose "Open in graph", **Then**
   the graph opens with that item as the root item.
2. **Given** a graph address for a root item, **When** the page is reloaded or shared, **Then**
   the graph opens on the same root item (and, where possible, the same focus item).

---

### Edge Cases

- **Item without relations**: the root node is shown alone with a clear "this item has no
  relations" message; the details panel still works.
- **Root item not found or not permitted**: a not-found / no-access state is shown instead of
  an empty graph.
- **Related item not readable by the current user**: to-many listings silently omit items the
  user cannot see (so counts may be lower than expected); a to-one target the user cannot read is
  shown as an "unavailable item" node rather than breaking the graph.
- **Cycles**: A → B → A is drawn as two nodes with their edges; exploring back to A reuses A's
  node and does not loop.
- **Self-relation**: an item related to itself is drawn as a labelled loop on its own node.
- **Same pair, several relations**: each relation is its own labelled edge; labels must stay
  readable and not overlap into illegibility.
- **Relation defined on both sides**: when two relations of different entity types describe the
  same link from each side, each is drawn under its own name only when it is discovered from the
  item being expanded (no inferred inverse edges).
- **Very long display names / relation names**: truncated in the graph, shown in full on hover
  and in the details panel.
- **Slow or failed loading of one relation**: that relation shows a loading or error indicator
  on its edge group; other relations are unaffected and a retry is offered.
- **Data changed elsewhere while the graph is open**: after a removal or when the user
  re-focuses an item, that item's relations reflect the current server state.
- **Entity type without a colour preference**: falls back to the default entity display colour.
- **Colour preference changed while the graph is open**: nodes of that entity type update.
- **Overflow list shrinks** (items removed elsewhere, or permissions differ): the list and count
  reflect what the server returns; the count never goes negative.

## Requirements _(mandatory)_

### Functional Requirements

**Graph content**

- **FR-001**: The system MUST open the graph on exactly one root item, identified by its entity
  type and item id.
- **FR-002**: The system MUST represent each distinct item as exactly one node, keyed by the
  item's `id`, regardless of how many relations or paths lead to it.
- **FR-003**: For the focus item, the system MUST draw one edge per related target for every
  relation the item exposes, discovered from the application's profile and the item itself — no
  entity type, relation name, or cardinality may be assumed in advance.
- **FR-004**: Every edge MUST carry the name of the relation it represents (using the relation's
  display name when the model provides one), visible in the graph and in the edge menu.
- **FR-005**: Edges MUST indicate direction (from the item that owns the relation to the target).
- **FR-006**: For a to-one relation the system MUST draw at most one target; an empty to-one
  relation MUST NOT produce a node.
- **FR-007**: For a to-many relation the system MUST draw at most the first 10 targets as
  individual nodes.
- **FR-008**: When a to-many relation has more targets than are drawn, the system MUST show one
  overflow node for that relation displaying the number of remaining targets, and MUST mark that
  number as estimated when the server only provides an estimate.
- **FR-009**: Each node MUST be drawn in the colour the user has set for its entity type in their
  display preferences (falling back to the default display colour), and MUST show the item's
  display name and the entity type it belongs to (e.g. via icon or label).

**Selection and details**

- **FR-010**: Clicking a node MUST select it and show that item's details in a panel beside the
  graph, without altering the graph's layout.
- **FR-011**: The details panel MUST offer a way to open the selected item's regular detail page.
- **FR-011a**: Clicking a node MUST also open a node action menu anchored to that node offering
  "View" (open the item's regular detail page), "Explore relations" (FR-012, omitted when the item
  is already the focus item) and "Delete" (FR-029). The menu MUST close on Escape or a click
  elsewhere without changing the selection.

**Traversal and context**

- **FR-012**: The user MUST be able to make any visible item the focus item ("explore"), after
  which that item's relations are drawn following FR-003–FR-008.
- **FR-013**: When the focus moves, the previous focus items and the edges connecting them along
  the trail MUST remain visible.
- **FR-014**: The system MUST show the trail of visited focus items and let the user return to
  any earlier item in it in one action.
- **FR-015**: The system MUST keep the graph comprehensible by limiting the number of visible
  nodes to at most 50 at any moment. Only the last 2 focus items in the trail (the current focus
  item and the one before it) are shown fully expanded; every older trail item collapses to
  trail-only — its node and the edge along the trail remain visible, its other relations are
  hidden. If the two expanded items together would still exceed the limit, the previous focus
  item's relations are collapsed first; the current focus item always keeps its expansion.
- **FR-016**: Items brought into the graph individually from an overflow list (FR-019) MUST
  remain visible while their owning relation is expanded, and count toward the node limit.

**Overflow inspection**

- **FR-017**: Clicking an overflow node MUST show, in the details panel, a paged list of all
  targets of that relation, titled with the relation name, the owning item, and the total count
  (marked as estimated where applicable).
- **FR-018**: The overflow list MUST support loading further pages until all targets have been
  listed.
- **FR-019**: From the overflow list the user MUST be able to (a) show a target's details and
  (b) add a specific target to the graph as a node connected by that relation's edge.

**Relation editing**

- **FR-020**: Clicking an edge MUST open a menu identifying the relation name, its source item,
  and its target item, with options to select either end.
- **FR-021**: The edge menu MUST offer a single "Remove link" action (covering both "break" and
  "unlink"): for a to-one relation it clears the relation; for a to-many relation it removes only
  this one target from the relation. It MUST be offered only when the current user is permitted
  to change that relation on the source item, as indicated by the item itself; otherwise no
  removal option is shown.
- **FR-022**: Removing a link MUST require explicit confirmation naming the relation and both
  items, and MUST never delete either item.
- **FR-023**: After a successful removal the system MUST remove the edge, remove any node that is
  no longer connected to the trail or focus item, update the overflow count if applicable, and
  refresh any detail information that shows the relation.
- **FR-024**: When removal fails the system MUST leave the graph unchanged and show the reason in
  user-understandable terms (e.g. required relation, the item was changed by someone else, no
  permission).

**Item deletion**

- **FR-029**: The node action menu MUST offer "Delete" only when the current user is permitted to
  delete that item, as indicated by the item itself.
- **FR-030**: Deleting MUST require explicit confirmation naming the item and its entity type and
  stating that the item itself (not just a link) is permanently deleted.
- **FR-031**: After a successful deletion the system MUST remove the node and all its edges,
  decrease any overflow count that included it, remove nodes no longer connected to the trail or
  focus item, and remove the item from the trail. If it was the focus item, focus MUST move to the
  previous trail item; if it was the root item, the system MUST show a "deleted" state with a way
  back to its entity type's collection.
- **FR-032**: When deletion fails (e.g. another item requires a relation to it, the item was
  changed by someone else, no permission) the system MUST leave the graph unchanged and show the
  reason in user-understandable terms.

**Entry and state**

- **FR-025**: The item detail view MUST offer an "Open in graph" action that opens the graph with
  that item as root.
- **FR-026**: The graph's root item (and the current focus item) MUST be reflected in the page
  address so that reloading or sharing the address reopens the same view.
- **FR-027**: While a relation's targets are loading or have failed to load, the graph MUST
  indicate this for that relation specifically and offer a retry on failure, without blocking the
  rest of the graph.

**Accessibility**

- **FR-028**: All graph actions (select node, open the node action menu and its actions, open
  overflow list, open edge menu, return along the trail) MUST also be reachable via keyboard and exposed to assistive technology — for
  example through an accessible list of the focus item's relations and targets alongside the
  visual graph.

### Key Entities

- **Graph root**: the item the graph was opened on; fixed for the lifetime of a graph view.
- **Graph node**: a visible item — its id, entity type, display name, and display colour; or an
  overflow placeholder for one relation of one item with its remaining count and whether that
  count is estimated.
- **Graph edge**: a visible link — source item, target item (or overflow placeholder), relation
  name, relation cardinality, and whether the current user may remove it.
- **Trail**: the ordered list of focus items visited since the root, each with the relation
  through which it was reached.
- **Relation expansion**: for one item and one relation, the targets loaded so far, the total
  target count (exact or estimated), the targets pinned into the graph from the overflow list,
  and its loading/error state.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: For an item with up to 10 relations, the graph with all direct relations drawn
  appears within 2 seconds on a typical connection.
- **SC-002**: The graph never shows more than 50 nodes at once, including after 10 consecutive
  explore steps.
- **SC-003**: In usability testing, at least 90% of users can correctly name the relation between
  two connected nodes and say from which item they reached the current focus item, without
  guidance.
- **SC-004**: In usability testing, at least 90% of users correctly identify that a to-many
  relation has more targets than shown and roughly how many, and can open the full list within
  2 clicks.
- **SC-005**: A user can remove a relation link from the graph in at most 3 interactions (click
  edge, choose remove, confirm), and the graph reflects the change within 1 second of the server
  confirming it.
- **SC-005a**: A user can delete an item from the graph in at most 3 interactions (click node,
  choose Delete, confirm).
- **SC-006**: 100% of removal and delete options shown in the edge and node action menus correspond to operations the server
  permits for the current user (no offered action that is refused for lack of permission, apart
  from conditions that only the server can evaluate after the change).
- **SC-007**: Node colours match the user's entity-type colour preferences for 100% of nodes.
- **SC-008**: The graph works for any application's data model without model-specific
  configuration — verified against at least two differently-shaped demo models.

## Assumptions

- The feature lives in Navigator and uses the existing entity display preferences (colour, icon,
  display name attribute); it does not introduce new preference settings.
- Relations are shown only in the direction they are exposed by the item being expanded; the
  graph does not infer or query inverse relations the item does not expose.
- "Related items of a certain item" means direct relations only (one hop per explore step); the
  graph never automatically expands more than the current focus item.
- The first 10 targets of a to-many relation are the first 10 in the order the server returns
  them; the user cannot re-sort them within the graph.
- The details panel reuses the content of the existing item detail view (attributes and
  relations); editing attributes from the panel is out of scope for this feature.
- Creating new relation links, or creating new items, from within the graph is out of scope.
- Deleting items is limited to the single item chosen in the node action menu; bulk deletion and
  deleting all targets of a relation are out of scope.
- A click on a node does both things at once: it shows the item's details in the side panel (the
  original requirement) and opens the node action menu. "View" in that menu opens the item's
  full detail page, not the side panel (which already shows the item).
- Graph layout (node positions) is not persisted between sessions; only root and focus item are
  kept in the address.
- The node limit of 50 and the per-relation display limit of 10 are fixed for this version.
- Standard permissions apply: what a user can see and change in the graph is exactly what they
  could see and change elsewhere in Navigator.
- Mobile/narrow screens are supported by stacking the details panel below or over the graph; a
  touch-optimised graph interaction is not a goal for this version.
