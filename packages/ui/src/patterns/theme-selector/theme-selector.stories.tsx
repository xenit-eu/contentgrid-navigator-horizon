import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { ENTITY_COLOR_THEMES, ThemeSelector } from "./theme-selector";

const meta = {
  title: "Patterns/ThemeSelector",
  component: ThemeSelector,
  tags: ["autodocs"],
} satisfies Meta<typeof ThemeSelector>;

export default meta;
type Story = StoryObj<typeof meta>;

function ControlledThemeSelector() {
  const [value, setValue] = useState<string | undefined>(undefined);
  return (
    <ThemeSelector
      themes={ENTITY_COLOR_THEMES}
      value={value}
      onValueChange={setValue}
      onApply={fn()}
    />
  );
}

export const Default: Story = {
  render: () => <ControlledThemeSelector />,
};

export const WithInteraction: Story = {
  tags: ["no-visual-test"],
  render: () => <ControlledThemeSelector />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Theme" }));

    const applyButton = await waitFor(() =>
      within(document.body).getByRole("button", { name: "Apply theme" }),
    );
    expect(applyButton).toBeDisabled();

    const vibrantOption = within(document.body).getByRole("radio", { name: /vibrant/i });
    await userEvent.click(vibrantOption);
    expect(applyButton).toBeEnabled();
  },
};
