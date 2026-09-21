import { describe, expect, it } from "vitest";
import { formatFileSize } from "./content-upload-field";

describe("formatFileSize", () => {
  it("formats 0 bytes as '0 B'", () => {
    expect(formatFileSize(0)).toBe("0 B");
  });

  it("formats sizes under 1 KB in bytes", () => {
    expect(formatFileSize(512)).toBe("512 B");
  });

  it("formats sizes under 1 MB in KB", () => {
    expect(formatFileSize(2048)).toBe("2.0 KB");
  });

  it("formats sizes at or above 1 MB in MB", () => {
    expect(formatFileSize(5 * 1024 * 1024)).toBe("5.0 MB");
  });

  it("formats sizes at or above 1 GB in GB", () => {
    expect(formatFileSize(2.5 * 1024 * 1024 * 1024)).toBe("2.5 GB");
  });

  it("does not grow a TB tier past GB", () => {
    expect(formatFileSize(5000 * 1024 * 1024 * 1024)).toBe("5000.0 GB");
  });
});
