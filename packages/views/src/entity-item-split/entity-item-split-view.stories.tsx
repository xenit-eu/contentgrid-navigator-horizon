import { type ReactNode, useEffect, useState } from "react";
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
import { EntityItemSplitView } from "./entity-item-split-view";
import { preloadEntityItemSplit } from "./preload";

const entityName = "customer";

/**
 * Preloads the profile (and the selected item), then mounts the view in a fixed-size box
 * (ADR-009): the view fills the box and never sizes itself to the window. `aria-busy` covers the
 * preload, so the visual harness's `async-content` wait has no gap between the empty root and the
 * view.
 */
function SplitStoryHarness({
  itemId,
  children,
}: Readonly<{ itemId?: string; children: ReactNode }>) {
  const [fixture] = useState(() => createCollectionFixtureFetch());
  const [queryClient] = useState(() => new QueryClient());
  const [recording] = useState(() => createRecordingNavigation());
  const [ready, setReady] = useState(false);
  const apiFetch = fixture.fetch as unknown as TypedFetch;
  const contentFetch = Object.assign(apiFetch, { withUploadProgress: () => apiFetch });

  useEffect(() => {
    void preloadEntityItemSplit(
      { queryClient, apiFetch, profileUrl: PROFILE_URL },
      entityName,
      itemId,
    ).then(() => setReady(true));
  }, [queryClient, apiFetch, itemId]);

  return (
    <div
      aria-busy={!ready}
      className="overflow-hidden rounded-md border"
      style={{ width: 1200, height: 560 }}
    >
      {ready && (
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
      )}
    </div>
  );
}

const meta = {
  title: "Views/EntityItemSplitView",
  component: EntityItemSplitView,
  tags: ["autodocs", "async-content"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "A list next to the detail of the selected item. Selecting a row changes state, not the route. " +
          "Open question 2 (two panes, one URL) is still open, so there is no route yet: a delete or edit in the " +
          "detail pane and the toolbar's Collection crumb go through the parent's navigation and leave the split.",
      },
    },
  },
  render: (args) => (
    <SplitStoryHarness itemId={args.state?.selectedItemId}>
      <EntityItemSplitView {...args} />
    </SplitStoryHarness>
  ),
} satisfies Meta<typeof EntityItemSplitView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { entityName },
};

export const ItemSelected: Story = {
  args: { entityName, state: { selectedItemId: "cust-001" } },
};

export const ToolbarHidden: Story = {
  args: { entityName, toolbar: false, state: { selectedItemId: "cust-001" } },
};
