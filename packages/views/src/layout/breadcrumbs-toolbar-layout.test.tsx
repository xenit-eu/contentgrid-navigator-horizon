import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BreadCrumbsToolBarLayout } from "./breadcrumbs-toolbar-layout";
import { PAGE_GUTTER_X } from "./page-padding";

describe("BreadCrumbsToolBarLayout", () => {
  it("draws the breadcrumbs and the actions in one bar above the content", () => {
    render(
      <BreadCrumbsToolBarLayout
        breadcrumbs={<span>Home</span>}
        actions={<button type="button">Edit</button>}
      >
        <p>Page content</p>
      </BreadCrumbsToolBarLayout>,
    );

    const bar = screen.getByText("Home").parentElement?.parentElement;
    expect(bar).toContainElement(screen.getByRole("button", { name: "Edit" }));
    expect(bar).not.toContainElement(screen.getByText("Page content"));
    // At least 56px high, 8px above and below, the page's own side gutter.
    expect(bar).toHaveClass("min-h-14", "py-2", ...PAGE_GUTTER_X.split(" "));
  });

  it("leaves the bar out of the way of a page without actions", () => {
    render(
      <BreadCrumbsToolBarLayout breadcrumbs={<span>Home</span>}>
        <p>Page content</p>
      </BreadCrumbsToolBarLayout>,
    );
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
