import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "./accordion";

const meta = {
  title: "Primitives/Accordion",
  component: Accordion,
  args: { type: "single" },
} satisfies Meta<typeof Accordion>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Accordion type="single" collapsible className="w-96">
      <AccordionItem value="item-1">
        <AccordionTrigger>Is it accessible?</AccordionTrigger>
        <AccordionContent>Yes, it adheres to the WAI-ARIA design pattern.</AccordionContent>
      </AccordionItem>
      <AccordionItem value="item-2">
        <AccordionTrigger>Is it styled?</AccordionTrigger>
        <AccordionContent>
          Yes, it comes with default styles matching the design system.
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  ),
};

export const WithInteraction: Story = {
  tags: ["no-visual-test"],
  render: () => (
    <Accordion type="single" collapsible className="w-96">
      <AccordionItem value="item-1">
        <AccordionTrigger>Invoices</AccordionTrigger>
        <AccordionContent>Three linked invoices.</AccordionContent>
      </AccordionItem>
    </Accordion>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole("button", { name: /invoices/i });
    await expect(canvas.queryByText(/three linked invoices/i)).not.toBeInTheDocument();
    await userEvent.click(trigger);
    await expect(canvas.getByText(/three linked invoices/i)).toBeVisible();
    await userEvent.click(trigger);
    await waitFor(() =>
      expect(canvas.queryByText(/three linked invoices/i)).not.toBeInTheDocument(),
    );
  },
};
