import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import {
  RecordingNavigationProvider,
  createRecordingNavigation,
} from "../navigation/recording-navigation";
import { NotFoundView } from "./not-found-view";

describe("NotFoundView", () => {
  it("opens home through the navigation context", async () => {
    const recording = createRecordingNavigation();
    render(
      <RecordingNavigationProvider recording={recording}>
        <NotFoundView />
      </RecordingNavigationProvider>,
    );

    expect(screen.getByText("This page doesn't exist.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Back to home" }));

    expect(recording.calls).toEqual([{ method: "openHome", args: [] }]);
  });
});
