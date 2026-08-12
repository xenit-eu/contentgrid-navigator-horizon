import type { Meta, StoryObj } from "@storybook/react";
import {
  Alert,
  AlertActionSection,
  AlertButton,
  AlertDescription,
  AlertLinkButton,
  AlertList,
  AlertListItem,
  AlertTitle,
} from "./alert";

const meta = {
  title: "Primitives/Alert",
  component: Alert,
  tags: ["autodocs"],
} satisfies Meta<typeof Alert>;

export default meta;
type Story = StoryObj<typeof meta>;

export const InfoAlert: Story = {
  render: (args) => (
    <Alert {...args}>
      <AlertTitle>Heads up</AlertTitle>
      <AlertDescription>
        This document is read-only. Contact your administrator to make changes.
      </AlertDescription>
    </Alert>
  ),
  args: { tone: "info" },
};

export const WarningAlert: Story = {
  render: (args) => (
    <Alert {...args}>
      <AlertTitle>Careful</AlertTitle>
      <AlertDescription>
        This action cannot be undone. Please review your changes carefully.
      </AlertDescription>
    </Alert>
  ),
  args: { tone: "warning" },
};

export const ErrorAlert: Story = {
  render: (args) => (
    <Alert {...args}>
      <AlertTitle>400 Validation error</AlertTitle>
      <AlertDescription>One or more fields failed validation.</AlertDescription>
    </Alert>
  ),
  args: { tone: "error" },
};

export const Closable: Story = {
  render: (args) => (
    <Alert {...args}>
      <AlertTitle>Dismissible</AlertTitle>
      <AlertDescription>Click the × to dismiss this alert.</AlertDescription>
    </Alert>
  ),
  args: { tone: "info", onClose: () => {} },
};

export const WithAction: Story = {
  render: (args) => (
    <Alert {...args}>
      <AlertTitle>409 Conflict</AlertTitle>
      <AlertDescription>This value already exists on another item.</AlertDescription>
      <AlertActionSection>
        <AlertButton>View conflicting item</AlertButton>
      </AlertActionSection>
    </Alert>
  ),
  args: { tone: "error", onClose: () => {} },
};

export const WithMultiAction: Story = {
  render: (args) => (
    <Alert {...args}>
      <AlertTitle>404 Not Found</AlertTitle>
      <AlertDescription>This value is not found.</AlertDescription>
      <AlertActionSection>
        <AlertButton>Find Value</AlertButton>
        <AlertButton variant="ghost">Secondary action</AlertButton>
      </AlertActionSection>
    </Alert>
  ),
  args: { tone: "error", onClose: () => {} },
};

export const WithList: Story = {
  render: (args) => (
    <Alert {...args}>
      <AlertTitle>400 Validation error</AlertTitle>
      <AlertList>
        <AlertListItem>
          <span>
            <span className="font-medium">name: </span>Mandatory field
          </span>
        </AlertListItem>
        <AlertListItem>
          <span>
            <span className="font-medium">product_code: </span>Duplicate
          </span>
          <AlertButton>View conflicting item</AlertButton>
        </AlertListItem>
      </AlertList>
    </Alert>
  ),
  args: { tone: "error" },
};

export const WithTitleLink: Story = {
  render: (args) => (
    <Alert {...args}>
      <div className="flex items-center justify-between gap-2">
        <AlertTitle>400 input/validation/required</AlertTitle>
        <AlertLinkButton
          href="https://docs.contentgrid.com/reference/app-api/problem-types/"
          label="View problem type documentation"
        />
      </div>
      <AlertDescription>Mandatory field &quot;name&quot; is missing.</AlertDescription>
    </Alert>
  ),
  args: { tone: "error" },
};
