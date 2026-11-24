import type { ReactNode } from "react";
import { FileTextIcon, PackageIcon, ShoppingCartIcon } from "@phosphor-icons/react";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, userEvent } from "storybook/test";
import { Button } from "../../primitives/button";
import { IconBadge } from "../../primitives/icon-badge";
import {
  EntityCard,
  EntityCardArrow,
  EntityCardDescription,
  EntityCardGrid,
  EntityCardText,
  EntityCardTitle,
} from "./entity-card";

const meta = {
  title: "Patterns/EntityCard",
  component: EntityCard,
  tags: ["autodocs"],
} satisfies Meta<typeof EntityCard>;

export default meta;
type Story = StoryObj<typeof meta>;

const sampleColor = "oklch(0.55 0.17 155)";

/** A card that opens a collection: icon and arrow on top, then the name, description and count. */
function OpenableCard({
  title,
  description,
  count,
  icon,
  onOpen,
}: Readonly<{
  title: string;
  description?: string;
  count: number;
  icon: ReactNode;
  onOpen?: () => void;
}>) {
  return (
    <EntityCard onOpen={onOpen ?? fn()}>
      <div className="flex items-start justify-between gap-2">
        <IconBadge icon={icon} color={sampleColor} tinted />
        <EntityCardArrow />
      </div>
      <EntityCardText>
        <EntityCardTitle>{title}</EntityCardTitle>
        {description && <EntityCardDescription>{description}</EntityCardDescription>}
      </EntityCardText>
      <p className="mt-auto text-ui text-muted-foreground">
        <span className="font-bold text-card-foreground">{count.toLocaleString()}</span>{" "}
        {count === 1 ? "item" : "items"}
      </p>
    </EntityCard>
  );
}

export const Openable: Story = {
  render: () => (
    <div className="w-72">
      <OpenableCard
        title="Invoices"
        description="Supplier invoices with line items and the scanned document."
        count={1284}
        icon={<FileTextIcon aria-hidden />}
      />
    </div>
  ),
};

/** Without a description the line is left out. */
export const OpenableWithoutDescription: Story = {
  render: () => (
    <div className="w-72">
      <OpenableCard title="Purchase orders" count={0} icon={<ShoppingCartIcon aria-hidden />} />
    </div>
  ),
};

/** A card that isn't one button: its own controls do the work. */
export const WithOwnControls: Story = {
  render: () => (
    <div className="w-72">
      <EntityCard className="flex-row items-start">
        <button
          type="button"
          aria-label="Change icon and color for Products"
          className="inline-flex shrink-0 items-center justify-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={fn()}
        >
          <IconBadge icon={<PackageIcon aria-hidden />} color={sampleColor} tinted />
        </button>
        <EntityCardText className="flex-1">
          <EntityCardTitle>Products</EntityCardTitle>
          <EntityCardDescription>Defaults</EntityCardDescription>
          <Button variant="link" size="xs" className="h-auto p-0 text-ui font-semibold">
            Configure
          </Button>
        </EntityCardText>
      </EntityCard>
    </div>
  ),
};

/**
 * A long title, a long description and a card without a description in one row: the text clamps
 * and every count line stays at the bottom of its card.
 */
export const Grid: Story = {
  render: () => (
    <EntityCardGrid>
      <OpenableCard
        title="Purchase order confirmations from external suppliers"
        description="Replies from suppliers to a purchase order."
        count={1}
        icon={<FileTextIcon aria-hidden />}
      />
      <OpenableCard
        title="Products"
        description="Catalogue items that can appear on invoices, with their prices, the units they are sold in, the suppliers that deliver them and the stock that is left in every warehouse."
        count={1204}
        icon={<PackageIcon aria-hidden />}
      />
      <OpenableCard title="Purchase orders" count={0} icon={<ShoppingCartIcon aria-hidden />} />
    </EntityCardGrid>
  ),
};

export const WithInteraction: Story = {
  tags: ["no-visual-test"],
  args: { onOpen: fn() },
  render: (args) => (
    <div className="w-72">
      <OpenableCard
        title="Invoices"
        count={5}
        icon={<FileTextIcon aria-hidden />}
        onOpen={args.onOpen}
      />
    </div>
  ),
  play: async ({ canvasElement, args }) => {
    const card = canvasElement.querySelector('[data-slot="entity-card"]') as HTMLElement;
    await userEvent.click(card);
    await expect(args.onOpen).toHaveBeenCalledOnce();
  },
};
