import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "./pagination";

describe("Pagination", () => {
  it("renders a nav with role=navigation", () => {
    render(<Pagination />);
    expect(screen.getByRole("navigation", { name: "pagination" })).toBeInTheDocument();
  });

  it("renders PaginationContent as a ul", () => {
    render(
      <Pagination>
        <PaginationContent data-testid="content" />
      </Pagination>,
    );
    expect(screen.getByTestId("content").tagName).toBe("UL");
  });

  it("renders PaginationItem as li", () => {
    render(
      <Pagination>
        <PaginationContent>
          <PaginationItem data-testid="item" />
        </PaginationContent>
      </Pagination>,
    );
    expect(screen.getByTestId("item").tagName).toBe("LI");
  });

  it("renders PaginationLink as an anchor", () => {
    render(
      <Pagination>
        <PaginationContent>
          <PaginationItem>
            <PaginationLink href="/page/2">2</PaginationLink>
          </PaginationItem>
        </PaginationContent>
      </Pagination>,
    );
    expect(screen.getByRole("link", { name: "2" })).toBeInTheDocument();
  });

  it("renders PaginationPrevious with Phosphor CaretLeft icon (svg)", () => {
    const { container } = render(
      <Pagination>
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious href="/page/1" />
          </PaginationItem>
        </PaginationContent>
      </Pagination>,
    );
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("renders PaginationNext with Phosphor CaretRight icon (svg)", () => {
    const { container } = render(
      <Pagination>
        <PaginationContent>
          <PaginationItem>
            <PaginationNext href="/page/3" />
          </PaginationItem>
        </PaginationContent>
      </Pagination>,
    );
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("renders PaginationEllipsis with Phosphor DotsThree icon (svg)", () => {
    const { container } = render(
      <Pagination>
        <PaginationContent>
          <PaginationItem>
            <PaginationEllipsis />
          </PaginationItem>
        </PaginationContent>
      </Pagination>,
    );
    expect(container.querySelector("svg")).toBeInTheDocument();
  });
});
