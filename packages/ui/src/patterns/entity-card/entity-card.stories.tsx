import type { Meta, StoryObj } from "@storybook/react";
import { Building2, FileText, Globe, Package, ScrollText, ShoppingCart } from "lucide-react";
import { expect, fn, userEvent, within } from "storybook/test";
import { EntityCard } from "./entity-card";

const meta = {
  title: "Patterns/EntityCard",
  component: EntityCard,
  tags: ["autodocs"],
} satisfies Meta<typeof EntityCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    name: "invoice",
    title: "Invoices",
    count: 42,
  },
};

export const WithIconTileSky: Story = {
  args: {
    name: "invoice",
    title: "Invoices",
    count: 1284,
    icon: FileText,
    tint: "sky",
  },
};

export const WithIconTileAmber: Story = {
  args: {
    name: "contract",
    title: "Contracts",
    count: 412,
    icon: ScrollText,
    tint: "amber",
  },
};

export const WithIconTileSteel: Story = {
  args: {
    name: "supplier",
    title: "Suppliers",
    count: 87,
    icon: Building2,
    tint: "steel",
  },
};

export const WithIconTileSand: Story = {
  args: {
    name: "product",
    title: "Products",
    count: 1204,
    icon: Package,
    tint: "sand",
  },
};

export const WithIconTileOcean: Story = {
  args: {
    name: "order",
    title: "Purchase orders",
    count: 331,
    icon: ShoppingCart,
    tint: "ocean",
  },
};

export const WithIconTileBreeze: Story = {
  args: {
    name: "company",
    title: "Companies",
    count: 42,
    icon: Globe,
    tint: "breeze",
  },
};

export const AllTints: Story = {
  tags: ["no-visual-test"],
  // args required by type but overridden by render
  args: { name: "_", title: "_" },
  render: () => (
    <div className="grid grid-cols-2 gap-3 p-4">
      <EntityCard name="invoice" title="Invoices (sky)" count={1284} icon={FileText} tint="sky" />
      <EntityCard
        name="contract"
        title="Contracts (amber)"
        count={412}
        icon={ScrollText}
        tint="amber"
      />
      <EntityCard
        name="supplier"
        title="Suppliers (steel)"
        count={87}
        icon={Building2}
        tint="steel"
      />
      <EntityCard name="product" title="Products (sand)" count={1204} icon={Package} tint="sand" />
      <EntityCard
        name="order"
        title="Purchase orders (ocean)"
        count={331}
        icon={ShoppingCart}
        tint="ocean"
      />
      <EntityCard name="company" title="Companies (breeze)" count={42} icon={Globe} tint="breeze" />
    </div>
  ),
};

export const WithDescription: Story = {
  args: {
    name: "invoice",
    title: "Invoices",
    count: 42,
    description: "Outgoing invoices linked to suppliers and customers.",
  },
};

export const WithContent: Story = {
  args: {
    name: "document",
    title: "Documents",
    count: 7,
    description: "Uploaded PDF and Office documents.",
    hasContent: true,
  },
};

export const NoCount: Story = {
  args: {
    name: "supplier",
    title: "Suppliers",
  },
};

export const ZeroCount: Story = {
  args: {
    name: "supplier",
    title: "Suppliers",
    count: 0,
  },
};

export const WithInteraction: Story = {
  tags: ["no-visual-test"],
  args: {
    name: "invoice",
    title: "Invoices",
    count: 5,
    onCreateClick: fn(),
    onTitleClick: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    const createBtn = canvas.getByRole("button", { name: /create invoices/i });
    await userEvent.click(createBtn);
    await expect(args.onCreateClick).toHaveBeenCalledWith("invoice");

    // Exact string match avoids ambiguity with the "Create Invoices" sr-only button
    const titleBtn = canvas.getByRole("button", { name: "Invoices" });
    await userEvent.click(titleBtn);
    await expect(args.onTitleClick).toHaveBeenCalledWith("invoice");
  },
};
