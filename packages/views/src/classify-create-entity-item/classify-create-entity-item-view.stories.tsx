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
import { ClassifyCreateEntityItemView } from "./classify-create-entity-item-view";

/**
 * Mounts the view on the collection fixture, whose `customer` entity has a create form, in a
 * fixed-size box (ADR-009). The panel's loading page is `aria-busy`, so the visual harness's
 * `async-content` wait covers the profile fetches.
 */
function ClassifyCreateStoryHarness({ children }: Readonly<{ children: ReactNode }>) {
  const [fixture] = useState(() => createCollectionFixtureFetch({ creatable: true }));
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
  title: "Views/ClassifyCreateEntityItemView",
  component: ClassifyCreateEntityItemView,
  tags: ["autodocs", "async-content"],
  parameters: { layout: "centered" },
  render: () => (
    <ClassifyCreateStoryHarness>
      <ClassifyCreateEntityItemView />
    </ClassifyCreateStoryHarness>
  ),
} satisfies Meta<typeof ClassifyCreateEntityItemView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
