import type { Meta, StoryObj } from "@storybook/react";
import { expect, fireEvent, fn, within } from "storybook/test";
import { EnumMultiRenderer } from "./enum-multi-renderer";
import { REMOTE_OPTIONS, enumMultiField } from "./test-fixtures";

const meta = {
  title: "Patterns/FormRenderers/EnumMultiRenderer",
  component: EnumMultiRenderer,
  tags: ["autodocs"],
} satisfies Meta<typeof EnumMultiRenderer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    field: enumMultiField(),
    value: [],
    onChange: fn(),
  },
};

export const WithSelectedValues: Story = {
  args: {
    field: enumMultiField(),
    value: ["draft", "archived"],
    onChange: fn(),
  },
};

export const RemoteOptionsNotYetLoaded: Story = {
  args: {
    field: enumMultiField({ optionsSource: REMOTE_OPTIONS }),
    value: [],
    onChange: fn(),
  },
};

export const CheckingAnOptionCallsOnChange: Story = {
  args: {
    field: enumMultiField(),
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
