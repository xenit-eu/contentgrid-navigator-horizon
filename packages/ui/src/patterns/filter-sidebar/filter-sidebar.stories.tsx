import * as React from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "storybook/test";
import { FilterSidebar } from "./filter-sidebar";
import type { SearchProperty } from "./filter-sidebar";

const meta = {
  title: "Patterns/FilterSidebar",
  component: FilterSidebar,
} satisfies Meta<typeof FilterSidebar>;

export default meta;
type Story = StoryObj<typeof meta>;

const STATUS_PROP: SearchProperty = {
  name: "status",
  type: "string",
  prompt: "Status",
  options: { inline: ["active", "inactive", "pending"] },
};

const DATE_GT_PROP: SearchProperty = { name: "created_at~greater-than", type: "string" };
const DATE_LT_PROP: SearchProperty = { name: "created_at~less-than", type: "string" };
const DUE_GT_PROP: SearchProperty = { name: "due_date~greater-than-or-equal-to", type: "string" };
const DUE_LT_PROP: SearchProperty = { name: "due_date~less-than-or-equal-to", type: "string" };

const ALL_PROPS: SearchProperty[] = [
  STATUS_PROP,
  DATE_GT_PROP,
  DATE_LT_PROP,
  DUE_GT_PROP,
  DUE_LT_PROP,
];

/** Controlled wrapper to keep filter state. */
const SidebarDemo = ({
  filterProperties,
  initialFilters = {},
}: {
  filterProperties: SearchProperty[];
  initialFilters?: Record<string, string>;
}) => {
  const [filters, setFilters] = React.useState<Record<string, string>>(initialFilters);

  function handleFilterChange(key: string, value: string | undefined) {
    setFilters((prev) => {
      const next = { ...prev };
      if (value === undefined) {
        delete next[key];
      } else {
        next[key] = value;
      }
      return next;
    });
  }

  function handleClearAll() {
    setFilters({});
  }

  return (
    <FilterSidebar
      filterProperties={filterProperties}
      filters={filters}
      onFilterChange={handleFilterChange}
      onClearAll={handleClearAll}
    />
  );
};

export const Default: Story = {
  render: () => <SidebarDemo filterProperties={ALL_PROPS} />,
};

export const EnumOnly: Story = {
  render: () => <SidebarDemo filterProperties={[STATUS_PROP]} />,
};

export const DateRangeOnly: Story = {
  render: () => <SidebarDemo filterProperties={[DATE_GT_PROP, DATE_LT_PROP]} />,
};

export const WithActiveFilters: Story = {
  render: () => (
    <SidebarDemo
      filterProperties={ALL_PROPS}
      initialFilters={{
        status: "active",
        "created_at~greater-than": "2024-01-01T00:00:00Z",
      }}
    />
  ),
};

export const WithInteraction: Story = {
  tags: ["no-visual-test"],
  render: () => <SidebarDemo filterProperties={ALL_PROPS} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Filters")).toBeInTheDocument();
    await expect(canvas.getByText("Status")).toBeInTheDocument();
  },
};
