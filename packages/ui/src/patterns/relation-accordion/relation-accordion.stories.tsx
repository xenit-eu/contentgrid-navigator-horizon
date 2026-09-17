import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within } from "storybook/test";
import { RelationAccordion } from "./relation-accordion";

const meta = {
  title: "Patterns/RelationAccordion",
  component: RelationAccordion,
  tags: ["autodocs"],
} satisfies Meta<typeof RelationAccordion>;

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
