import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { makeProfileEntity } from "@contentgrid/navigator-data/test-fixtures/hal/profile-entity";
import { Breadcrumb, BreadcrumbList } from "@contentgrid/ui";
import { createItemDetailTestHarness } from "../test-fixtures/item-detail-harness";
import { CollectionBreadcrumb } from "./collection-breadcrumb";

const LONG_NAME = "Purchase order confirmations from external suppliers";

describe("CollectionBreadcrumb", () => {
  it("cuts an entity name over 40 characters, with the full name on hover", async () => {
    const profileEntity = makeProfileEntity(
      {
        name: "confirmation",
        title: "Confirmation",
        _links: {
          self: { href: "https://example.com/profile/confirmations" },
          describes: [
            { href: "https://example.com/confirmations", name: "collection", title: LONG_NAME },
          ],
        },
      },
      "https://example.com/profile/confirmations",
      "confirmation",
    );
    const { Wrapper } = createItemDetailTestHarness();
    render(
      <Breadcrumb>
        <BreadcrumbList>
          <CollectionBreadcrumb profileEntity={profileEntity} />
        </BreadcrumbList>
      </Breadcrumb>,
      { wrapper: Wrapper },
    );

    await userEvent.hover(screen.getByText("Purchase order confirmations from extern…"));
    expect(await screen.findByRole("tooltip")).toHaveTextContent(LONG_NAME);
  });
});
