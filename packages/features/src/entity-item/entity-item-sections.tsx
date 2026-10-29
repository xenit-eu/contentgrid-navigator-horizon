import { type ReactNode, useLayoutEffect, useRef, useState } from "react";
import { ClockCounterClockwiseIcon, ListBulletsIcon } from "@phosphor-icons/react";
import type { EntityItem, ProfileEntity } from "@contentgrid/navigator-data";
import { RelationAccordion, ResizableSplitLayout } from "@contentgrid/ui";
import { EditableEntityItemAttributes } from "./attributes/editable-entity-item-attributes";
import { EntityItemAuditTrail, hasAuditTrail } from "./attributes/entity-item-attributes";
import { CancelEditEntityItemButton, EditEntityItemButton } from "./edit/edit-entity-item-button";
import type { EditEntityItemFormHandle } from "./edit/edit-entity-item-container";
import type {
  RelationItemClickHandler,
  RelationItemCreateHandler,
  RelationProblemHandlers,
} from "./relations/relation-handlers";
import { RelationToManySection } from "./relations/relation-to-many-section";
import { RelationToOneSection } from "./relations/relation-to-one-section";

const ATTRIBUTES_SECTION = "attributes";
const AUDIT_SECTION = "audit";
/** Relation names are customer-defined, so their keys are prefixed to never match a built-in one. */
const relationSection = (relationName: string) => `relation:${relationName}`;
/** Narrower than this (in pixels), the `"columns"` layout keeps a single column. */
const COLUMNS_MIN_WIDTH = 720;

export interface EntityItemSectionsState {
  /** Open state for a section, keyed by `"attributes"`, `"audit"` or `relationSection(name)`. */
  readonly openProps: (
    section: string,
    defaultOpen: boolean,
  ) => { open: boolean; onOpenChange: (open: boolean) => void };
  /** Registers a section's element, so `reveal` can scroll to it. */
  readonly sectionRef: (section: string) => (element: HTMLElement | null) => void;
  /** Expands a relation's section and scrolls it into view — e.g. from `EntityItemRelationSummary`. */
  readonly revealRelation: (relationName: string) => void;
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
    revealRelation: (relationName) => {
      const section = relationSection(relationName);
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
  const isEditing = editedItem !== null;
  const editFormRef = useRef<EditEntityItemFormHandle>(null);
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
        isEditing ? (
          <CancelEditEntityItemButton onCancel={() => editFormRef.current?.cancel()} />
        ) : (
          <EditEntityItemButton
            item={item}
            isEditing={false}
            onEdit={() => {
              // The form opens inside this section, so make sure it is expanded.
              attributesOpen.onOpenChange(true);
              onEditingChange(true);
            }}
          />
        )
      }
      open={attributesOpen.open}
      // Collapsing would unmount the update form and drop its unsaved values, so the section
      // stays open while editing.
      onOpenChange={(open) => {
        if (open || !isEditing) attributesOpen.onOpenChange(open);
      }}
    >
      <EditableEntityItemAttributes
        item={editedItem ?? item}
        isEditing={isEditing}
        onEditingChange={onEditingChange}
        onRefresh={onRefresh}
        auditTrail={false}
        editFormRef={editFormRef}
      />
    </RelationAccordion>
  );
  const relations = (
    <>
      {item.toOneRelations.map((rel) => (
        <section
          key={rel.name}
          ref={state.sectionRef(relationSection(rel.name))}
          className="scroll-mt-4"
        >
          <RelationToOneSection
            relation={rel}
            profiles={profiles}
            variant="row"
            {...state.openProps(relationSection(rel.name), true)}
            onItemClick={onRelationItemClick}
            onCreateNew={onRelationItemCreateNew}
            onMissingRelationTargetClick={onMissingRelationTargetClick}
            onBlindRelationOverwriteClick={onBlindRelationOverwriteClick}
          />
        </section>
      ))}
      {item.toManyRelations.map((rel) => (
        <section
          key={rel.name}
          ref={state.sectionRef(relationSection(rel.name))}
          className="scroll-mt-4"
        >
          <RelationToManySection
            relation={rel}
            profiles={profiles}
            variant="row"
            {...state.openProps(relationSection(rel.name), false)}
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
        keepLayout={isEditing}
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
 * the sections, so while `keepLayout` is set (an open update form, whose unsaved values would be
 * lost) the current layout stays until it is cleared.
 */
function EntityItemSectionColumns({
  left,
  right,
  keepLayout,
}: Readonly<{ left: ReactNode; right: ReactNode; keepLayout: boolean }>) {
  const [element, setElement] = useState<HTMLDivElement | null>(null);
  const [wide, setWide] = useState<boolean | undefined>(undefined);
  useLayoutEffect(() => {
    if (!element) return;
    const measure = () => {
      const fits = element.getBoundingClientRect().width >= COLUMNS_MIN_WIDTH;
      setWide((current) => (keepLayout && current !== undefined ? current : fits));
    };
    measure();
    if (keepLayout) return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [element, keepLayout]);

  // Renders nothing until measured (before the first paint), so it never shows the wrong layout.
  let content: ReactNode = null;
  if (wide) {
    content = (
      <ResizableSplitLayout
        left={left}
        right={right}
        minLeftSize={320}
        minRightSize={320}
        handleLabel="Resize relations"
      />
    );
  } else if (wide === false) {
    content = (
      <>
        {left}
        {right}
      </>
    );
  }
  return <div ref={setElement}>{content}</div>;
}
