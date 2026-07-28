import type { Meta, StoryObj } from "@storybook/react";
import { LoadingPage } from "./loading-page";

const meta = {
  title: "Patterns/LoadingPage",
  component: LoadingPage,
  tags: ["autodocs"],
  // Override the global `centered` layout (.storybook/preview.ts): centering
  // shrink-wraps #storybook-root, and every LoadingPage child is `w-full` with
  // no intrinsic width, so they collapse to width:0 and the story renders blank
  // — which also made the Default/FewRows visual baselines byte-identical.
  // `padded` gives the root a full-width block container instead.
  parameters: { layout: "padded" },
} satisfies Meta<typeof LoadingPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {},
};

export const FewRows: Story = {
  args: { rows: 2 },
};
