import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "./select";

const meta = {
  title: "Primitives/Select",
  component: Select,
} satisfies Meta<typeof Select>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <div className="flex flex-col gap-1.5">
      <label htmlFor="select-role" className="text-sm font-medium">
        Role
      </label>
      <Select>
        <SelectTrigger id="select-role" className="w-48">
          <SelectValue placeholder="Select a role" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="admin">Admin</SelectItem>
          <SelectItem value="editor">Editor</SelectItem>
          <SelectItem value="viewer">Viewer</SelectItem>
        </SelectContent>
      </Select>
    </div>
  ),
};

export const WithGroups: Story = {
  render: () => (
    <div className="flex flex-col gap-1.5">
      <label htmlFor="select-timezone" className="text-sm font-medium">
        Timezone
      </label>
      <Select>
        <SelectTrigger id="select-timezone" className="w-56">
          <SelectValue placeholder="Select a timezone" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>Europe</SelectLabel>
            <SelectItem value="europe/brussels">Brussels</SelectItem>
            <SelectItem value="europe/amsterdam">Amsterdam</SelectItem>
            <SelectItem value="europe/london">London</SelectItem>
          </SelectGroup>
          <SelectSeparator />
          <SelectGroup>
            <SelectLabel>Americas</SelectLabel>
            <SelectItem value="america/new_york">New York</SelectItem>
            <SelectItem value="america/chicago">Chicago</SelectItem>
            <SelectItem value="america/los_angeles">Los Angeles</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  ),
};

export const Disabled: Story = {
  render: () => (
    <div className="flex flex-col gap-1.5">
      <label htmlFor="select-disabled" className="text-sm font-medium">
        Plan
      </label>
      <Select disabled>
        <SelectTrigger id="select-disabled" className="w-48">
          <SelectValue placeholder="Not available" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="a">Option A</SelectItem>
        </SelectContent>
      </Select>
    </div>
  ),
};

export const SmallSize: Story = {
  render: () => (
    <div className="flex flex-col gap-1.5">
      <label htmlFor="select-status" className="text-sm font-medium">
        Status
      </label>
      <Select>
        <SelectTrigger id="select-status" className="w-40" size="sm">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="active">Active</SelectItem>
          <SelectItem value="inactive">Inactive</SelectItem>
          <SelectItem value="pending">Pending</SelectItem>
        </SelectContent>
      </Select>
    </div>
  ),
};

export const WithInteraction: Story = {
  // axe-no-contrast: play() opens the listbox in a portal; the scrim composites into
  // axe's background calc, flagging option text as low-contrast. The options render on
  // the real frost surface where text-foreground passes WCAG AA (15.5:1).
  tags: ["no-visual-test", "axe-no-contrast"],
  render: () => (
    <div className="flex flex-col gap-1.5">
      <label htmlFor="select-interaction-role" className="text-sm font-medium">
        Role
      </label>
      <Select>
        <SelectTrigger id="select-interaction-role" className="w-48">
          <SelectValue placeholder="Pick a role" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="admin">Admin</SelectItem>
          <SelectItem value="editor">Editor</SelectItem>
          <SelectItem value="viewer">Viewer</SelectItem>
        </SelectContent>
      </Select>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole("combobox");
    await expect(trigger).toBeInTheDocument();
    await userEvent.click(trigger);
    // Wait for the portal to mount and the listbox to become visible
    let listbox: HTMLElement;
    await waitFor(() => {
      listbox = within(document.body).getByRole("listbox");
      expect(listbox).toBeVisible();
    });
    const adminOption = within(listbox!).getByRole("option", { name: /admin/i });
    await userEvent.click(adminOption);
    await expect(trigger).toHaveTextContent(/admin/i);
  },
};
