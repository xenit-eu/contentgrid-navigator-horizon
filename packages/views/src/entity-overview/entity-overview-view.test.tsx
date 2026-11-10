import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { useLoadedProfileEntities } from "@contentgrid/navigator-data";
import { makeProfileEntity } from "@contentgrid/navigator-data/test-fixtures/hal/profile-entity";
import {
  RecordingNavigationProvider,
  createRecordingNavigation,
} from "../navigation/recording-navigation";
import { EntityOverviewView } from "./entity-overview-view";

vi.mock("@contentgrid/features/layout", () => ({ EntityIconBadge: () => null }));

vi.mock("@contentgrid/navigator-data", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@contentgrid/navigator-data")>();
  return {
    ...actual,
    useLoadedProfileEntities: vi.fn(),
    useEntityItemCollection: () => ({ data: { totalItems: { count: 3 } } }),
  };
});

describe("EntityOverviewView", () => {
  it("opens an entity's collection through the navigation context", async () => {
    vi.mocked(useLoadedProfileEntities).mockReturnValue({
      profiles: [
        makeProfileEntity(
          { name: "invoice", title: "Invoice", description: "" },
          "https://example.com/profile/invoices",
          "invoice",
        ),
      ],
      isLoading: false,
    } as unknown as ReturnType<typeof useLoadedProfileEntities>);
    const recording = createRecordingNavigation();
    render(
      <RecordingNavigationProvider recording={recording}>
        <EntityOverviewView />
      </RecordingNavigationProvider>,
    );

    await userEvent.click(screen.getByText("3"));

    expect(recording.calls).toEqual([{ method: "openEntityItemCollection", args: ["invoice"] }]);
  });
});
