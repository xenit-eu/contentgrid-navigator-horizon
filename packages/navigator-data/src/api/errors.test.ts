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
    const pd = {
      status: 400,
      title: "Validation failed",
      errors: [
        { field: "name", message: "is required" },
        { field: "email", message: "is invalid" },
      ],
    };
    const result = extractFieldErrors(new ProblemDetailError(pd));
    expect(result).toEqual([
      { field: "name", message: "is required" },
      { field: "email", message: "is invalid" },
    ]);
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

  it("returns the message from a plain Error", () => {
    expect(getErrorMessage(new Error("network failure"))).toBe("network failure");
  });

  it("returns a generic message for unknown error types", () => {
    expect(getErrorMessage("oops")).toBe("An unexpected error occurred");
    expect(getErrorMessage(42)).toBe("An unexpected error occurred");
    expect(getErrorMessage(null)).toBe("An unexpected error occurred");
  });
});
