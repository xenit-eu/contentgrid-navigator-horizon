import * as React from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { RecordTableRow } from "./table-row";

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

export const Default: Story = {
  args: {
    selected: false,
    fileType: "pdf",
    reference: "INV-2024-0042",
    fileMeta: "invoice_acme_q4.pdf · 2.4 MB",
    supplier: "Acme Corporation",
    total: "€ 12,450.00",
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
    selected: true,
    fileType: "pdf",
    reference: "INV-2024-0042",
    fileMeta: "invoice_acme_q4.pdf · 2.4 MB",
    supplier: "Acme Corporation",
    total: "€ 12,450.00",
  },
  decorators: [
    (Story) => (
      <TableWrapper>
        <Story />
      </TableWrapper>
    ),
  ],
};

export const AllTypes: Story = {
  render: () => (
    <div role="table">
      <div role="rowgroup">
        <RecordTableRow
          fileType="pdf"
          reference="INV-2024-0042"
          fileMeta="invoice_acme_q4.pdf · 2.4 MB"
          supplier="Acme Corporation"
          total="€ 12,450.00"
        />
        <RecordTableRow
          fileType="img"
          reference="IMG-2024-0017"
          fileMeta="product_photo.jpg · 1.1 MB"
          supplier="Beta Supplies"
          total="€ 540.00"
        />
        <RecordTableRow
          fileType="doc"
          reference="DOC-2024-0008"
          fileMeta="contract_draft.docx · 340 KB"
          supplier="Gamma Services"
          total="€ 8,200.00"
        />
      </div>
    </div>
  ),
};
