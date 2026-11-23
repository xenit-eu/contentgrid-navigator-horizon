import { type ReactNode, useEffect, useState } from "react";
import type { ContentChanges, EntityItem } from "@contentgrid/navigator-data";
import { DeleteEntityItemButton } from "../../../entity-item-delete";
import { RightSidePanelLayout } from "../../../layout";
import { getContentAttributeMetadata } from "../../content-attribute-metadata";
import { withContentChange } from "../../edit/with-content-change";
import { EntityItemSections } from "../../entity-item-sections";
import { useEntityItemSectionProps } from "../../use-entity-item-section-props";
import type { EntityItemVariationProps } from "../entity-item-variation-props";
import { EntityItemReference } from "../item-reference/entity-item-reference";
import { ContentAttributeSelector } from "./components/content-attribute-selector";
import { ContentPreviewFrame } from "./components/content-preview-frame";
import { ContentPreviewPanel } from "./components/content-preview-panel";
import { FilePreview } from "./components/file-preview";
import { selectDefaultContentAttribute } from "./util/select-default-content-attribute";

/**
 * Content-focus item detail (spec `002-pdf-viewer`, contract `contracts/content-focus-view.md`)
 * for an already-loaded item: a preview of one of its content attributes, with the item's
 * attributes and relations in a side panel. It draws no toolbar, page layout or loading/error state
 * of its own. The preview and relations load their own follow-up data by following the item's
 * links. Renders nothing when the item's profile has no content attributes.
 */
export function EntityItemContentFocus({
  actions,
  onDeleted,
  ...props
}: Readonly<EntityItemVariationProps>) {
  const sectionProps = useEntityItemSectionProps(props);
  // The read-only copy when `allowEdit` is false: use it for everything shown below.
  const { item } = sectionProps;
  const { profileEntity } = item;
  // Delete hides while the edit form is open: deleting would navigate away from unsaved input.
  const showDelete = onDeleted !== undefined && sectionProps.editedItem === null;
  const headerActions = (actions || showDelete) && (
    <>
      {actions}
      {showDelete && (
        <DeleteEntityItemButton
          item={item}
          onDeleted={onDeleted}
          onRefresh={sectionProps.onRefresh}
        />
      )}
    </>
  );

  // `undefined` means "use the data-model default" (selectDefaultContentAttribute); reset
  // whenever the item identity changes — entity OR id, not just id (navigating e.g.
  // /document/1 -> /invoice/1 keeps the same id with a different profileEntity) — so an
  // explicit choice for one item never leaks into the next (FR-006).
  const [userSelectedAttribute, setUserSelectedAttribute] = useState<string | undefined>(undefined);
  useEffect(() => {
    setUserSelectedAttribute(undefined);
  }, [profileEntity.name, item.id]);

  // Defense in depth alongside the effect above: the effect only clears state AFTER the render
  // that already switched to the new profileEntity/id commits, so a stale
  // `userSelectedAttribute` from the previous entity can otherwise still reach
  // `useContentPreview` for one render — which throws synchronously (not just renders an error
  // state) for an attribute name that isn't a content attribute of the *current* item
  // (`use-content-preview.ts`'s `findContentAttribute`). Validating here means that render uses
  // the fresh default instead of crashing.
  const currentContentAttributeNames = new Set(
    profileEntity.userDefinedAttributes.filter((attr) => attr.isContent).map((attr) => attr.name),
  );
  const validUserSelectedAttribute =
    userSelectedAttribute !== undefined && currentContentAttributeNames.has(userSelectedAttribute)
      ? userSelectedAttribute
      : undefined;
  // `undefined` only when the profile has no content attributes.
  const attributeName =
    validUserSelectedAttribute ?? selectDefaultContentAttribute(profileEntity, item);

  if (attributeName === undefined) {
    return null;
  }

  return (
    <RightSidePanelLayout
      sidePanelTitle="Details"
      // Round-2 review: show which item this panel belongs to (icon, name, subtitle) instead of
      // a generic "Details" label — same reference row `EntityItemAttributeFocus` already shows
      // above its attributes/relations (`entity-item-attribute-focus.tsx`). `sm` to fit the panel's
      // compact header bar; `sidePanelTitle` above still supplies the accessible name for the
      // collapse/expand button.
      sidePanelHeader={
        <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
          <EntityItemReference item={item} size="sm" />
          {headerActions && (
            <div data-slot="item-actions" className="flex shrink-0 items-center gap-2">
              {headerActions}
            </div>
          )}
        </div>
      }
      sidePanelPadded={false}
      sidePanel={
        <EntityItemSections
          {...sectionProps}
          previewedAttributeName={attributeName}
          onPreview={setUserSelectedAttribute}
        />
      }
    >
      <ContentFocusPreview
        item={item}
        shownItem={sectionProps.editedItem ?? item}
        attributeName={attributeName}
        isEditing={sectionProps.editedItem !== null}
        pendingContent={sectionProps.pendingContent}
        onPendingContentChange={sectionProps.onPendingContentChange}
        isSaving={sectionProps.isSaving}
        attributeSelector={
          <ContentAttributeSelector
            entityItem={item}
            value={attributeName}
            onChange={setUserSelectedAttribute}
          />
        }
      />
    </RightSidePanelLayout>
  );
}

interface ContentFocusPreviewProps {
  /** The loaded item, whose stored file the preview shows. */
  readonly item: EntityItem;
  /** The version of the item the edit form was opened on (`item` when not editing). */
  readonly shownItem: EntityItem;
  readonly attributeName: string;
  readonly isEditing: boolean;
  /** The file changes made in the edit form and not saved yet. */
  readonly pendingContent: ContentChanges;
  readonly onPendingContentChange: (pendingContent: ContentChanges) => void;
  /** Whether the edit form is saving; the drop zone takes no file then. */
  readonly isSaving: boolean;
  readonly attributeSelector: ReactNode;
}

/**
 * The preview of one content attribute. While editing it shows the form's file: the picked file,
 * or, when there is no file (removed, or none stored), a drop zone that picks one into the form.
 * Nothing is uploaded before Save. Otherwise it shows the stored file.
 */
function ContentFocusPreview({
  item,
  shownItem,
  attributeName,
  isEditing,
  pendingContent,
  onPendingContentChange,
  isSaving,
  attributeSelector,
}: Readonly<ContentFocusPreviewProps>) {
  const fileChange = pendingContent.get(attributeName);
  if (fileChange?.file) {
    return <FilePreview file={fileChange.file} toolbarStart={attributeSelector} />;
  }

  const isRemoved = fileChange !== undefined;
  const hasStoredFile = Boolean(getContentAttributeMetadata(shownItem, attributeName));
  if (isEditing && (isRemoved || !hasStoredFile)) {
    const pickFile = (file: File | null) =>
      onPendingContentChange(withContentChange(pendingContent, shownItem, attributeName, file));
    return (
      <ContentPreviewFrame
        state="noFile"
        fill
        onFileChange={shownItem.canUploadContent(attributeName) && !isSaving ? pickFile : undefined}
        toolbarStart={attributeSelector}
      />
    );
  }

  return (
    <ContentPreviewPanel
      entityItem={item}
      attributeName={attributeName}
      toolbarStart={attributeSelector}
    />
  );
}
