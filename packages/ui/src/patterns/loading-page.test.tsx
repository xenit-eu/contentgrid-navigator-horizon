import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LoadingPage } from "./loading-page";

describe("LoadingPage", () => {
  it("renders a header skeleton plus 5 row skeletons by default", () => {
    const { container } = render(<LoadingPage />);
    expect(container.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(6);
  });

  it("renders the configured number of row skeletons", () => {
    const { container } = render(<LoadingPage rows={2} />);
    expect(container.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(3);
  });
});
