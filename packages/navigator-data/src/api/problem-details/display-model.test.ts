import { describe, expect, it } from "vitest";
import { ProblemDetailError } from "@contentgrid/problem-details";
import { ContentGridProblemType } from "./constants";
import { toProblemDisplayModel } from "./display-model";
import type {
  BlindRelationOverwriteProblem,
  FilterFormatProblem,
  ForbiddenHeaderProblem,
  NotFoundEntityItemProblem,
  RequiredRelationProblem,
  SortTargetProblem,
  UnsatisfiedVersionProblem,
  ValidationProblemDetail,
} from "./index";

describe("toProblemDisplayModel", () => {
  it("maps a plain Error to kind: unknown", () => {
    expect(toProblemDisplayModel(new Error("network down"))).toEqual({
      kind: "unknown",
      title: "Something went wrong",
      detail: "network down",
    });
  });

  it("maps a non-Error thrown value to kind: unknown", () => {
    expect(toProblemDisplayModel("oops")).toEqual({
      kind: "unknown",
      title: "Something went wrong",
      detail: "oops",
    });
  });

  it("maps an opaque problem (no type, e.g. masked 403) to kind: unknown", () => {
    const error = new ProblemDetailError({ status: 403, title: "Forbidden" });
    expect(toProblemDisplayModel(error)).toEqual({
      kind: "unknown",
      status: 403,
      title: "Forbidden",
      detail: undefined,
    });
  });

  it("maps a validation problem with every field-error kind", () => {
    const error = new ProblemDetailError<ValidationProblemDetail>({
      type: ContentGridProblemType.VALIDATION,
      status: 400,
      title: "Validation error",
      errors: [
        {
          type: ContentGridProblemType.VALIDATION_REQUIRED,
          title: "Mandatory field",
          field: "name",
        },
        {
          type: ContentGridProblemType.VALIDATION_TYPE,
          title: "Wrong type",
          field: "total",
          expected_type: "long",
          actual_type: "list",
        },
        {
          type: ContentGridProblemType.VALIDATION_TYPE_FORMAT,
          title: "Bad format",
          field: "invoice_date",
          expected_type: "datetime",
          format_error: "not RFC3339",
        },
        {
          type: ContentGridProblemType.VALIDATION_NO_CONTENT,
          title: "No content",
          field: "content",
        },
        {
          type: ContentGridProblemType.VALIDATION_DUPLICATE,
          title: "Duplicate",
          field: "product_code",
          conflicting_item: "https://app/products/1",
        },
        {
          type: ContentGridProblemType.VALIDATION_ALLOWED_VALUES,
          title: "Not allowed",
          field: "category",
          allowed_values: ["a", "b"],
        },
        {
          type: ContentGridProblemType.VALIDATION_PATTERN,
          title: "Bad pattern",
          field: "mimetype",
          pattern: "^image/.*$",
        },
        {
          type: ContentGridProblemType.VALIDATION_MISSING_RELATION_TARGET,
          title: "Missing target",
          field: "person",
          missing_item: "https://app/persons/1",
        },
        // Forward-compat: an unrecognized field-error type shouldn't throw.
        {
          type: "https://contentgrid.cloud/problems/input/validation/future-kind" as never,
          title: "Future",
        },
      ],
    });

    const model = toProblemDisplayModel(error);
    expect(model.kind).toBe("validation");
    if (model.kind !== "validation") throw new Error("unreachable");
    expect(model.fields).toEqual([
      { kind: "required", field: "name", message: "Mandatory field" },
      {
        kind: "type",
        field: "total",
        message: "Wrong type",
        expectedType: "long",
        actualType: "list",
      },
      {
        kind: "typeFormat",
        field: "invoice_date",
        message: "Bad format",
        expectedType: "datetime",
        formatError: "not RFC3339",
      },
      { kind: "noContent", field: "content", message: "No content" },
      {
        kind: "duplicate",
        field: "product_code",
        message: "Duplicate",
        conflictingItem: "https://app/products/1",
      },
      {
        kind: "allowedValues",
        field: "category",
        message: "Not allowed",
        allowedValues: ["a", "b"],
      },
      { kind: "pattern", field: "mimetype", message: "Bad pattern", pattern: "^image/.*$" },
      {
        kind: "missingRelationTarget",
        field: "person",
        message: "Missing target",
        missingItem: "https://app/persons/1",
      },
      { kind: "unknownField", field: undefined, message: "Future" },
    ]);
  });

  it("maps a query-parameter problem (filter format) to kind: queryParameter", () => {
    const error = new ProblemDetailError<FilterFormatProblem>({
      type: ContentGridProblemType.QUERY_FILTER_FORMAT,
      status: 400,
      title: "Bad filter",
      query_parameter: "total~gt",
      expected_type: "decimal",
      format_error: "not a decimal",
    });
    expect(toProblemDisplayModel(error)).toEqual({
      kind: "queryParameter",
      status: 400,
      title: "Bad filter",
      detail: undefined,
      type: ContentGridProblemType.QUERY_FILTER_FORMAT,
      parameter: "total~gt",
      message: "not a decimal",
    });
  });

  it("maps a sort-target problem (no format_error) to kind: queryParameter", () => {
    const error = new ProblemDetailError<SortTargetProblem>({
      type: ContentGridProblemType.QUERY_SORT_TARGET,
      status: 400,
      title: "Bad sort target",
      query_parameter: "_sort",
      target_name: "nonexistent_field",
    });
    expect(toProblemDisplayModel(error)).toMatchObject({
      kind: "queryParameter",
      parameter: "_sort",
      message: "Unsupported sort target: nonexistent_field",
    });
  });

  it("maps a header problem to kind: header", () => {
    const error = new ProblemDetailError<ForbiddenHeaderProblem>({
      type: ContentGridProblemType.REQUEST_FORBIDDEN_HEADER,
      status: 400,
      title: "Forbidden header",
      header: "X-Custom",
    });
    expect(toProblemDisplayModel(error)).toEqual({
      kind: "header",
      status: 400,
      title: "Forbidden header",
      detail: undefined,
      type: ContentGridProblemType.REQUEST_FORBIDDEN_HEADER,
      header: "X-Custom",
    });
  });

  it("maps an unsatisfied-version problem to kind: unsatisfiedVersion", () => {
    const error = new ProblemDetailError<UnsatisfiedVersionProblem>({
      type: ContentGridProblemType.UNSATISFIED_VERSION,
      status: 412,
      title: "Version conflict",
      actual_version: 'W/"2"',
    });
    expect(toProblemDisplayModel(error)).toEqual({
      kind: "unsatisfiedVersion",
      status: 412,
      title: "Version conflict",
      detail: undefined,
      type: ContentGridProblemType.UNSATISFIED_VERSION,
      actualVersion: 'W/"2"',
    });
  });

  it("maps a not-found problem to kind: notFound", () => {
    const error = new ProblemDetailError<NotFoundEntityItemProblem>({
      type: ContentGridProblemType.NOT_FOUND_ENTITY_ITEM,
      status: 404,
      title: "Not found",
    });
    expect(toProblemDisplayModel(error)).toEqual({
      kind: "notFound",
      status: 404,
      title: "Not found",
      detail: undefined,
      type: ContentGridProblemType.NOT_FOUND_ENTITY_ITEM,
    });
  });

  it("maps a blind-relation-overwrite problem to kind: blindRelationOverwrite", () => {
    const error = new ProblemDetailError<BlindRelationOverwriteProblem>({
      type: ContentGridProblemType.INTEGRITY_BLIND_RELATION_OVERWRITE,
      status: 409,
      title: "Would overwrite",
      new_item: "https://app/products/2",
      new_relation: "https://app/orders/1/product",
      existing_item: "https://app/products/1",
      existing_relation: "https://app/orders/2/product",
    });
    expect(toProblemDisplayModel(error)).toEqual({
      kind: "blindRelationOverwrite",
      status: 409,
      title: "Would overwrite",
      detail: undefined,
      type: ContentGridProblemType.INTEGRITY_BLIND_RELATION_OVERWRITE,
      newItem: "https://app/products/2",
      newRelation: "https://app/orders/1/product",
      existingItem: "https://app/products/1",
      existingRelation: "https://app/orders/2/product",
    });
  });

  it("maps a required-relation problem to kind: requiredRelation", () => {
    const error = new ProblemDetailError<RequiredRelationProblem>({
      type: ContentGridProblemType.INTEGRITY_REQUIRED_RELATION,
      status: 409,
      title: "Relation is required",
      affected_relation: "https://app/orders/1/customer",
    });
    expect(toProblemDisplayModel(error)).toEqual({
      kind: "requiredRelation",
      status: 409,
      title: "Relation is required",
      detail: undefined,
      type: ContentGridProblemType.INTEGRITY_REQUIRED_RELATION,
      affectedRelation: "https://app/orders/1/customer",
    });
  });

  it("falls back to kind: unknown for a typed-but-unmapped future problem type", () => {
    const error = new ProblemDetailError({
      type: "https://contentgrid.cloud/problems/some-future-problem",
      status: 418,
      title: "I'm a teapot",
    });
    expect(toProblemDisplayModel(error)).toEqual({
      kind: "unknown",
      status: 418,
      title: "I'm a teapot",
      detail: undefined,
      type: "https://contentgrid.cloud/problems/some-future-problem",
    });
  });
});
