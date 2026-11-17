import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within } from "storybook/test";
import { ActionableAccordion } from "./actionable-accordion";

const meta = {
  title: "Patterns/ActionableAccordion",
  component: ActionableAccordion,
  tags: ["autodocs"],
} satisfies Meta<typeof ActionableAccordion>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    title: "Invoices",
    actions: (
      <button type="button" className="text-sm">
        Link Invoices
      </button>
    ),
    children: <p className="text-sm text-muted-foreground">Three linked invoices go here.</p>,
  },
};

export const NoActions: Story = {
  args: {
    title: "Invoices",
    children: <p className="text-sm text-muted-foreground">Three linked invoices go here.</p>,
  },
};

export const Rows: Story = {
  args: {
    title: "Invoices",
    variant: "row",
    children: <p className="text-sm text-muted-foreground">Three linked invoices go here.</p>,
  },
  render: (args) => (
    <div className="rounded-xl border">
      <ActionableAccordion {...args} />
      <ActionableAccordion {...args} title="Suppliers" />
    </div>
  ),
};

export const CollapseInteraction: Story = {
  tags: ["no-visual-test"],
  args: {
    title: "Invoices",
    children: <p>Three linked invoices go here.</p>,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Three linked invoices go here.")).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: /invoices/i }));
    await expect(canvas.queryByText("Three linked invoices go here.")).not.toBeInTheDocument();
  },
};
