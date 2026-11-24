import type { Meta, StoryObj } from "@storybook/react";
import { OverviewStoryHarness } from "../test-fixtures/overview-story-harness";
import { EntityOverviewView } from "./entity-overview-view";

/**
 * The Home page on four entities: a long title, a long description and an entity without a
 * description share the first row; the counts show a single item, an estimate and zero.
 */
const meta = {
  title: "Views/EntityOverviewView",
  component: EntityOverviewView,
  tags: ["autodocs", "async-content"],
  parameters: { layout: "centered" },
  render: () => (
    <OverviewStoryHarness>
      <EntityOverviewView />
    </OverviewStoryHarness>
  ),
} satisfies Meta<typeof EntityOverviewView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
