import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { ProfileSelector } from "./profile-selector";

const meta = {
  title: "Patterns/ProfileSelector",
  component: ProfileSelector,
  tags: ["autodocs"],
} satisfies Meta<typeof ProfileSelector>;

export default meta;
type Story = StoryObj<typeof meta>;

const PROFILES = [
  { name: "invoice", title: "Invoice" },
  { name: "customer", title: "Customer" },
  { name: "supplier", title: "Supplier" },
];

// ProfileSelector returns null for a single profile — nothing to snapshot.
export const SingleProfile: Story = {
  tags: ["no-visual-test"],
  args: {
    profiles: [{ name: "invoice", title: "Invoice" }],
    onSelect: fn(),
  },
};

export const TwoProfiles: Story = {
  args: {
    profiles: PROFILES.slice(0, 2),
    selectedProfile: PROFILES[0],
    onSelect: fn(),
  },
};

export const ManyProfiles: Story = {
  args: {
    profiles: PROFILES,
    selectedProfile: PROFILES[1],
    onSelect: fn(),
  },
};

export const NoSelection: Story = {
  args: {
    profiles: PROFILES,
    onSelect: fn(),
  },
};

// Demonstrates the create-entity-page usage where a "Entity" label precedes the selector.
export const WithLabel: Story = {
  args: {
    profiles: PROFILES,
    selectedProfile: undefined,
    onSelect: fn(),
    label: "Entity",
  },
};
