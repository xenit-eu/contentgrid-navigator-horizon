import { describe, expect, it } from "vitest";
import { formatFileSize } from "./format-file-size";

describe("formatFileSize", () => {
  it("returns '0 Bytes' for zero", () => {
    expect(formatFileSize(0)).toBe("0 Bytes");
  });

  it("formats sub-kilobyte sizes in Bytes", () => {
    expect(formatFileSize(512)).toBe("512 Bytes");
  });

  it("uses base 1000 and drops trailing zeros", () => {
    expect(formatFileSize(2000)).toBe("2 KB");
    expect(formatFileSize(1024)).toBe("1.02 KB");
  });

  it("rounds to at most 2 decimals", () => {
    expect(formatFileSize(5 * 1024 * 1024)).toBe("5.24 MB");
  });
});
