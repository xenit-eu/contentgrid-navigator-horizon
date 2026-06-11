import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProblemDetailError } from "@contentgrid/navigator-data";
import { EntityErrorState, type ErrorStateLabels } from "./error-state";

const labels: ErrorStateLabels = {
  defaultTitle: "Failed to load thing",
  defaultMessage: "Something unexpected happened.",
  forbiddenMessage: "You can't see this thing.",
  notFoundTitle: "Thing not found",
  notFoundMessage: "This thing doesn't exist.",
};

function problemError(problem: Record<string, unknown>) {
  return new ProblemDetailError(problem as never);
}

describe("EntityErrorState", () => {
  it("renders 'Access denied' for a 403 problem", () => {
    render(<EntityErrorState error={problemError({ status: 403 })} labels={labels} />);
    expect(screen.getByText("Access denied")).toBeInTheDocument();
    expect(screen.getByText("You can't see this thing.")).toBeInTheDocument();
  });

  it("renders the not-found labels for a 404 problem", () => {
    render(<EntityErrorState error={problemError({ status: 404 })} labels={labels} />);
    expect(screen.getByText("Thing not found")).toBeInTheDocument();
    expect(screen.getByText("This thing doesn't exist.")).toBeInTheDocument();
  });

  it("uses the problem title/detail for other problem statuses", () => {
    render(
      <EntityErrorState
        error={problemError({ status: 500, title: "Server exploded", detail: "Boom." })}
        labels={labels}
      />,
    );
    expect(screen.getByText("Server exploded")).toBeInTheDocument();
    expect(screen.getByText("Boom.")).toBeInTheDocument();
  });

  it("falls back to default labels when the problem has no title/detail", () => {
    render(<EntityErrorState error={problemError({ status: 500 })} labels={labels} />);
    expect(screen.getByText("Failed to load thing")).toBeInTheDocument();
    expect(screen.getByText("Something unexpected happened.")).toBeInTheDocument();
  });

  it("shows the message of a plain Error with the default title", () => {
    render(<EntityErrorState error={new Error("network down")} labels={labels} />);
    expect(screen.getByText("Failed to load thing")).toBeInTheDocument();
    expect(screen.getByText("network down")).toBeInTheDocument();
  });

  it("shows the default labels for unknown error values", () => {
    render(<EntityErrorState error="oops" labels={labels} />);
    expect(screen.getByText("Failed to load thing")).toBeInTheDocument();
    expect(screen.getByText("Something unexpected happened.")).toBeInTheDocument();
  });
});
