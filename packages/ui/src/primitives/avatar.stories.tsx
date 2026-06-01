import type { Meta, StoryObj } from "@storybook/react";
import { Avatar, AvatarFallback, AvatarGroup, AvatarGroupCount, AvatarImage } from "./avatar";

const meta = {
  title: "Primitives/Avatar",
  component: Avatar,
} satisfies Meta<typeof Avatar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Avatar>
      <AvatarImage src="/avatar-placeholder.png" alt="placeholder" />
      <AvatarFallback>SC</AvatarFallback>
    </Avatar>
  ),
};

export const Sizes: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <Avatar size="sm">
        <AvatarFallback>SM</AvatarFallback>
      </Avatar>
      <Avatar size="default">
        <AvatarFallback>MD</AvatarFallback>
      </Avatar>
      <Avatar size="lg">
        <AvatarFallback>LG</AvatarFallback>
      </Avatar>
    </div>
  ),
};

export const Fallback: Story = {
  render: () => (
    <Avatar>
      <AvatarImage src="/broken-image.png" alt="Broken" />
      <AvatarFallback>JD</AvatarFallback>
    </Avatar>
  ),
};

export const Group: Story = {
  render: () => (
    <AvatarGroup>
      <Avatar>
        <AvatarFallback>AA</AvatarFallback>
      </Avatar>
      <Avatar>
        <AvatarFallback>BB</AvatarFallback>
      </Avatar>
      <Avatar>
        <AvatarFallback>CC</AvatarFallback>
      </Avatar>
      <AvatarGroupCount>+4</AvatarGroupCount>
    </AvatarGroup>
  ),
};
