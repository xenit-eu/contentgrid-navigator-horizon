import type { Meta, StoryObj } from "@storybook/react";
import { expect, fireEvent, fn, within } from "storybook/test";
import { SearchSuggestionsPopover } from "./search-suggestions-popover";

const meta = {
  title: "Patterns/SearchSuggestionsPopover",
  component: SearchSuggestionsPopover,
  tags: ["autodocs"],
} satisfies Meta<typeof SearchSuggestionsPopover>;

export default meta;
type Story = StoryObj<typeof meta>;

const baseArgs = {
  query: "",
  onQueryChange: fn(),
  onSelectSearchTermSuggestion: fn(),
  onSelectEffectiveMatch: fn(),
  placeholder: "Search…",
};

export const Empty: Story = {
  args: {
    ...baseArgs,
    searchTermSuggestions: [],
    effectiveMatches: [],
  },
};

export const SearchTermSuggestionsOnly: Story = {
  args: {
    ...baseArgs,
    query: "ac",
    searchTermSuggestions: [
      { propertyName: "title~prefix", value: "Acme Corp", attributeLabel: "Title" },
      { propertyName: "title~prefix", value: "Acme Industries", attributeLabel: "Title" },
    ],
    effectiveMatches: [],
  },
};

export const RelationTraversalSuggestion: Story = {
  args: {
    ...baseArgs,
    query: "ac",
    searchTermSuggestions: [
      {
        propertyName: "vendor.name~prefix",
        value: "Acme Supplies",
        attributeLabel: "Name",
        relationLabel: "Vendor",
      },
    ],
    effectiveMatches: [],
  },
};

export const WithSortOptions: Story = {
  args: {
    ...baseArgs,
    query: "",
    searchTermSuggestions: [],
    effectiveMatches: [],
    sortOptions: [
      { value: "name,asc", label: "Name A→Z" },
      { value: "name,desc", label: "Name Z→A" },
      { value: "created,desc", label: "Newest first" },
    ],
    currentSort: "name,asc",
    onSortChange: fn(),
  },
};

export const WithDateShortcuts: Story = {
  args: {
    ...baseArgs,
    query: "",
    searchTermSuggestions: [],
    effectiveMatches: [],
    dateShortcuts: [
      { attributeGroupKey: "created_date", label: "Created" },
      { attributeGroupKey: "due_date", label: "Due" },
    ],
    onApplyDateRange: fn(),
    onClearDateRange: fn(),
  },
};

export const WithEffectiveMatches: Story = {
  args: {
    ...baseArgs,
    query: "ac",
    searchTermSuggestions: [
      { propertyName: "title~prefix", value: "Acme Corp", attributeLabel: "Title" },
    ],
    effectiveMatches: [
      { id: "1", content: "Acme Corp Invoice #1024" },
      { id: "2", content: "Acme Corp Invoice #1031" },
    ],
  },
};

export const Loading: Story = {
  args: {
    ...baseArgs,
    query: "ac",
    searchTermSuggestions: [],
    effectiveMatches: [],
    isLoading: true,
  },
};

export const RequestFailed: Story = {
  args: {
    ...baseArgs,
    query: "ac",
    searchTermSuggestions: [],
    effectiveMatches: [],
    isError: true,
    onRetry: fn(),
  },
};

export const NoMatches: Story = {
  args: {
    ...baseArgs,
    query: "zzz",
    searchTermSuggestions: [],
    effectiveMatches: [],
  },
};

export const TypingCallsOnQueryChange: Story = {
  args: {
    ...baseArgs,
    searchTermSuggestions: [],
    effectiveMatches: [],
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole("combobox");
    await fireEvent.change(input, { target: { value: "ac" } });
    await expect(args.onQueryChange).toHaveBeenCalledWith("ac");
  },
  tags: ["no-visual-test"],
};
