import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ProfileEntity } from "@contentgrid/navigator-data";
import { EntityItemCollectionTitle } from "./entity-item-collection-title";

// Unfiltered, the title only reads the plural name.
const profile = { pluralName: "Invoices" } as ProfileEntity;
const pill = () => document.querySelector("[data-slot='collection-count']");

describe("EntityItemCollectionTitle", () => {
  it("shows the plural name as the page heading with the count beside it", () => {
    render(
      <EntityItemCollectionTitle
        profile={profile}
        total={{ count: 1284, isEstimated: false }}
        isFiltered={false}
      />,
    );

    expect(screen.getByRole("heading", { level: 1, name: "Invoices" })).toBeInTheDocument();
    expect(pill()?.textContent).toBe("1 284");
    expect(screen.queryByText(/Filtered from/)).not.toBeInTheDocument();
  });

  it("words an estimate as 'about'", () => {
    render(
      <EntityItemCollectionTitle
        profile={profile}
        total={{ count: 1204, isEstimated: true }}
        isFiltered={false}
      />,
    );

    expect(pill()?.textContent).toBe("about 1 204");
  });

  it("shows no pill when the count is unavailable", () => {
    render(<EntityItemCollectionTitle profile={profile} total={undefined} isFiltered={false} />);

    expect(screen.getByRole("heading", { level: 1, name: "Invoices" })).toBeInTheDocument();
    expect(pill()).toBeNull();
  });
});
