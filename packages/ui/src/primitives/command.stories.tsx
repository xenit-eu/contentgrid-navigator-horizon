import type { Meta, StoryObj } from "@storybook/react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "./command";

const meta = {
  title: "Primitives/Command",
  component: Command,
} satisfies Meta<typeof Command>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Command className="w-72 rounded-lg border shadow-md">
      <CommandInput placeholder="Search…" />
      <CommandList>
        <CommandEmpty>No matches</CommandEmpty>
        <CommandGroup heading="Status">
          <CommandItem>Draft</CommandItem>
          <CommandItem>Published</CommandItem>
          <CommandItem>Archived</CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Other">
          <CommandItem disabled>Deleted</CommandItem>
        </CommandGroup>
      </CommandList>
    </Command>
  ),
};
