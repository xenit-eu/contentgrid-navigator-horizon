import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { TruncatedText } from "./truncated-text";

describe("TruncatedText", () => {
  it("truncates text longer than maxCharLength and shows the full text on hover", async () => {
    render(<TruncatedText text="Annual maintenance contract" maxCharLength={7} />);
    // The trailing space at the cut is dropped before the ellipsis.
    await userEvent.hover(screen.getByText("Annual…"));
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Annual maintenance contract");
  });

  it("shows text within maxCharLength as it is, without a tooltip", async () => {
    render(<TruncatedText text="Annual" maxCharLength={6} />);
    await userEvent.hover(screen.getByText("Annual"));
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });
});
