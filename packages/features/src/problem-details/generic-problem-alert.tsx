import type { ProblemDisplayModel } from "@contentgrid/navigator-data";
import { ProblemAlertFrame } from "./problem-alert-frame";

export interface GenericProblemAlertProps {
  readonly model: Extract<
    ProblemDisplayModel,
    { kind: "queryParameter" | "requestBody" | "header" | "notFound" | "unknown" }
  >;
  readonly className?: string;
  /** Renders a dismiss button and fires this when clicked. */
  readonly onClose?: () => void;
}

/**
 * Fallback renderer for problem kinds with nothing actionable to hand back to
 * the caller beyond a documentation link: malformed query params,
 * request-body problems, header problems, not-found responses, and
 * opaque/unrecognized problems (masked 403, Spring 500, a plain `Error`, or a
 * future problem type this package hasn't been updated to model).
 */
export function GenericProblemAlert({
  model,
  className,
  onClose,
}: Readonly<GenericProblemAlertProps>) {
  return (
    <ProblemAlertFrame
      status={model.status}
      title={model.title}
      detail={model.detail}
      type={model.type}
      onClose={onClose}
      className={className}
    />
  );
}
