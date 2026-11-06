import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, userEvent, within } from "storybook/test";
import { EnumMultiRenderer } from "./enum-multi-renderer";
import { enumMultiField } from "./test-fixtures";

const meta = {
  title: "Patterns/FormRenderers/EnumMultiRenderer",
  component: EnumMultiRenderer,
  tags: ["autodocs"],
} satisfies Meta<typeof EnumMultiRenderer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    ...enumMultiField(),
    value: [],
    onChange: fn(),
  },
};

export const WithSelectedValues: Story = {
  args: {
    ...enumMultiField(),
    value: ["draft", "archived"],
    onChange: fn(),
  },
};

export const ReadOnly: Story = {
  args: {
    ...enumMultiField({ readOnly: true }),
    value: ["draft"],
    onChange: fn(),
  },
};

export const RemoteOptionsNotYetLoaded: Story = {
  args: {
    ...enumMultiField({ options: [], isRemote: true }),
    value: [],
    onChange: fn(),
  },
};

export const PickingAnOptionCallsOnChange: Story = {
  args: {
    ...enumMultiField(),
    value: ["draft"],
    onChange: fn(),
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("combobox", { name: "Tags" }));
    // The list is portalled out of the story canvas.
    const page = within(canvasElement.ownerDocument.body);
    await userEvent.click(await page.findByRole("option", { name: "Published" }));
    await expect(args.onChange).toHaveBeenCalledWith(["draft", "published"]);
  },
  tags: ["no-visual-test"],
};
