import type { Meta, StoryObj } from "@storybook/react";
import { OverviewStoryHarness } from "../test-fixtures/overview-story-harness";
import { EntityConfigurationOverviewView } from "./entity-configuration-overview-view";

/**
 * The Settings page on four entities, one with a long title; each card sums up its display
 * settings as Defaults.
 */
const meta = {
  title: "Views/EntityConfigurationOverviewView",
  component: EntityConfigurationOverviewView,
  tags: ["autodocs", "async-content"],
  parameters: { layout: "centered" },
  render: () => (
    <OverviewStoryHarness>
      <EntityConfigurationOverviewView />
    </OverviewStoryHarness>
  ),
} satisfies Meta<typeof EntityConfigurationOverviewView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
