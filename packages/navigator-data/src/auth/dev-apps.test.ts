import { describe, expect, it } from "vitest";
import { getDefaultExtractServiceUrl, getDefaultRenditionUri } from "./dev-apps";

describe("getDefaultExtractServiceUrl", () => {
  it("returns the real production extract URL when mock is off", () => {
    expect(getDefaultExtractServiceUrl("production", false)).toBe(
      "https://extract.eu-west-1.contentgrid.cloud/extract/",
    );
  });

  it("returns the mock production extract URL when mock is on", () => {
    expect(getDefaultExtractServiceUrl("production", true)).toBe(
      "https://mock-extract.eu-west-1.contentgrid.cloud/extract/",
    );
  });

  it("returns the real sandbox extract URL when mock is off", () => {
    expect(getDefaultExtractServiceUrl("sandbox", false)).toBe(
      "https://extract.sandbox.contentgrid.cloud/extract/",
    );
  });

  it("returns the mock sandbox extract URL when mock is on", () => {
    expect(getDefaultExtractServiceUrl("sandbox", true)).toBe(
      "https://mock-extract.sandbox.contentgrid.cloud/extract/",
    );
  });
});

describe("getDefaultRenditionUri", () => {
  it("returns the production rendition URI", () => {
    expect(getDefaultRenditionUri("production")).toBe(
      "https://renditions.eu-west-1.contentgrid.cloud/renditions/get/pdf{?url}",
    );
  });

  it("returns the sandbox rendition URI", () => {
    expect(getDefaultRenditionUri("sandbox")).toBe(
      "https://renditions.sandbox.contentgrid.cloud/renditions/get/pdf{?url}",
    );
  });
});
