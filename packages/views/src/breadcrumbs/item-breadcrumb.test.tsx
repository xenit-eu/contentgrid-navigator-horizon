import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { makeAllAttributeItem } from "@contentgrid/navigator-data/test-fixtures/hal/all-attribute-item";
import { Breadcrumb, BreadcrumbList } from "@contentgrid/ui";
import { createItemDetailTestHarness } from "../test-fixtures/item-detail-harness";
import { ItemBreadcrumb } from "./item-breadcrumb";

const LONG_TITLE = "Quarterly maintenance contract for the north warehouse site";

describe("ItemBreadcrumb", () => {
  it("cuts an item title over 40 characters, with the full title on hover", async () => {
    const { Wrapper } = createItemDetailTestHarness();
    render(
      <Breadcrumb>
        <BreadcrumbList>
          <ItemBreadcrumb entityItem={makeAllAttributeItem({ text: LONG_TITLE })} />
        </BreadcrumbList>
      </Breadcrumb>,
      { wrapper: Wrapper },
    );

    await userEvent.hover(screen.getByText("Quarterly maintenance contract for the n…"));
    expect(await screen.findByRole("tooltip")).toHaveTextContent(LONG_TITLE);
  });
});
