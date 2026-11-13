import { useId, useState } from "react";
import { FileTextIcon, InfoIcon, XIcon } from "@phosphor-icons/react";
import { type EntityItem, useLoadedProfileEntities } from "@contentgrid/navigator-data";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  ToolbarIconButton,
  TooltipProvider,
} from "@contentgrid/ui";
import {
  ContentAttributeSelector,
  ContentPreviewPanel,
  EntityItemAttributes,
  EntityItemReference,
  EntityItemRelations,
  selectDefaultContentAttribute,
} from "../entity-item";

const DETAILS_CLASS_NAME =
  "scrollbar-subtle absolute inset-0 space-y-6 overflow-auto bg-background p-4";

export interface EntityItemPreviewPaneProps {
  readonly entityItem: EntityItem;
  readonly onClose: () => void;
}

/**
 * Side pane for the row clicked in a collection: the item's content preview, with its attributes
 * and relations shown over it on request. An entity without content attributes shows only those.
 *
 * The preview stays mounted while the details cover it, so a PDF stays on the page it was on.
 * The chosen content attribute and whether the details are shown carry over to the next row.
 * The pane is a region named after the item, so a screen reader can tell which item it shows.
 * Uploading and changing relations are left to the item's own page.
 */
export function EntityItemPreviewPane({
  entityItem,
  onClose,
}: Readonly<EntityItemPreviewPaneProps>) {
  const profile = entityItem.profileEntity;
  const { profiles: loadedProfiles } = useLoadedProfileEntities();
  const [chosenAttributeName, setChosenAttributeName] = useState<string>();
  const [showDetails, setShowDetails] = useState(false);
  const referenceId = useId();

  // Every row of a collection has the same content attributes, so a chosen name always fits the next row.
  const attributeName = profile.hasContentAttributes
    ? (chosenAttributeName ?? selectDefaultContentAttribute(profile, entityItem))
    : undefined;
  const hasPreview = attributeName !== undefined;

  const details = (
    <>
      <EntityItemAttributes item={entityItem} />
      <EntityItemRelations item={entityItem} profiles={loadedProfiles} allowEdit={false} />
    </>
  );

  return (
    <TooltipProvider>
      <Tabs
        value={showDetails ? "details" : "preview"}
        onValueChange={(value) => setShowDetails(value === "details")}
        className="h-full min-h-0 gap-0 overflow-hidden rounded-lg border"
        role="region"
        aria-labelledby={referenceId}
      >
        <div className="flex items-center justify-between gap-2 border-b px-2 py-1.5">
          <div id={referenceId} className="min-w-0 flex-1">
            <EntityItemReference item={entityItem} size="sm" />
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {hasPreview && (
              <TabsList className="border dark:border-transparent" aria-label="View">
                <TabsTrigger value="preview">
                  <FileTextIcon aria-hidden />
                  Preview
                </TabsTrigger>
                <TabsTrigger value="details">
                  <InfoIcon aria-hidden />
                  Details
                </TabsTrigger>
              </TabsList>
            )}
            <ToolbarIconButton label="Close" onClick={onClose}>
              <XIcon aria-hidden />
            </ToolbarIconButton>
          </div>
        </div>

        <div className="relative min-h-0 flex-1">
          {hasPreview ? (
            <>
              {/* Covered, not unmounted, while the details are shown. */}
              <TabsContent value="preview" forceMount className="h-full" inert={showDetails}>
                <ContentPreviewPanel
                  entityItem={entityItem}
                  attributeName={attributeName}
                  allowUpload={false}
                  toolbarStart={
                    <ContentAttributeSelector
                      entityItem={entityItem}
                      value={attributeName}
                      onChange={setChosenAttributeName}
                    />
                  }
                />
              </TabsContent>
              <TabsContent value="details" className={DETAILS_CLASS_NAME}>
                {details}
              </TabsContent>
            </>
          ) : (
            <div className={DETAILS_CLASS_NAME}>{details}</div>
          )}
        </div>
      </Tabs>
    </TooltipProvider>
  );
}
