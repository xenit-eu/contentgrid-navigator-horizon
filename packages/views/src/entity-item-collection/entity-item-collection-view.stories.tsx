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

/**
 * Mounts the view on an empty collection in a fixed-size box (ADR-009): the view fills the box
 * and never sizes itself to the window. The view's loading pages are `aria-busy`, so the visual
 * harness's `async-content` wait covers the profile and collection fetches.
 */
function EmptyCollectionStoryHarness({ children }: Readonly<{ children: ReactNode }>) {
  const [fixture] = useState(() => createCollectionFixtureFetch({ empty: true }));
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
    <EmptyCollectionStoryHarness>
      <EntityItemCollectionView {...args} />
    </EmptyCollectionStoryHarness>
  ),
} satisfies Meta<typeof EntityItemCollectionView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  args: { entityName: "customer" },
};
