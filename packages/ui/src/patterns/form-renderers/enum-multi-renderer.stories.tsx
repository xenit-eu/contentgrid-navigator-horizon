import type { Meta, StoryObj } from "@storybook/react";
import { expect, fireEvent, fn, within } from "storybook/test";
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

export const RemoteOptionsNotYetLoaded: Story = {
  args: {
    ...enumMultiField({ options: [], isRemote: true }),
    value: [],
    onChange: fn(),
  },
};

export const CheckingAnOptionCallsOnChange: Story = {
  args: {
    ...enumMultiField(),
    value: ["draft"],
    onChange: fn(),
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await fireEvent.click(canvas.getByLabelText("Published"));
    await expect(args.onChange).toHaveBeenCalledWith(["draft", "published"]);
  },
  tags: ["no-visual-test"],
};
