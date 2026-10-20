import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { KnowledgeGraph } from "./knowledge-graph";
import { InteractiveKnowledgeGraph, StoryFrame, baseArgs } from "./knowledge-graph-story-helpers";

const meta = {
  title: "Patterns/KnowledgeGraph",
  component: KnowledgeGraph,
  parameters: { layout: "fullscreen" },
  args: baseArgs,
} satisfies Meta<typeof KnowledgeGraph>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Click a node → its menu opens (anchored, in a portal) → Escape closes it; click an edge label →
 * the edge menu opens. Kept in one `step`-free play() (see packages/ui/CLAUDE.md on the Popover /
 * step-boundary harness quirk).
 */
export const WithInteraction: Story = {
  // axe-no-contrast: the open popover composites into axe's background calc (false positives).
  tags: ["no-visual-test", "axe-no-contrast"],
  render: (args) => (
    <StoryFrame>
      <InteractiveKnowledgeGraph {...args} />
    </StoryFrame>
  ),
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const body = within(document.body);
    // Generous timeouts: the popover mounts in a portal and animates in, which can take longer
    // than waitFor's 1s default when the suite runs several browsers in parallel.
    const slow = { timeout: 5_000 };

    const node = await canvas.findByText("ORD-002", {}, slow);
    await userEvent.click(node);
    await expect(args.onNodeClick).toHaveBeenCalledWith("o2");
    await waitFor(() => expect(body.getByRole("menu", { name: "ORD-002" })).toBeVisible(), slow);
    await expect(body.getByRole("menuitem", { name: "Explore relations" })).toBeInTheDocument();

    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(body.queryByRole("menu")).not.toBeInTheDocument(), slow);

    const label = await canvas.findByRole("button", { name: "c1 — Account manager → a1" });
    await userEvent.click(label);
    await expect(args.onEdgeClick).toHaveBeenCalledWith("c1->Account manager->a1");
    await waitFor(
      () => expect(body.getByRole("menu", { name: "Account manager" })).toBeVisible(),
      slow,
    );
    await expect(body.getByRole("menuitem", { name: "Remove link" })).toBeInTheDocument();
  },
};
