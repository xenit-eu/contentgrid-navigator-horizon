import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { IconPicker } from "./icon-picker";

const meta = {
  title: "Patterns/IconPicker",
  component: IconPicker,
  tags: ["autodocs"],
} satisfies Meta<typeof IconPicker>;

export default meta;
type Story = StoryObj<typeof meta>;

function ControlledIconPicker({ initial }: { initial?: string }) {
  const [value, setValue] = useState(initial);
  return <IconPicker value={value} onChange={setValue} />;
}

export const Unset: Story = {
  args: { value: undefined, onChange: fn() },
  render: () => <ControlledIconPicker />,
};

export const Preselected: Story = {
  args: { value: "Database", onChange: fn() },
  render: () => <ControlledIconPicker initial="Database" />,
};

export const WithInteraction: Story = {
  args: { value: undefined, onChange: fn() },
  tags: ["no-visual-test"],
  render: () => <ControlledIconPicker />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: /choose icon/i }));
    const folderOption = await waitFor(() => within(document.body).getByTitle("Folder"));
    await userEvent.click(folderOption);
    await waitFor(() => expect(canvas.getByText("Folder")).toBeInTheDocument());
  },
};

export const FilteredByCategory: Story = {
  args: { value: undefined, onChange: fn() },
  tags: ["no-visual-test"],
  render: () => <ControlledIconPicker />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: /choose icon/i }));
    await userEvent.click(await waitFor(() => within(document.body).getByText("Shapes")));

    // Only Shapes-tagged icons remain (e.g. Cube); a Business-only icon is filtered out.
    await waitFor(() => expect(within(document.body).getByTitle("Cube")).toBeInTheDocument());
    expect(within(document.body).queryByTitle("Briefcase")).not.toBeInTheDocument();
  },
};
