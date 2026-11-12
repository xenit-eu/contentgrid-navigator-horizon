import { useRef, useState } from "react";
import type { EntityItem } from "@contentgrid/navigator-data";

/** Reloads the item; the view that owns the item query supplies it. */
export type EntityItemRefetch = () => Promise<{
  readonly data?: EntityItem;
  readonly isSuccess: boolean;
}>;

/** For a caller that cannot reload the item: a refresh then leaves everything as it is. */
export const noRefetch: EntityItemRefetch = async () => ({ isSuccess: false });

/**
 * The open-state key of a relation's section. Relation names are customer-defined, so their keys
 * are prefixed to never match a built-in one (`"attributes"`, `"audit"`).
 */
export const relationSection = (relationName: string) => `relation:${relationName}`;

/** Open/closed state of the item's collapsible sections (`EntityItemSections`). */
export interface EntityItemSectionsState {
  /** Open state for a section, keyed by `"attributes"`, `"audit"` or `relationSection(name)`. */
  readonly openProps: (
    section: string,
    defaultOpen: boolean,
  ) => { open: boolean; onOpenChange: (open: boolean) => void };
  /** Registers a section's element, so `revealRelation` can scroll to it. */
  readonly sectionRef: (section: string) => (element: HTMLElement | null) => void;
  /** Expands a relation's section and scrolls it into view — e.g. from `EntityItemRelationSummary`. */
  readonly revealRelation: (relationName: string) => void;
  /** Forgets every toggle, so each section is back at its default (`defaultOpen`). */
  readonly restoreDefaults: () => void;
}

function useEntityItemSectionsState(): EntityItemSectionsState {
  // Only sections the user has toggled are stored; the rest use their default.
  const [toggled, setToggled] = useState<ReadonlyMap<string, boolean>>(new Map());
  const elements = useRef(new Map<string, HTMLElement>());
  const refs = useRef(new Map<string, (element: HTMLElement | null) => void>());

  function setOpen(section: string, open: boolean) {
    setToggled((prev) => new Map(prev).set(section, open));
  }

  return {
    openProps: (section, defaultOpen) => ({
      open: toggled.get(section) ?? defaultOpen,
      onOpenChange: (open) => setOpen(section, open),
    }),
    sectionRef: (section) => {
      // One stable callback per section, so React doesn't detach and re-attach it every render.
      let ref = refs.current.get(section);
      if (!ref) {
        ref = (element) => {
          if (element) elements.current.set(section, element);
          else elements.current.delete(section);
        };
        refs.current.set(section, ref);
      }
      return ref;
    },
    revealRelation: (relationName) => {
      const section = relationSection(relationName);
      setOpen(section, true);
      requestAnimationFrame(() =>
        elements.current.get(section)?.scrollIntoView?.({ behavior: "smooth", block: "start" }),
      );
    },
    restoreDefaults: () => setToggled(new Map()),
  };
}

/**
 * Everything a variation needs about the shown `item`: the item itself, the `refetch` that reloads
 * it, its edit mode and the open state of its sections.
 *
 * While editing, `editedItem` is the version the form was opened on: a background refetch does not
 * change it, so the user's input stays and a save of an item that changed meanwhile is refused
 * (412). `shownItem` is that version while editing and `item` otherwise. `refresh` refetches the
 * item and moves the form onto the latest version. Edit mode belongs to one item, so it ends when
 * the page moves on to another item and stays closed when the page comes back to it. The sections
 * go back to their defaults on another item too.
 *
 * `sections` is the open/closed state for `EntityItemSections`, kept here so something outside
 * the sections (the relation summary under the item's title) can expand and scroll to one of them.
 */
export function useEntityItemContext(item: EntityItem, refetch: EntityItemRefetch = noRefetch) {
  const href = item.selfLink.href;
  const [editedItem, setEditedItem] = useState<EntityItem | null>(null);
  const [shownHref, setShownHref] = useState(href);
  const sections = useEntityItemSectionsState();
  if (href !== shownHref) {
    setShownHref(href);
    setEditedItem(null);
    // A toggle is for the item it was made on: every item starts with its sections at their
    // defaults, whether or not the page stayed mounted in between (e.g. a cached item).
    sections.restoreDefaults();
  }

  const setIsEditing = (isEditing: boolean) => setEditedItem(isEditing ? item : null);
  const refresh = async () => {
    const result = await refetch();
    if (result.isSuccess && result.data) setEditedItem(result.data);
  };

  return {
    item,
    shownItem: editedItem ?? item,
    refetch,
    isEditing: editedItem !== null,
    editedItem,
    setIsEditing,
    refresh,
    sections,
  };
}
