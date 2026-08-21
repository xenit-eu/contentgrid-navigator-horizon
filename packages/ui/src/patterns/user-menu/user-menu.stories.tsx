import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { UserMenu } from "./user-menu";

const meta = {
  title: "Patterns/UserMenu",
  component: UserMenu,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="flex h-14 items-center bg-gradient-to-r from-[var(--ocean-700)] to-[var(--sky)] px-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof UserMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    name: "John Doe",
    email: "john.doe@example.com",
    onLogOut: fn(),
  },
};

export const LongNameAndEmail: Story = {
  args: {
    name: "Alexandra Christodoulopoulou",
    email: "alexandra.christodoulopoulou@really-long-domain-name.example.com",
    onLogOut: fn(),
  },
};

export const WithInteraction: Story = {
  tags: ["no-visual-test"],
  args: {
    name: "John Doe",
    email: "john.doe@example.com",
    onLogOut: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("JD")).toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: /john doe/i }));
    const logOutItem = await waitFor(() => within(document.body).getByText("Log out"));
    await userEvent.click(logOutItem);
    await waitFor(() => expect(args.onLogOut).toHaveBeenCalledTimes(1));
  },
};
