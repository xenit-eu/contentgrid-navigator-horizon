import { describe, expect, it } from "vitest";
import { ProblemDetailError } from "@contentgrid/problem-details";
import { createProblemHandler } from "../../../test-fixtures/msw/handlers";
import { server } from "../../../test-setup";
import { noopSupplier } from "../../hooks/test-utils";
import { createContentClient } from "../client";
import { ContentGridProblemType, RENDITION_INVALID_CONVERSION } from "./constants";
import {
  getValidationFieldErrors,
  isProblemDetailError,
  isProblemOfType,
  isProblemWithStatus,
  isValidationProblem,
} from "./guards";
import type { RequiredRelationProblem, ValidationProblemDetail } from "./index";

const requiredRelation = new ProblemDetailError<RequiredRelationProblem>({
  type: ContentGridProblemType.INTEGRITY_REQUIRED_RELATION,
  status: 409,
  title: "Relation is required",
  affected_relation: "https://app/orders/1/customer",
});

const validation = new ProblemDetailError<ValidationProblemDetail>({
  type: ContentGridProblemType.VALIDATION,
  status: 400,
  title: "Validation error",
  errors: [
    {
      type: ContentGridProblemType.VALIDATION_REQUIRED,
      title: "Mandatory field",
      field: "name",
    },
  ],
});

// An opaque, typeless problem (e.g. a masked 403 or Spring 500).
const opaque = new ProblemDetailError({ status: 403, title: "Forbidden" });

describe("problem-detail guards", () => {
  it("isProblemDetailError distinguishes ProblemDetailError from plain Error", () => {
    expect(isProblemDetailError(requiredRelation)).toBe(true);
    expect(isProblemDetailError(new Error("template absent"))).toBe(false);
    expect(isProblemDetailError(null)).toBe(false);
  });

  it("isProblemOfType narrows to the matching member", () => {
    expect(
      isProblemOfType(requiredRelation, ContentGridProblemType.INTEGRITY_REQUIRED_RELATION),
    ).toBe(true);
    expect(isProblemOfType(requiredRelation, ContentGridProblemType.VALIDATION)).toBe(false);

    if (isProblemOfType(requiredRelation, ContentGridProblemType.INTEGRITY_REQUIRED_RELATION)) {
      // Type-level: `affected_relation` is accessible after narrowing.
      expect(requiredRelation.problemDetail.affected_relation).toBe(
        "https://app/orders/1/customer",
      );
    }
  });

  it("isProblemWithStatus works for opaque, typeless problems", () => {
    expect(isProblemWithStatus(opaque, 403)).toBe(true);
    expect(isProblemWithStatus(requiredRelation, 409)).toBe(true);
    expect(isProblemWithStatus(requiredRelation, 412)).toBe(false);
    expect(isProblemWithStatus(new Error("x"), 500)).toBe(false);
  });

  it("isValidationProblem + getValidationFieldErrors extract typed field errors", () => {
    expect(isValidationProblem(validation)).toBe(true);
    expect(getValidationFieldErrors(validation)).toEqual([
      {
        type: ContentGridProblemType.VALIDATION_REQUIRED,
        title: "Mandatory field",
        field: "name",
      },
    ]);
    expect(getValidationFieldErrors(requiredRelation)).toEqual([]);
    expect(getValidationFieldErrors(new Error("x"))).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// RENDITION_INVALID_CONVERSION — a problem type from the rendition service,
// not the ContentGrid Application API. Exercised against a real MSW-served
// response (not a hand-constructed ProblemDetailError like the fixtures
// above) so the test proves the guard narrows what checkResponse actually
// produces for this problem type, the same as any other.
// ---------------------------------------------------------------------------

describe("isProblemOfType — RENDITION_INVALID_CONVERSION (MSW-served)", () => {
  const RENDITION_URL = "https://api.example.com/renditions/get/pdf";

  it("narrows a rendition service problem response served over the network", async () => {
    server.use(
      createProblemHandler({
        method: "get",
        url: RENDITION_URL,
        status: 422,
        title: "Cannot convert to PDF",
        type: RENDITION_INVALID_CONVERSION,
      }),
    );

    const contentFetch = createContentClient(noopSupplier);
    const caught = await contentFetch(new Request(RENDITION_URL)).catch((error: unknown) => error);

    expect(isProblemDetailError(caught)).toBe(true);
    expect(isProblemOfType(caught, RENDITION_INVALID_CONVERSION)).toBe(true);
    expect(isProblemOfType(caught, ContentGridProblemType.VALIDATION)).toBe(false);
  });
});
