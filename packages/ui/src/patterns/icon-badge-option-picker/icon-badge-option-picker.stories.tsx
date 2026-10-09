import { BuildingsIcon, FileTextIcon, SignatureIcon } from "@phosphor-icons/react";
import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { IconBadgeOptionPicker, IconBadgeOptionPickerList } from "./icon-badge-option-picker";

const meta = {
  title: "Patterns/IconBadgeOptionPicker",
  component: IconBadgeOptionPicker,
  tags: ["autodocs"],
  args: { placeholder: "Select entity" },
} satisfies Meta<typeof IconBadgeOptionPicker>;

export default meta;
type Story = StoryObj<typeof meta>;

const ENTITIES = [
  { name: "invoice", title: "Invoice" },
  { name: "customer", title: "Customer" },
  { name: "supplier", title: "Supplier" },
];

export const SingleEntity: Story = {
  args: {
    options: [{ name: "invoice", title: "Invoice" }],
    onSelect: fn(),
  },
};

export const TwoEntities: Story = {
  args: {
    options: ENTITIES.slice(0, 2),
    selectedOption: ENTITIES[0],
    onSelect: fn(),
  },
};

export const ManyEntities: Story = {
  args: {
    options: ENTITIES,
    selectedOption: ENTITIES[1],
    onSelect: fn(),
  },
};

export const NoSelection: Story = {
  args: {
    options: ENTITIES,
    onSelect: fn(),
  },
};

export const WithLabel: Story = {
  args: {
    options: ENTITIES,
    selectedOption: undefined,
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
    options: ENTITIES_WITH_DETAILS,
    onSelect: fn(),
    label: "Entity",
  },
};

export const List: Story = {
  args: {
    options: ENTITIES_WITH_DETAILS,
    selectedOption: ENTITIES_WITH_DETAILS[1],
    onSelect: fn(),
  },
  render: ({ options, selectedOption, onSelect }) => (
    <div className="max-w-xl">
      <IconBadgeOptionPickerList
        options={options}
        selectedOption={selectedOption}
        onSelect={onSelect}
        label="Entity"
      />
    </div>
  ),
};

export const ListNoSelection: Story = {
  ...List,
  args: { ...List.args, selectedOption: undefined },
};
