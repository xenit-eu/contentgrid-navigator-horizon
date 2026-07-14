import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ProblemDisplayModel } from "@contentgrid/navigator-data";
import { GenericProblemAlert } from "./generic-problem-alert";

describe("GenericProblemAlert", () => {
  it("renders status, title and detail for an unknown/opaque problem", () => {
    const model: ProblemDisplayModel = {
      kind: "unknown",
      status: 403,
      title: "Forbidden",
      detail: "no access",
    };
    render(<GenericProblemAlert model={model} />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("403")).toBeInTheDocument();
    expect(screen.getByText("Forbidden")).toBeInTheDocument();
    expect(screen.getByText("no access")).toBeInTheDocument();
  });

  it("omits the status badge when the model has no status (e.g. a plain Error)", () => {
    const model: ProblemDisplayModel = {
      kind: "unknown",
      title: "Something went wrong",
      detail: "network down",
    };
    render(<GenericProblemAlert model={model} />);
    expect(screen.queryByText(/^\d{3}$/)).not.toBeInTheDocument();
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
  });

  it("renders a notFound problem", () => {
    const model: ProblemDisplayModel = { kind: "notFound", status: 404, title: "Not found" };
    render(<GenericProblemAlert model={model} />);
    expect(screen.getByText("404")).toBeInTheDocument();
    expect(screen.getByText("Not found")).toBeInTheDocument();
  });

  it("renders a queryParameter problem", () => {
    const model: ProblemDisplayModel = {
      kind: "queryParameter",
      status: 400,
      title: "Bad filter",
      parameter: "total~gt",
      message: "not a decimal",
    };
    render(<GenericProblemAlert model={model} />);
    expect(screen.getByText("400")).toBeInTheDocument();
    expect(screen.getByText("Bad filter")).toBeInTheDocument();
  });
});
