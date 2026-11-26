import { describe, expect, it } from "vitest";
import { formatFileSize } from "./format-file-size";

describe("formatFileSize", () => {
  it.each([
    [0, "0 B"],
    [512, "512 B"],
    [1024, "1 KB"],
    [421_888, "412 KB"],
    [1_048_000, "1023 KB"],
    [1_468_006, "1.4 MB"],
    [5 * 1024 * 1024, "5.0 MB"],
    [2.5 * 1024 * 1024 * 1024, "2.5 GB"],
  ])("formats %d bytes as %s in en-US", (bytes, expected) => {
    expect(formatFileSize(bytes, "en-US")).toBe(expected);
  });

  it("uses the locale's decimal separator from MB up", () => {
    expect(formatFileSize(1_468_006, "nl-BE")).toBe("1,4 MB");
    expect(formatFileSize(2.5 * 1024 ** 3, "nl-BE")).toBe("2,5 GB");
    expect(formatFileSize(421_888, "nl-BE")).toBe("412 KB");
  });

  it("moves to MB instead of rounding up to 1024 KB", () => {
    expect(formatFileSize(1024 * 1024 - 1, "en-US")).toBe("1.0 MB");
  });
});
