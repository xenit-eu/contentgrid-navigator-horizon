import { type ReactNode, useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NavigatorDataProvider } from "@contentgrid/navigator-data";
import type { TypedFetch } from "@contentgrid/navigator-data";
import {
  RecordingNavigationProvider,
  createRecordingNavigation,
} from "../navigation/recording-navigation";
import { createCollectionFixtureFetch } from "../test-fixtures/collection";
import { PROFILE_URL } from "../test-fixtures/item-detail";
import { EntityItemCollectionView } from "./entity-item-collection-view";

type FixtureOptions = Parameters<typeof createCollectionFixtureFetch>[0];

/**
 * Mounts the view on the collection fixture (empty unless `fixtureOptions` says otherwise) in a
 * fixed-size box (ADR-009): the view fills the box and never sizes itself to the window. The
 * view's loading pages are `aria-busy`, so the visual harness's `async-content` wait covers the
 * profile and collection fetches.
 */
function CollectionStoryHarness({
  children,
  fixtureOptions = { empty: true },
}: Readonly<{ children: ReactNode; fixtureOptions?: FixtureOptions }>) {
  const [fixture] = useState(() => createCollectionFixtureFetch(fixtureOptions));
  const [queryClient] = useState(() => new QueryClient());
  const [recording] = useState(() => createRecordingNavigation());
  const apiFetch = fixture.fetch as unknown as TypedFetch;
  const contentFetch = Object.assign(apiFetch, { withUploadProgress: () => apiFetch });

  return (
    <div className="overflow-hidden rounded-md border" style={{ width: 960, height: 560 }}>
      <QueryClientProvider client={queryClient}>
        <NavigatorDataProvider
          apiFetch={apiFetch}
          contentFetch={contentFetch}
          profileUrl={PROFILE_URL}
        >
          <RecordingNavigationProvider recording={recording}>
            {children}
          </RecordingNavigationProvider>
        </NavigatorDataProvider>
      </QueryClientProvider>
    </div>
  );
}

const meta = {
  title: "Views/EntityItemCollectionView",
  component: EntityItemCollectionView,
  tags: ["autodocs", "async-content"],
  parameters: { layout: "centered" },
  render: (args) => (
    <CollectionStoryHarness>
      <EntityItemCollectionView {...args} />
    </CollectionStoryHarness>
  ),
} satisfies Meta<typeof EntityItemCollectionView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  args: { entityName: "customer" },
};

/** Renders the view on a collection with items; the title shows the entity name and its count. */
export const Titled: Story = {
  args: { entityName: "customer" },
  render: (args) => (
    <CollectionStoryHarness
      fixtureOptions={{ unfilteredPage: { size: 2, total_items_exact: 1284 } }}
    >
      <EntityItemCollectionView {...args} />
    </CollectionStoryHarness>
  ),
};

/** A filter is active: the filtered count in the pill and the unfiltered total under the title. */
export const Filtered: Story = {
  args: {
    entityName: "customer",
    state: { filters: { "name~prefix": "acme" } },
    onStateChange: () => {},
  },
  render: (args) => (
    <CollectionStoryHarness
      fixtureOptions={{
        unfilteredPage: { size: 2, total_items_exact: 1284 },
        filteredPage: { size: 2, total_items_exact: 37 },
      }}
    >
      <EntityItemCollectionView {...args} />
    </CollectionStoryHarness>
  ),
};

/** The API only estimates the total: the pill and the "Filtered from" line say "about". */
export const EstimatedCount: Story = {
  args: Filtered.args,
  render: (args) => (
    <CollectionStoryHarness
      fixtureOptions={{
        unfilteredPage: { size: 2, total_items_estimate: 1204 },
        filteredPage: { size: 2, total_items_estimate: 40 },
      }}
    >
      <EntityItemCollectionView {...args} />
    </CollectionStoryHarness>
  ),
};
