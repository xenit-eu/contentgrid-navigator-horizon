import * as React from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within } from "storybook/test";
import { DataTable } from "./data-table";
import type { DataTableColumn, DataTableRow } from "./data-table";

const meta = {
  title: "Patterns/DataTable",
  component: DataTable,
} satisfies Meta<typeof DataTable>;

export default meta;
type Story = StoryObj<typeof meta>;

const COLUMNS: DataTableColumn[] = [
  { key: "name", header: "Name", sortable: true },
  { key: "status", header: "Status" },
  { key: "created", header: "Created" },
];

const ROWS: DataTableRow[] = [
  { id: "1", data: { name: "Alice Johnson", status: "active", created: "2024-01-15" } },
  { id: "2", data: { name: "Bob Smith", status: "inactive", created: "2024-02-20" } },
  { id: "3", data: { name: "Carol Williams", status: "active", created: "2024-03-05" } },
];

export const Default: Story = {
  render: () => (
    <DataTable
      entityName="user"
      entityTitle="Users"
      columns={COLUMNS}
      rows={ROWS}
      onViewDetails={() => {}}
      onEdit={() => {}}
      onDelete={() => {}}
      onRowClick={() => {}}
    />
  ),
};

export const Empty: Story = {
  render: () => (
    <DataTable
      entityName="invoice"
      entityTitle="Invoices"
      columns={COLUMNS}
      rows={[]}
      onCreateClick={() => {}}
    />
  ),
};

export const WithSort: Story = {
  render: () => (
    <DataTable
      entityName="user"
      entityTitle="Users"
      columns={COLUMNS}
      rows={ROWS}
      currentSort="name,asc"
      onSort={() => {}}
      sortOptions={[
        { value: "name,asc", property: "name", prompt: "Sort A→Z" },
        { value: "name,desc", property: "name", prompt: "Sort Z→A" },
      ]}
      onViewDetails={() => {}}
      onRowClick={() => {}}
    />
  ),
};

export const WithNullValues: Story = {
  render: () => (
    <DataTable
      entityName="document"
      entityTitle="Documents"
      columns={COLUMNS}
      rows={[
        { id: "1", data: { name: "Draft Report", status: null, created: undefined } },
        { id: "2", data: { name: "Final Invoice", status: "approved", created: "2024-06-01" } },
      ]}
      onViewDetails={() => {}}
    />
  ),
};

const InteractiveTable = () => {
  const [sort, setSort] = React.useState<string | undefined>(undefined);
  return (
    <DataTable
      entityName="user"
      entityTitle="Users"
      columns={COLUMNS}
      rows={ROWS}
      currentSort={sort}
      onSort={(key) => {
        if (sort === `${key},asc`) setSort(`${key},desc`);
        else if (sort === `${key},desc`) setSort(undefined);
        else setSort(`${key},asc`);
      }}
      onViewDetails={() => {}}
      onEdit={() => {}}
      onDelete={() => {}}
      onRowClick={() => {}}
    />
  );
};

export const WithInteraction: Story = {
  tags: ["no-visual-test"],
  render: () => <InteractiveTable />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Alice Johnson")).toBeInTheDocument();
    await expect(canvas.getByText("Bob Smith")).toBeInTheDocument();
    const nameHeader = canvas.getByRole("button", { name: /name/i });
    await userEvent.click(nameHeader);
    await expect(nameHeader).toBeInTheDocument();
  },
};
