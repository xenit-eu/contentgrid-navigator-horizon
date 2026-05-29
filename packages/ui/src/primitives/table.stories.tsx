import type { Meta, StoryObj } from "@storybook/react";
import { Badge } from "./badge";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "./table";

const meta = {
  title: "Primitives/Table",
  component: Table,
} satisfies Meta<typeof Table>;

export default meta;
type Story = StoryObj<typeof meta>;

const users = [
  { name: "Jane Smith", email: "jane@example.com", role: "Admin", status: "Active" },
  { name: "John Doe", email: "john@example.com", role: "Editor", status: "Active" },
  { name: "Alice Brown", email: "alice@example.com", role: "Viewer", status: "Inactive" },
];

export const Default: Story = {
  render: () => (
    <Table>
      <TableCaption>Team members</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Role</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {users.map((user) => (
          <TableRow key={user.email}>
            <TableCell className="font-medium">{user.name}</TableCell>
            <TableCell>{user.email}</TableCell>
            <TableCell>{user.role}</TableCell>
            <TableCell>
              <Badge variant={user.status === "Active" ? "default" : "secondary"}>
                {user.status}
              </Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  ),
};

export const WithFooter: Story = {
  render: () => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Item</TableHead>
          <TableHead className="text-right">Amount</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell>Subscription — Pro</TableCell>
          <TableCell className="text-right">€49.00</TableCell>
        </TableRow>
        <TableRow>
          <TableCell>Extra storage (100 GB)</TableCell>
          <TableCell className="text-right">€9.00</TableCell>
        </TableRow>
        <TableRow>
          <TableCell>Additional seat</TableCell>
          <TableCell className="text-right">€15.00</TableCell>
        </TableRow>
      </TableBody>
      <TableFooter>
        <TableRow>
          <TableCell>Total</TableCell>
          <TableCell className="text-right">€73.00</TableCell>
        </TableRow>
      </TableFooter>
    </Table>
  ),
};
