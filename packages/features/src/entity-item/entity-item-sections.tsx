import { type ReactNode, useLayoutEffect, useRef, useState } from "react";
import { ClockCounterClockwiseIcon, ListBulletsIcon } from "@phosphor-icons/react";
import type { EntityItem, ProfileEntity } from "@contentgrid/navigator-data";
import { RelationAccordion, ResizableSplitLayout } from "@contentgrid/ui";
import { EditableEntityItemAttributes } from "./attributes/editable-entity-item-attributes";
import { EntityItemAuditTrail, hasAuditTrail } from "./attributes/entity-item-attributes";
import { EditEntityItemButton } from "./edit/edit-entity-item-button";
import type {
  RelationItemClickHandler,
  RelationItemCreateHandler,
  RelationProblemHandlers,
} from "./relations/relation-handlers";
import { RelationToManySection } from "./relations/relation-to-many-section";
import { RelationToOneSection } from "./relations/relation-to-one-section";

const ATTRIBUTES_SECTION = "attributes";
const AUDIT_SECTION = "audit";
/** Narrower than this (in pixels), the `"columns"` layout keeps a single column. */
const COLUMNS_MIN_WIDTH = 720;

export interface EntityItemSectionsState {
  /** Open state for a section, keyed by `"attributes"`, `"audit"` or a relation's name. */
  readonly openProps: (
    section: string,
    defaultOpen: boolean,
  ) => { open: boolean; onOpenChange: (open: boolean) => void };
  /** Registers a section's element, so `reveal` can scroll to it. */
  readonly sectionRef: (section: string) => (element: HTMLElement | null) => void;
  /** Expands a section and scrolls it into view — e.g. from `EntityItemRelationSummary`. */
  readonly reveal: (section: string) => void;
}

/**
 * Open/closed state for {@link EntityItemSections}, kept by the caller so something outside the
 * sections (the relation summary under the item's title) can expand and scroll to one of them.
 */
export function useEntityItemSectionsState(): EntityItemSectionsState {
  // Only sections the user has toggled are stored; the rest use their default.
  const [toggled, setToggled] = useState<ReadonlyMap<string, boolean>>(new Map());
  const elements = useRef(new Map<string, HTMLElement>());

  function setOpen(section: string, open: boolean) {
    setToggled((prev) => new Map(prev).set(section, open));
  }

  return {
    openProps: (section, defaultOpen) => ({
      open: toggled.get(section) ?? defaultOpen,
      onOpenChange: (open) => setOpen(section, open),
    }),
    sectionRef: (section) => (element) => {
      if (element) elements.current.set(section, element);
      else elements.current.delete(section);
    },
    reveal: (section) => {
      setOpen(section, true);
      requestAnimationFrame(() =>
        elements.current.get(section)?.scrollIntoView?.({ behavior: "smooth", block: "start" }),
      );
    },
  };
}

export type EntityItemSectionsProps = RelationProblemHandlers & {
  readonly item: EntityItem;
  readonly profiles: readonly ProfileEntity[];
  readonly state: EntityItemSectionsState;
  /** The version the update form was opened on; `null` when not editing (see `useEditContext`). */
  readonly editedItem: EntityItem | null;
  readonly onEditingChange: (isEditing: boolean) => void;
  /** Reloads the item after a version conflict and moves the form onto it. */
  readonly onRefresh: () => void;
  readonly onRelationItemClick?: RelationItemClickHandler;
  readonly onRelationItemCreateNew?: RelationItemCreateHandler;
  /**
   * `"stacked"` (default) lists every section in one column. `"columns"` puts the relations in a
   * second, resizable column next to the attributes and audit trail, when the sections are at
   * least `COLUMNS_MIN_WIDTH` wide; narrower, and for an item without relations, it keeps the
   * single column.
   */
  readonly layout?: "stacked" | "columns";
};

/**
 * The item's attributes, each of its relations and its audit trail as collapsible rows, meant to
 * sit edge to edge inside one surrounding card or panel. Attributes, to-one relations and the
 * audit trail start expanded, to-many relations collapsed.
 */
