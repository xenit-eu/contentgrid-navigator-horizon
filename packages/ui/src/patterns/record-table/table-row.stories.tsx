import * as React from "react";
import { DotsThreeIcon as DotsThree, FileTextIcon as FileText } from "@phosphor-icons/react";
import type { Meta, StoryObj } from "@storybook/react";
import { Button } from "../../primitives/button";
import { IconBadge } from "../../primitives/icon-badge";
import { RecordTableRow } from "./table-row";
import type { RecordTableCell } from "./table-row";

const meta = {
  title: "Patterns/RecordTableRow",
  component: RecordTableRow,
  tags: ["autodocs"],
} satisfies Meta<typeof RecordTableRow>;

export default meta;
type Story = StoryObj<typeof meta>;

const TableWrapper = ({ children }: { children: React.ReactNode }) => (
  <div role="table">
    <div role="rowgroup">{children}</div>
  </div>
);

function identityCell(reference: string, fileMeta: string): RecordTableCell {
  return {
    key: "name",
    content: (
      <div className="flex items-center gap-[11px]">
        <IconBadge icon={<FileText />} color="#019BE3" variant="sm" />
        <div>
          <div className="text-[13px] font-medium text-foreground">{reference}</div>
          <div className="text-[12px] text-muted-foreground">{fileMeta}</div>
        </div>
      </div>
    ),
  };
}

const DEFAULT_CELLS: RecordTableCell[] = [
  identityCell("INV-2024-0042", "invoice_acme_q4.pdf · 2.4 MB"),
  { key: "supplier", content: "Acme Corporation" },
  { key: "total", content: "€ 12,450.00", align: "end" },
];

export const Default: Story = {
  args: {
    cells: DEFAULT_CELLS,
  },
  decorators: [
    (Story) => (
      <TableWrapper>
        <Story />
      </TableWrapper>
    ),
  ],
};

export const Selected: Story = {
  args: {
    cells: DEFAULT_CELLS,
    selected: true,
  },
  decorators: [
    (Story) => (
      <TableWrapper>
        <Story />
      </TableWrapper>
    ),
  ],
};

export const WithActions: Story = {
  args: {
    cells: DEFAULT_CELLS,
    actions: (
      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
        <DotsThree className="h-4 w-4" />
        <span className="sr-only">Open menu</span>
      </Button>
    ),
  },
  decorators: [
    (Story) => (
      <TableWrapper>
        <Story />
      </TableWrapper>
    ),
  ],
};

export const ManyColumns: Story = {
  args: {
    cells: [
      identityCell("INV-2024-0042", "invoice_acme_q4.pdf · 2.4 MB"),
      { key: "supplier", content: "Acme Corporation" },
      { key: "status", content: "Approved" },
      { key: "dueDate", content: "2024-11-30" },
      { key: "category", content: "Utilities" },
      { key: "total", content: "€ 12,450.00", align: "end" },
    ],
  },
  decorators: [
    (Story) => (
      <TableWrapper>
        <Story />
      </TableWrapper>
    ),
  ],
};
