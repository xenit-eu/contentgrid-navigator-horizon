import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, userEvent, within } from "storybook/test";
import { KnowledgeGraphLegend, type KnowledgeGraphLegendItem } from "./knowledge-graph-legend";
import { CUSTOMER, ORDER, PRODUCT } from "./knowledge-graph-story-helpers";

const ITEMS: KnowledgeGraphLegendItem[] = [
  { id: "customer", label: "Customer", color: CUSTOMER, icon: "Database", count: 1, active: true },
  { id: "order", label: "Order", color: ORDER, icon: "Database", count: 12, active: true },
  { id: "product", label: "Product", color: PRODUCT, icon: "Database", count: 4, active: false },
];

const meta = {
  title: "Patterns/KnowledgeGraphLegend",
  component: KnowledgeGraphLegend,
  tags: ["autodocs"],
  args: { items: ITEMS, onToggle: fn() },
} satisfies Meta<typeof KnowledgeGraphLegend>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Customer and Order shown, Product filtered out. */
export const Default: Story = {};

/** More types than fit: the row scrolls horizontally. */
export const Overflowing: Story = {
  args: {
    items: Array.from({ length: 12 }, (_, i) => ({
      ...ITEMS[i % ITEMS.length]!,
      id: `type-${i}`,
      label: `Entity type ${i + 1}`,
    })),
  },
  decorators: [
    (Story) => (
      <div className="w-96 rounded-lg border">
        <Story />
      </div>
    ),
  ],
};

export const ToggleInteraction: Story = {
  tags: ["no-visual-test"],
  render: function Render(args) {
    const [items, setItems] = useState(args.items);
    return (
      <KnowledgeGraphLegend
        {...args}
        items={items}
        onToggle={(id) =>
          setItems((prev) => prev.map((it) => (it.id === id ? { ...it, active: !it.active } : it)))
        }
      />
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const order = canvas.getByRole("button", { name: /Order/ });
    await expect(order).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(order);
    await expect(order).toHaveAttribute("aria-pressed", "false");
  },
};
