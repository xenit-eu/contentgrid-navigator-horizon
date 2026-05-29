import type { Meta, StoryObj } from "@storybook/react";
import { Skeleton } from "./skeleton";

const meta = {
  title: "Primitives/Skeleton",
  component: Skeleton,
} satisfies Meta<typeof Skeleton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => <Skeleton className="h-4 w-48" />,
};

export const Card: Story = {
  render: () => (
    <div className="flex w-72 flex-col gap-3 rounded-xl border p-4">
      <div className="flex items-center gap-3">
        <Skeleton className="size-10 rounded-full" />
        <div className="flex flex-col gap-2">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
      <Skeleton className="h-24 w-full rounded-md" />
      <div className="flex gap-2">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-16" />
      </div>
    </div>
  ),
};

export const List: Story = {
  render: () => (
    <div className="flex w-64 flex-col gap-2">
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="size-8 rounded-full" />
          <div className="flex flex-1 flex-col gap-1.5">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-3/4" />
          </div>
        </div>
      ))}
    </div>
  ),
};
