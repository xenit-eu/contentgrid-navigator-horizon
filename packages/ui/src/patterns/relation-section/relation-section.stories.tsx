import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, userEvent, within } from "storybook/test";
import { RelationSection } from "./relation-section";

const meta = {
  title: "Patterns/RelationSection",
  component: RelationSection,
  tags: ["autodocs"],
} satisfies Meta<typeof RelationSection>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithContent: Story = {
  args: {
    title: "Suppliers",
    onLink: fn(),
    children: (
      <div className="rounded-md border p-3 text-sm">
        Acme Corp, Amsterdam · Globex Inc, Rotterdam
      </div>
    ),
  },
};

export const Empty: Story = {
  args: {
    title: "Suppliers",
    onLink: fn(),
  },
};

export const EmptyReadOnly: Story = {
  args: {
    title: "Suppliers",
  },
};

export const Required: Story = {
  args: {
    title: "Supplier",
    required: true,
    onLink: fn(),
  },
};

export const LinkInteraction: Story = {
  tags: ["no-visual-test"],
  args: {
    title: "Suppliers",
    onLink: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: /link suppliers/i }));
    await expect(args.onLink).toHaveBeenCalledTimes(1);
  },
};
