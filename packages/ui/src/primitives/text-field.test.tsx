import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TextField } from "./text-field";

describe("TextField", () => {
  it("renders label and input", () => {
    render(<TextField label="Invoice number" />);
    expect(screen.getByText("Invoice number")).toBeInTheDocument();
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it("shows required asterisk when required prop is set", () => {
    render(<TextField label="Name" required />);
    expect(screen.getByText("*")).toBeInTheDocument();
  });

  it("does not show asterisk when required is not set", () => {
    render(<TextField label="Name" />);
    expect(screen.queryByText("*")).not.toBeInTheDocument();
  });

  it("shows error message when error prop is set", () => {
    const { container } = render(<TextField label="Email" error="Invalid email" state="error" />);
    expect(screen.getByText("Invalid email")).toBeInTheDocument();
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("shows no error icon in default state without error", () => {
    const { container } = render(<TextField label="Email" />);
    expect(container.querySelector("svg")).not.toBeInTheDocument();
  });

  it("input has disabled attribute when state is disabled", () => {
    render(<TextField label="Created by" value="system" state="disabled" />);
    expect(screen.getByRole("textbox")).toBeDisabled();
  });

  it("renders placeholder text", () => {
    render(<TextField label="Ref" placeholder="Enter reference" />);
    expect(screen.getByPlaceholderText("Enter reference")).toBeInTheDocument();
  });

  it("renders helpText when provided without error", () => {
    render(<TextField label="Password" helpText="At least 8 characters" />);
    expect(screen.getByText("At least 8 characters")).toBeInTheDocument();
  });

  it("shows error over helpText when both are provided with error state", () => {
    render(<TextField label="Email" helpText="Your email" error="Not valid" state="error" />);
    expect(screen.getByText("Not valid")).toBeInTheDocument();
  });

  it("marks input as aria-invalid when in error state", () => {
    render(<TextField label="Email" state="error" error="Bad" />);
    expect(screen.getByRole("textbox")).toHaveAttribute("aria-invalid", "true");
  });

  it("renders icon slot when icon prop is provided", () => {
    render(<TextField label="Search" icon={<span data-testid="custom-icon" />} />);
    expect(screen.getByTestId("custom-icon")).toBeInTheDocument();
  });
});
