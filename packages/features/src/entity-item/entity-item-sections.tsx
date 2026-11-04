import { useRef } from "react";
import { ClockCounterClockwiseIcon, ListBulletsIcon } from "@phosphor-icons/react";
import type { EntityItem, ProfileEntity } from "@contentgrid/navigator-data";
import { RelationAccordion } from "@contentgrid/ui";
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
import { type EntityItemSectionsState, relationSection } from "./use-entity-item-context";

const ATTRIBUTES_SECTION = "attributes";
const AUDIT_SECTION = "audit";
export type EntityItemSectionsProps = RelationProblemHandlers & {
  readonly item: EntityItem;
  readonly profiles: readonly ProfileEntity[];
  /** The sections' open state: `useEntityItemContext`'s `sections`. */
  readonly state: EntityItemSectionsState;
  /**
   * The version the update form was opened on; `null` when not editing (see
   * `useEntityItemContext`'s `editedItem`).
   */
  readonly editedItem: EntityItem | null;
  readonly onEditingChange: (isEditing: boolean) => void;
  /** Reloads the item after a version conflict and moves the form onto it. */
  readonly onRefresh: () => void;
  readonly onRelationItemClick?: RelationItemClickHandler;
  readonly onRelationItemCreateNew?: RelationItemCreateHandler;
  /**
   * Whether to show the edit button in the Attributes header (default `true`). The button still
   * only shows when the item has an update template.
   */
  readonly allowEdit?: boolean;
  /**
   * Which sections to render: `"all"` (default) lists attributes, relations and audit trail in
   * one column; `"details"` only the attributes and audit trail, and `"relations"` only the
   * relations — for a layout that shows the relations apart, e.g. in a side panel.
   */
  readonly show?: "all" | "details" | "relations";
  /**
   * `"row"` (default) renders each relation as a full-width row inside the surrounding card;
   * `"card"` as a card of its own, spaced apart — for relations shown outside that card.
   */
  readonly relationVariant?: "row" | "card";
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
  show = "all",
  relationVariant = "row",
  allowEdit = true,
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
          allowEdit && (
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
            variant={relationVariant}
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
            variant={relationVariant}
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

  if (show === "details") {
    return (
      <div>
        {attributes}
        {audit}
      </div>
    );
  }
  if (show === "relations") {
    return <div className={relationVariant === "card" ? "space-y-4" : undefined}>{relations}</div>;
  }
  return (
    <div>
      {attributes}
      {relations}
      {audit}
    </div>
  );
}

/** Whether the item has any relation, i.e. whether `show="relations"` renders anything. */
export function hasEntityItemRelations(item: EntityItem): boolean {
  return item.toOneRelations.length > 0 || item.toManyRelations.length > 0;
}
