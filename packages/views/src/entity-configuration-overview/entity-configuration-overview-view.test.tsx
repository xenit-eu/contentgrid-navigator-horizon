import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { useLoadedProfileEntities } from "@contentgrid/navigator-data";
import { makeProfileEntity } from "@contentgrid/navigator-data/test-fixtures/hal/profile-entity";
import { createItemDetailTestHarness } from "../test-fixtures/item-detail-harness";
import { EntityConfigurationOverviewView } from "./entity-configuration-overview-view";

vi.mock("@contentgrid/navigator-data", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@contentgrid/navigator-data")>();
  return { ...actual, useLoadedProfileEntities: vi.fn() };
});

describe("EntityConfigurationOverviewView", () => {
  it("opens an entity's configuration through the navigation context", async () => {
    vi.mocked(useLoadedProfileEntities).mockReturnValue({
      profiles: [
        makeProfileEntity(
          {
            name: "invoice",
            title: "Invoice",
            _links: {
              self: { href: "https://example.com/profile/invoices" },
              describes: [
                { href: "https://example.com/invoices", name: "collection", title: "Invoices" },
              ],
            },
          },
          "https://example.com/profile/invoices",
          "invoice",
        ),
      ],
      isLoading: false,
    } as unknown as ReturnType<typeof useLoadedProfileEntities>);
    const { Wrapper, recording } = createItemDetailTestHarness();
    render(<EntityConfigurationOverviewView />, { wrapper: Wrapper });

    await userEvent.click(screen.getByRole("button", { name: "Configure Invoices" }));

    expect(recording.calls).toEqual([{ method: "openEntityConfiguration", args: ["invoice"] }]);
  });
});
