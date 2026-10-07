import type { Meta, StoryObj } from "@storybook/react";
import { SearchSuggestionsPopover } from "./search-suggestions-popover";
import {
  PopoverHarness,
  numberChips,
  readyGroups,
  textChips,
} from "./search-suggestions-popover.story-helpers";

const meta = {
  title: "Patterns/SearchSuggestionsPopover",
  component: SearchSuggestionsPopover,
  tags: ["autodocs"],
} satisfies Meta<typeof SearchSuggestionsPopover>;

export default meta;
type Story = StoryObj<typeof meta>;

const baseArgs = {
  open: true,
  onOpenChange: () => undefined,
  chips: [],
  groups: [],
  onSelectChip: () => undefined,
  onSelectItem: () => undefined,
  renderAnchor: () => null,
};

export const Default: Story = {
  args: baseArgs,
  render: () => <PopoverHarness chips={textChips} groups={readyGroups} />,
};

export const UnknownCounts: Story = {
  args: baseArgs,
  render: () => (
    <PopoverHarness
      chips={textChips.map((chip) => ({ ...chip, count: { count: null } }))}
      groups={[]}
    />
  ),
};

export const Loading: Story = {
  args: baseArgs,
  render: () => (
    <PopoverHarness
      chips={textChips.map((chip) => ({ ...chip, count: { count: null, isLoading: true } }))}
      groups={readyGroups.map((group) => ({
        ...group,
        status: "loading" as const,
        count: { count: null, isLoading: true },
      }))}
    />
  ),
};

export const NoMatches: Story = {
  args: baseArgs,
  render: () => (
    <PopoverHarness
      chips={textChips}
      groups={readyGroups.map((group) => ({
        ...group,
        status: "empty" as const,
        count: { count: 0 },
        items: [],
      }))}
    />
  ),
};

export const GroupError: Story = {
  args: baseArgs,
  render: () => (
    <PopoverHarness
      chips={textChips}
      groups={[
        {
          ...readyGroups[0]!,
          status: "error",
          items: [],
          count: { count: null },
          onRetry: () => undefined,
        },
        ...readyGroups.slice(1),
      ]}
    />
  ),
};

export const NumbersFirst: Story = {
  args: baseArgs,
  render: () => <PopoverHarness chips={numberChips} groups={[]} initialValue="12" />,
};
