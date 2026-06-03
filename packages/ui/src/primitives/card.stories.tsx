import * as React from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within } from "storybook/test";
import { Button } from "./button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "./card";

const meta = {
  title: "Primitives/Card",
  component: Card,
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Card className="w-80">
      <CardHeader>
        <CardTitle>Account settings</CardTitle>
        <CardDescription>Manage your profile and preferences.</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Update your display name, email address, and notification settings.
        </p>
      </CardContent>
      <CardFooter>
        <Button size="sm">Save changes</Button>
      </CardFooter>
    </Card>
  ),
};

export const WithAction: Story = {
  render: () => (
    <Card className="w-80">
      <CardHeader>
        <CardTitle>Team members</CardTitle>
        <CardDescription>Invite people to your workspace.</CardDescription>
        <CardAction>
          <Button size="sm" variant="outline">
            Invite
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">3 members currently active.</p>
      </CardContent>
    </Card>
  ),
};

export const Simple: Story = {
  render: () => (
    <Card className="w-64">
      <CardHeader>
        <CardTitle>Storage used</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold">4.2 GB</p>
        <p className="text-sm text-muted-foreground">of 10 GB</p>
      </CardContent>
    </Card>
  ),
};

export const WithInteraction: Story = {
  tags: ["no-visual-test"],
  render: () => {
    const [saved, setSaved] = React.useState(false);
    return (
      <Card className="w-72">
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Update your details.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {saved ? "Changes saved!" : "Make your changes below."}
          </p>
        </CardContent>
        <CardFooter>
          <Button size="sm" onClick={() => setSaved(true)}>
            Save changes
          </Button>
        </CardFooter>
      </Card>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/make your changes below/i)).toBeInTheDocument();
    const saveBtn = canvas.getByRole("button", { name: /save changes/i });
    await userEvent.click(saveBtn);
    await expect(canvas.getByText(/changes saved!/i)).toBeInTheDocument();
  },
};
