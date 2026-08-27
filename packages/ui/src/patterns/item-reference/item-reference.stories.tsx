import { FileTextIcon as FileText } from "@phosphor-icons/react";
import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { ItemReference } from "./item-reference";

const meta = {
  title: "Patterns/ItemReference",
  component: ItemReference,
  tags: ["autodocs"],
} satisfies Meta<typeof ItemReference>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    icon: <FileText />,
    color: "#019BE3",
    title: "INV-2024-0042",
    subtitle: "invoice_acme_q4.pdf · 2.4 MB",
  },
};

export const Selected: Story = {
  args: {
    icon: <FileText />,
    color: "#019BE3",
    title: "INV-2024-0042",
    subtitle: "invoice_acme_q4.pdf · 2.4 MB",
    selected: true,
  },
};

export const Clickable: Story = {
  args: {
    icon: <FileText />,
    color: "#019BE3",
    title: "INV-2024-0042",
    subtitle: "invoice_acme_q4.pdf · 2.4 MB",
    onClick: fn(),
  },
};

export const Muted: Story = {
  args: {
    icon: <FileText />,
    color: "#019BE3",
    muted: true,
    title: "INV-2024-0042",
    subtitle: "invoice_acme_q4.pdf · 2.4 MB",
  },
};

export const NoSubtitle: Story = {
  args: {
    icon: <FileText />,
    color: "#019BE3",
    title: "Acme Corporation",
  },
};

export const NoIcon: Story = {
  args: {
    title: "Untitled record",
    subtitle: "No icon configured",
  },
};

export const LargeSize: Story = {
  args: {
    icon: <FileText />,
    color: "#019BE3",
    size: "lg",
    title: "INV-2024-0042",
    subtitle: "invoice_acme_q4.pdf · 2.4 MB",
  },
};
