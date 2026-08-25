import { FileTextIcon, PlusIcon } from "@phosphor-icons/react";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, userEvent, within } from "storybook/test";
import { Button } from "../../primitives/button";
import { EntityCard } from "./entity-card";

const meta = {
  title: "Patterns/EntityCard",
  component: EntityCard,
  tags: ["autodocs"],
} satisfies Meta<typeof EntityCard>;

export default meta;
type Story = StoryObj<typeof meta>;

function createAction(title: string) {
  return (
    <Button variant="ghost" size="icon" onClick={fn()}>
      <PlusIcon className="h-4 w-4" aria-hidden />
      <span className="sr-only">Create {title}</span>
    </Button>
  );
}

export const Default: Story = {
  args: {
    name: "invoice",
    title: "Invoices",
    action: createAction("Invoices"),
    children: (
      <>
        <div className="text-2xl font-bold">42</div>
        <p className="text-xs text-muted-foreground">items</p>
      </>
    ),
  },
};

export const WithDescription: Story = {
  args: {
    name: "invoice",
    title: "Invoices",
    description: "Outgoing invoices linked to suppliers and customers.",
    action: createAction("Invoices"),
    children: (
      <>
        <div className="text-2xl font-bold">42</div>
        <p className="text-xs text-muted-foreground">items</p>
      </>
    ),
  },
};

export const WithCustomIcon: Story = {
  args: {
    name: "document",
    title: "Documents",
    description: "Uploaded PDF and Office documents.",
    icon: <FileTextIcon className="h-5 w-5 text-muted-foreground" aria-hidden />,
    action: createAction("Documents"),
    children: (
      <>
        <div className="text-2xl font-bold">7</div>
        <p className="text-xs text-muted-foreground">items</p>
      </>
    ),
  },
};

export const WithColor: Story = {
  args: {
    name: "invoice",
    title: "Invoices",
    description: "Outgoing invoices linked to suppliers and customers.",
    color: "oklch(0.55 0.17 155)",
    action: createAction("Invoices"),
    children: (
      <>
        <div className="text-2xl font-bold">42</div>
        <p className="text-xs text-muted-foreground">items</p>
      </>
    ),
  },
};

export const NoBody: Story = {
  args: {
    name: "supplier",
    title: "Suppliers",
  },
};

export const NoAction: Story = {
  args: {
    name: "supplier",
    title: "Suppliers",
    children: (
      <>
        <div className="text-2xl font-bold">0</div>
        <p className="text-xs text-muted-foreground">items</p>
      </>
    ),
  },
};

export const WithInteraction: Story = {
  tags: ["no-visual-test"],
  args: {
    name: "invoice",
    title: "Invoices",
    onTitleClick: fn(),
  },
  render: (args) => (
    <EntityCard
      {...args}
      action={
        <Button variant="ghost" size="icon" onClick={fn()}>
          <PlusIcon className="h-4 w-4" aria-hidden />
          <span className="sr-only">Create Invoices</span>
        </Button>
      }
    >
      <div className="text-2xl font-bold">5</div>
      <p className="text-xs text-muted-foreground">items</p>
    </EntityCard>
  ),
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    // Exact string match avoids ambiguity with the "Create Invoices" sr-only button
    const titleBtn = canvas.getByRole("button", { name: "Invoices" });
    await userEvent.click(titleBtn);
    await expect(args.onTitleClick).toHaveBeenCalledWith("invoice");
  },
};
