import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
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

describe("Alert", () => {
  it("renders with role=status for the info tone", () => {
    render(
      <Alert tone="info">
        <AlertTitle>Title</AlertTitle>
      </Alert>,
    );
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("renders with role=alert for the warning and error tones", () => {
    const { rerender } = render(
      <Alert tone="warning">
        <AlertTitle>Title</AlertTitle>
      </Alert>,
    );
    expect(screen.getByRole("alert")).toBeInTheDocument();

    rerender(
      <Alert tone="error">
        <AlertTitle>Title</AlertTitle>
      </Alert>,
    );
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("renders title and description content", () => {
    render(
      <Alert tone="error">
        <AlertTitle>Validation error</AlertTitle>
        <AlertDescription>Something went wrong</AlertDescription>
      </Alert>,
    );
    expect(screen.getByText("Validation error")).toBeInTheDocument();
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
  });

  it("does not render a dismiss button when onClose is omitted", () => {
    render(
      <Alert tone="info">
        <AlertTitle>Title</AlertTitle>
      </Alert>,
    );
    expect(screen.queryByRole("button", { name: "Dismiss" })).not.toBeInTheDocument();
  });

  it("renders a dismiss button that fires onClose when provided", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <Alert tone="info" onClose={onClose}>
        <AlertTitle>Title</AlertTitle>
      </Alert>,
    );
    await user.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("renders an AlertButton that fires its own onClick and inherits the alert's tone", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <Alert tone="error">
        <AlertActionSection>
          <AlertButton onClick={onClick}>View conflicting item</AlertButton>
        </AlertActionSection>
      </Alert>,
    );
    const button = screen.getByRole("button", { name: "View conflicting item" });
    expect(button.tagName).toBe("BUTTON");
    await user.click(button);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("renders an AlertLinkButton as a real link that opens href in a new tab", () => {
    render(
      <Alert tone="error">
        <AlertLinkButton href="https://docs.example.com/problem" label="View problem type" />
      </Alert>,
    );
    const link = screen.getByRole("link", { name: "View problem type" });
    expect(link).toHaveAttribute("href", "https://docs.example.com/problem");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("renders an AlertList with one AlertListItem per entry, each with its own action", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <Alert tone="error">
        <AlertList>
          <AlertListItem>Mandatory field</AlertListItem>
          <AlertListItem>
            Duplicate <AlertButton onClick={onClick}>View conflicting item</AlertButton>
          </AlertListItem>
        </AlertList>
      </Alert>,
    );
    expect(screen.getByText("Mandatory field").closest("li")).toBeInTheDocument();
    const button = screen.getByRole("button", { name: "View conflicting item" });
    expect(button.closest("li")).toHaveTextContent("Duplicate");
    await user.click(button);
    expect(onClick).toHaveBeenCalledOnce();
  });
});
