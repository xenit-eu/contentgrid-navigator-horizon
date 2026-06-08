import type { Meta, StoryObj } from "@storybook/react";
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
