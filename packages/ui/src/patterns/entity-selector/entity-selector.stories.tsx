import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { EntitySelector } from "./entity-selector";

const meta = {
  title: "Patterns/EntitySelector",
  component: EntitySelector,
  tags: ["autodocs"],
} satisfies Meta<typeof EntitySelector>;

export default meta;
type Story = StoryObj<typeof meta>;

const ENTITIES = [
  { name: "invoice", title: "Invoice" },
  { name: "customer", title: "Customer" },
  { name: "supplier", title: "Supplier" },
];

// EntitySelector returns null for a single entity — nothing to snapshot.
export const SingleEntity: Story = {
  tags: ["no-visual-test"],
  args: {
    entities: [{ name: "invoice", title: "Invoice" }],
    onSelect: fn(),
  },
};

export const TwoEntities: Story = {
  args: {
    entities: ENTITIES.slice(0, 2),
    selectedEntity: ENTITIES[0],
    onSelect: fn(),
  },
};

export const ManyEntities: Story = {
  args: {
    entities: ENTITIES,
    selectedEntity: ENTITIES[1],
    onSelect: fn(),
  },
};

export const NoSelection: Story = {
  args: {
    entities: ENTITIES,
    onSelect: fn(),
  },
};

// Demonstrates the create-entity-page usage where a "Entity" label precedes the selector.
export const WithLabel: Story = {
  args: {
    entities: ENTITIES,
    selectedEntity: undefined,
    onSelect: fn(),
    label: "Entity",
  },
};
