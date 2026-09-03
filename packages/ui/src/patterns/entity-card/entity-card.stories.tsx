import { DatabaseIcon, FileTextIcon, PlusIcon } from "@phosphor-icons/react";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, userEvent } from "storybook/test";
import { Button } from "../../primitives/button";
import { IconBadge } from "../../primitives/icon-badge";
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

export const WithHeader: Story = {
  args: {
    name: "invoice",
    header: "Entity Collection",
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
    icon: <IconBadge icon={<DatabaseIcon aria-hidden />} color="oklch(0.55 0.17 155)" />,
    action: createAction("Invoices"),
    children: (
      <>
        <div className="text-2xl font-bold">42</div>
        <p className="text-xs text-muted-foreground">items</p>
      </>
    ),
  },
};

export const DefaultTitleVariant: Story = {
  args: {
    name: "invoice",
    title: "Invoices",
    description: "Outgoing invoices linked to suppliers and customers.",
    titleVariant: "default",
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
    onCardClick: fn(),
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
    const card = canvasElement.querySelector('[data-slot="entity-card"]') as HTMLElement;
    await userEvent.click(card);
    await expect(args.onCardClick).toHaveBeenCalledWith("invoice");
  },
};
