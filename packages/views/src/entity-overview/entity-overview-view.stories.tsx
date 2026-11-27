import type { Meta, StoryObj } from "@storybook/react";
import { OverviewStoryHarness } from "../test-fixtures/overview-story-harness";
import { EntityOverviewView } from "./entity-overview-view";

/**
 * The Home page on four entities: a long title, a long description and an entity without a
 * description share the first row; the counts show a single item, an estimate and zero. The other
 * stories show the page while the profile loads, when it lists no entities, and when it fails.
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

export const Loading: Story = {
  render: () => (
    <OverviewStoryHarness profileState="loading">
      <EntityOverviewView />
    </OverviewStoryHarness>
  ),
};

export const NoEntities: Story = {
  render: () => (
    <OverviewStoryHarness profileState="empty">
      <EntityOverviewView />
    </OverviewStoryHarness>
  ),
};

export const FailedToLoad: Story = {
  render: () => (
    <OverviewStoryHarness profileState="failed">
      <EntityOverviewView />
    </OverviewStoryHarness>
  ),
};
