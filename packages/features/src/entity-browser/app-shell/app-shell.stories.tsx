import type { Meta, StoryObj } from "@storybook/react";
import { AppShell } from "./app-shell";

// NOTE: AppShell requires TanStack Router context (useMatchRoute, Link),
// a QueryClient, and a NavigatorDataProvider + AuthProvider from the app.
// A full provider stack is out of scope for a static feature story.
// Visual regression is deferred; tag "no-visual-test" to exclude from snapshots.
const meta = {
  title: "Features/EntityBrowser/AppShell",
  component: AppShell,
  tags: ["autodocs", "no-visual-test"],
} satisfies Meta<typeof AppShell>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: (
      <div className="p-6">
        <p className="text-muted-foreground text-sm">Content area</p>
      </div>
    ),
  },
};
