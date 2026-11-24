import { type ReactNode, useState } from "react";
import { CircleNotchIcon as CircleNotch } from "@phosphor-icons/react";
import {
  EntityCreateFormPreview,
  EntityDisplaySettingsForm,
  useColumnVisibility,
} from "@contentgrid/features/preferences";
import { ProblemAlert } from "@contentgrid/features/problem-details";
import {
  type ProfileEntity,
  toProblemDisplayModel,
  useEntityItemCollection,
} from "@contentgrid/navigator-data";
import { Alert, AlertDescription, TabLink, TabbedLayout } from "@contentgrid/ui";
import { EntityItemCollectionView } from "../entity-item-collection";
import { EntityItemDetailView } from "../entity-item-detail";

const PREVIEW_TABS = [
  { key: "item", label: "Item Preview" },
  { key: "collection", label: "Collection Preview" },
  { key: "create", label: "Create Form" },
] as const;

type PreviewTab = (typeof PREVIEW_TABS)[number]["key"];

/**
 * One entity's configuration: preview tabs on the left, the display settings
 * (`EntityDisplaySettingsForm`) on the right — stacked in a narrow container. The item and
 * collection previews are the real item detail and collection views, without their
 * toolbar, so a setting shows exactly as it will on those pages. Drawn inside the
 * configuration detail page's card.
 */
export function EntityConfigurationPanel({ profile }: Readonly<{ profile: ProfileEntity }>) {
  const [activeTab, setActiveTab] = useState<PreviewTab>("item");

  return (
    // Wide: previews and settings side by side, filling the height they are given — the preview
    // stretches to it, the settings scroll in their column. Narrow: stacked, the preview a fixed
    // height and the whole panel scrolling in its parent.
    <div className="@container h-full min-h-0">
      <div className="flex flex-col gap-6 @3xl:h-full @3xl:flex-row">
        <div className="flex min-w-0 flex-1 flex-col @3xl:min-h-0">
          <TabbedLayout
            className="flex-1 @3xl:min-h-0 [&>[data-slot=tab-content]]:min-h-0"
            tabs={PREVIEW_TABS.map((tab) => ({ ...tab, active: tab.key === activeTab }))}
            renderTabLink={(tab, label) => (
              <TabLink
                key={tab.key}
                href="#"
                active={tab.active}
                onClick={(event) => {
                  event.preventDefault();
                  setActiveTab(tab.key as PreviewTab);
                }}
              >
                {label}
              </TabLink>
            )}
          >
            {activeTab === "item" && <ItemPreview profile={profile} />}
            {activeTab === "collection" && <CollectionPreview profile={profile} />}
            {activeTab === "create" && <EntityCreateFormPreview profile={profile} />}
          </TabbedLayout>
        </div>

        <div className="bg-border hidden w-px self-stretch @3xl:block" aria-hidden />

        <div className="@3xl:min-h-0 @3xl:w-72 @3xl:shrink-0 @3xl:overflow-y-auto">
          <EntityDisplaySettingsForm profile={profile} />
        </div>
      </div>
    </div>
  );
}

/**
 * A bordered box for a whole page: the embedded view fills it and scrolls inside it, the way it
 * would fill the app's content area. It takes the panel's remaining height when previews and
 * settings sit side by side, and a fixed height when they are stacked.
 */
function PreviewFrame({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <div
      data-slot="configuration-preview"
      className="h-[32rem] overflow-hidden rounded-lg border bg-background @3xl:h-full @3xl:min-h-80"
    >
      {children}
    </div>
  );
}

/**
 * The collection page. Its Columns choice is seeded from "Visible columns" once, when it mounts,
 * so the preview remounts whenever that setting changes.
 */
function CollectionPreview({ profile }: Readonly<{ profile: ProfileEntity }>) {
  const { visibleColumns } = useColumnVisibility(profile);
  return (
    <PreviewFrame>
      <EntityItemCollectionView
        key={visibleColumns.join(",")}
        entityName={profile.name}
        toolbar={false}
      />
    </PreviewFrame>
  );
}

/** The item detail page of the entity's first item, or why there is none to show. */
function ItemPreview({ profile }: Readonly<{ profile: ProfileEntity }>) {
  const collection = useEntityItemCollection({ profileEntity: profile });

  if (collection.isPending) {
    return (
      <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
        <CircleNotch className="size-4 animate-spin" aria-hidden />
        Loading preview…
      </div>
    );
  }
  if (collection.isError) {
    return <ProblemAlert model={toProblemDisplayModel(collection.error)} />;
  }
  const firstItem = collection.data.items[0];
  if (!firstItem) {
    return (
      <Alert>
        <AlertDescription>
          Please create a {profile.singularName} item to enable the preview
        </AlertDescription>
      </Alert>
    );
  }
  return (
    <PreviewFrame>
      <EntityItemDetailView
        entityName={profile.name}
        itemId={firstItem.id}
        toolbar={false}
        allowEdit={false}
      />
    </PreviewFrame>
  );
}
