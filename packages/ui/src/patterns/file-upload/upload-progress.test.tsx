import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { UploadProgress } from "./upload-progress";

describe("UploadProgress", () => {
  it("holds the displayed progress at 99% until the upload completes", () => {
    render(<UploadProgress progress={100} />);
    expect(screen.getByText("99%")).toBeInTheDocument();
  });
});
