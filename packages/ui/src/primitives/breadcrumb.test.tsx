import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  Breadcrumb,
  BreadcrumbEllipsis,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "./breadcrumb";

describe("Breadcrumb", () => {
  it("renders a nav with aria-label breadcrumb", () => {
    const { container } = render(<Breadcrumb />);
    expect(container.querySelector("nav[aria-label='breadcrumb']")).toBeInTheDocument();
  });

  it("renders BreadcrumbList as an ol", () => {
    render(
      <Breadcrumb>
        <BreadcrumbList data-testid="list" />
      </Breadcrumb>,
    );
    expect(screen.getByTestId("list").tagName).toBe("OL");
  });

  it("renders BreadcrumbItem as li", () => {
    render(
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem data-testid="item" />
        </BreadcrumbList>
      </Breadcrumb>,
    );
    expect(screen.getByTestId("item").tagName).toBe("LI");
  });

  it("renders BreadcrumbLink as an anchor", () => {
    render(
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/home">Home</BreadcrumbLink>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>,
    );
    expect(screen.getByRole("link", { name: "Home" })).toBeInTheDocument();
  });

  it("renders BreadcrumbPage with aria-current=page", () => {
    render(
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbPage>Current</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>,
    );
    expect(screen.getByText("Current")).toHaveAttribute("aria-current", "page");
  });

  it("renders BreadcrumbSeparator with default Phosphor CaretRight icon (svg)", () => {
    const { container } = render(
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem />
          <BreadcrumbSeparator />
        </BreadcrumbList>
      </Breadcrumb>,
    );
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("renders BreadcrumbEllipsis with Phosphor DotsThree icon (svg)", () => {
    const { container } = render(
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbEllipsis />
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>,
    );
    expect(container.querySelector("svg")).toBeInTheDocument();
  });
});