export function EntityItemSections({
  item,
  profiles,
  state,
  editedItem,
  onEditingChange,
  onRefresh,
  onRelationItemClick,
  onRelationItemCreateNew,
  onMissingRelationTargetClick,
  onBlindRelationOverwriteClick,
  onRequiredRelationClick,
  layout = "stacked",
}: Readonly<EntityItemSectionsProps>) {
  const attributesOpen = state.openProps(ATTRIBUTES_SECTION, true);
  const attributes = (
    <RelationAccordion
      title={
        <span className="inline-flex items-center gap-2">
          <ListBulletsIcon className="size-4 text-muted-foreground" aria-hidden />
          Attributes
        </span>
      }
      variant="row"
      actions={
        <EditEntityItemButton
          item={item}
          isEditing={editedItem !== null}
          onEdit={() => {
            // The form opens inside this section, so make sure it is expanded.
            attributesOpen.onOpenChange(true);
            onEditingChange(true);
          }}
        />
      }
      {...attributesOpen}
    >
      <EditableEntityItemAttributes
        item={editedItem ?? item}
        isEditing={editedItem !== null}
        onEditingChange={onEditingChange}
        onRefresh={onRefresh}
        auditTrail={false}
      />
    </RelationAccordion>
  );
  const relations = (
    <>
      {item.toOneRelations.map((rel) => (
        <section key={rel.name} ref={state.sectionRef(rel.name)} className="scroll-mt-4">
          <RelationToOneSection
            relation={rel}
            profiles={profiles}
            variant="row"
            {...state.openProps(rel.name, true)}
            onItemClick={onRelationItemClick}
            onCreateNew={onRelationItemCreateNew}
            onMissingRelationTargetClick={onMissingRelationTargetClick}
            onBlindRelationOverwriteClick={onBlindRelationOverwriteClick}
          />
        </section>
      ))}
      {item.toManyRelations.map((rel) => (
        <section key={rel.name} ref={state.sectionRef(rel.name)} className="scroll-mt-4">
          <RelationToManySection
            relation={rel}
            profiles={profiles}
            variant="row"
            {...state.openProps(rel.name, false)}
            onItemClick={onRelationItemClick}
            onCreateNew={onRelationItemCreateNew}
            onMissingRelationTargetClick={onMissingRelationTargetClick}
            onRequiredRelationClick={onRequiredRelationClick}
            onBlindRelationOverwriteClick={onBlindRelationOverwriteClick}
          />
        </section>
      ))}
    </>
  );
  const audit = hasAuditTrail(item) && (
    <RelationAccordion
      title={
        <span className="inline-flex items-center gap-2">
          <ClockCounterClockwiseIcon className="size-4 text-muted-foreground" aria-hidden />
          Audit
        </span>
      }
      variant="row"
      {...state.openProps(AUDIT_SECTION, true)}
    >
      <EntityItemAuditTrail item={item} />
    </RelationAccordion>
  );

  const hasRelations = item.toOneRelations.length > 0 || item.toManyRelations.length > 0;
  if (layout === "columns" && hasRelations) {
    return (
      <EntityItemSectionColumns
        left={
          <>
            {attributes}
            {audit}
          </>
        }
        right={relations}
      />
    );
  }
  return (
    <div>
      {attributes}
      {relations}
      {audit}
    </div>
  );
}

/**
 * `left` and `right` side by side with a drag handle between them, or `left` above `right` when
 * there is too little room. The split layout's own stacked mode isn't used: it splits a fixed
 * height, while these sections grow with their content. Crossing the width threshold remounts
 * the sections.
 */
function EntityItemSectionColumns({
  left,
  right,
}: Readonly<{ left: ReactNode; right: ReactNode }>) {
  const [element, setElement] = useState<HTMLDivElement | null>(null);
  const [width, setWidth] = useState<number | undefined>(undefined);
  useLayoutEffect(() => {
    if (!element) return;
    const measure = () => setWidth(element.getBoundingClientRect().width);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [element]);

  // Renders nothing until measured (before the first paint), so it never shows the wrong layout.
  let content: ReactNode = null;
  if (width !== undefined && width >= COLUMNS_MIN_WIDTH) {
    content = (
      <ResizableSplitLayout
        left={left}
        right={right}
        minLeftSize={320}
        minRightSize={320}
        handleLabel="Resize relations"
      />
    );
  } else if (width !== undefined) {
    content = (
      <>
        {left}
        {right}
      </>
    );
  }
  return <div ref={setElement}>{content}</div>;
}
