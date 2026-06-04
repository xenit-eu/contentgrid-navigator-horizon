import {
  type ProblemDetail,
  ProblemDetailError,
  checkResponse,
} from "@contentgrid/problem-details";

export { checkResponse, ProblemDetailError };
export type { ProblemDetail };

export interface FieldError {
  field: string;
  message: string;
}

export function extractFieldErrors(error: unknown): FieldError[] {
  if (error instanceof ProblemDetailError) {
    const pd = error.problemDetail as ProblemDetail & {
      errors?: Array<{ field: string; message: string }>;
    };
    return pd.errors ?? [];
  }
  return [];
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof ProblemDetailError) {
    return error.problemDetail.detail ?? error.problemDetail.title;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "An unexpected error occurred";
}
