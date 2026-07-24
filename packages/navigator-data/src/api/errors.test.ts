import { describe, expect, it } from "vitest";
import { type ProblemDetail, ProblemDetailError } from "@contentgrid/problem-details";
import { extractFieldErrors, getErrorMessage } from "./errors";

describe("extractFieldErrors", () => {
  it("returns an empty array for non-ProblemDetailError", () => {
    expect(extractFieldErrors(new Error("plain error"))).toEqual([]);
    expect(extractFieldErrors("string error")).toEqual([]);
    expect(extractFieldErrors(null)).toEqual([]);
  });

  it("returns an empty array when problem detail has no errors field", () => {
    const pd: ProblemDetail = { status: 400, title: "Bad Request" };
    expect(extractFieldErrors(new ProblemDetailError(pd))).toEqual([]);
  });

  it("extracts field errors from a validation problem detail", () => {
    // Shape per ContentGrid platform: each sub-error extends ProblemDetail
    // and carries property (attribute name) + invalid_value.
    const pd = {
      status: 400,
      title: "Validation failed",
      errors: [
        { status: 422, title: "required", property: "name", invalid_value: null },
        {
          status: 422,
          title: "duplicate",
          detail: "must be unique",
          property: "email",
          invalid_value: "user@example.com",
        },
      ],
    };
    const result = extractFieldErrors(new ProblemDetailError(pd));
    expect(result).toEqual([
      { status: 422, title: "required", property: "name", invalid_value: null },
      {
        status: 422,
        title: "duplicate",
        detail: "must be unique",
        property: "email",
        invalid_value: "user@example.com",
      },
    ]);
  });

  it("returns an empty array when the server sends a malformed errors field (not an array)", () => {
    const pd = { status: 400, title: "Bad Request", errors: { property: "name" } };
    expect(extractFieldErrors(new ProblemDetailError(pd))).toEqual([]);
  });
});

describe("getErrorMessage", () => {
  it("returns the detail from a ProblemDetailError when present", () => {
    const pd: ProblemDetail = {
      status: 422,
      title: "Unprocessable",
      detail: "The name field is too long",
    };
    expect(getErrorMessage(new ProblemDetailError(pd))).toBe("The name field is too long");
  });

  it("falls back to title when detail is absent", () => {
    const pd: ProblemDetail = { status: 400, title: "Bad Request" };
    expect(getErrorMessage(new ProblemDetailError(pd))).toBe("Bad Request");
  });

  it("falls back to a generic message when both detail and title are absent (malformed problem detail)", () => {
    const pd = { status: 500 } as ProblemDetail;
    expect(getErrorMessage(new ProblemDetailError(pd))).toBe("An unexpected error occurred");
  });

  it("returns the message from a plain Error", () => {
    expect(getErrorMessage(new Error("network failure"))).toBe("network failure");
  });

  it("returns a generic message for unknown error types", () => {
    expect(getErrorMessage("oops")).toBe("An unexpected error occurred");
    expect(getErrorMessage(42)).toBe("An unexpected error occurred");
    expect(getErrorMessage(null)).toBe("An unexpected error occurred");
  });
});
