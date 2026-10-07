import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { SearchSuggestionsPopover } from "./search-suggestions-popover";
import { PopoverHarness, readyGroups, textChips } from "./search-suggestions-popover.story-helpers";

const meta = {
  title: "Patterns/SearchSuggestionsPopover",
  component: SearchSuggestionsPopover,
} satisfies Meta<typeof SearchSuggestionsPopover>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithInteraction: Story = {
  tags: ["no-visual-test"],
  args: {
    open: true,
    onOpenChange: () => undefined,
    chips: [],
    groups: [],
    onSelectChip: () => undefined,
    onSelectItem: () => undefined,
    renderAnchor: () => null,
  },
  render: () => <PopoverHarness chips={textChips} groups={readyGroups} />,
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);

    // One step: a Radix popover can be dismissed by the harness at a step() boundary.
    await step("navigate chips and items with the keyboard, select, then close", async () => {
      const input = canvas.getByRole("combobox", { name: "Search" });
      await userEvent.click(input);
      await expect(body.getByRole("region", { name: "Suggestions" })).toBeInTheDocument();

      const activeText = () =>
        canvasElement.ownerDocument.getElementById(
          input.getAttribute("aria-activedescendant") ?? "",
        )?.textContent ?? "";

      await userEvent.keyboard("{ArrowDown}");
      await expect(activeText()).toContain("Title");
      await userEvent.keyboard("{ArrowRight}");
      await expect(activeText()).toContain("Notes");
      await userEvent.keyboard("{ArrowDown}");
      await expect(activeText()).toBe("Alpha invoice");
      await userEvent.keyboard("{Enter}");
      await waitFor(() =>
        expect(body.queryByRole("region", { name: "Suggestions" })).not.toBeInTheDocument(),
      );

      await userEvent.type(input, "p");
      await expect(body.getByRole("region", { name: "Suggestions" })).toBeInTheDocument();
      await userEvent.keyboard("{Escape}");
      await waitFor(() =>
        expect(body.queryByRole("region", { name: "Suggestions" })).not.toBeInTheDocument(),
      );
    });
  },
};
