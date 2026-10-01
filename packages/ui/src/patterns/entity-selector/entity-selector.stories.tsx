import { BuildingsIcon, FileTextIcon, SignatureIcon } from "@phosphor-icons/react";
import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { ProfileEntitySelector, ProfileEntitySelectorList } from "./entity-selector";

const meta = {
  title: "Patterns/ProfileEntitySelector",
  component: ProfileEntitySelector,
  tags: ["autodocs"],
} satisfies Meta<typeof ProfileEntitySelector>;

export default meta;
type Story = StoryObj<typeof meta>;

const ENTITIES = [
  { name: "invoice", title: "Invoice" },
  { name: "customer", title: "Customer" },
  { name: "supplier", title: "Supplier" },
];

export const SingleEntity: Story = {
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

export const WithLabel: Story = {
  args: {
    entities: ENTITIES,
    selectedEntity: undefined,
    onSelect: fn(),
    label: "Entity",
  },
};

const ENTITIES_WITH_DETAILS = [
  {
    name: "invoice",
    title: "Invoice",
    description: "A supplier invoice with line items and content.",
    icon: <FileTextIcon className="size-4" aria-hidden />,
  },
  {
    name: "contract",
    title: "Contract",
    description: "A legal agreement with a supplier or customer.",
    icon: <SignatureIcon className="size-4" aria-hidden />,
  },
  {
    name: "supplier",
    title: "Supplier",
    description: "A counter-party that issues invoices.",
    icon: <BuildingsIcon className="size-4" aria-hidden />,
  },
];

export const WithIconsAndDescriptions: Story = {
  args: {
    entities: ENTITIES_WITH_DETAILS,
    onSelect: fn(),
    label: "Entity",
  },
};

export const List: Story = {
  args: {
    entities: ENTITIES_WITH_DETAILS,
    selectedEntity: ENTITIES_WITH_DETAILS[1],
    onSelect: fn(),
  },
  render: ({ entities, selectedEntity, onSelect }) => (
    <div className="max-w-xl">
      <ProfileEntitySelectorList
        entities={entities}
        selectedEntity={selectedEntity}
        onSelect={onSelect}
        label="Entity"
      />
    </div>
  ),
};

export const ListNoSelection: Story = {
  ...List,
  args: { ...List.args, selectedEntity: undefined },
};
