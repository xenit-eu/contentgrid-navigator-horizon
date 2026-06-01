import type { Meta, StoryObj } from "@storybook/react";
import { toast } from "sonner";
import { Button } from "./button";
import { Toaster } from "./sonner";

const meta = {
  title: "Primitives/Sonner",
  component: Toaster,
} satisfies Meta<typeof Toaster>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <>
      <Toaster />
      <Button onClick={() => toast("Profile saved successfully.")}>Show toast</Button>
    </>
  ),
};

export const Variants: Story = {
  render: () => (
    <>
      <Toaster />
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => toast.success("Changes saved.")}>Success</Button>
        <Button variant="destructive" onClick={() => toast.error("Something went wrong.")}>
          Error
        </Button>
        <Button variant="outline" onClick={() => toast.info("New version available.")}>
          Info
        </Button>
        <Button variant="outline" onClick={() => toast.warning("Storage almost full.")}>
          Warning
        </Button>
        <Button
          variant="ghost"
          onClick={() => toast.loading("Uploading file…", { duration: 3000 })}
        >
          Loading
        </Button>
      </div>
    </>
  ),
};
