import { toast } from "sonner";
import { toProblemDisplayModel } from "@contentgrid/navigator-data";

/**
 * Shows a failed request as an error toast, for actions that have no form or section left on
 * screen to show an inline `ProblemAlert` in. The message and description are the problem's
 * title and detail.
 */
export function notifyProblem(error: unknown) {
  const { title, detail } = toProblemDisplayModel(error);
  toast.error(title, { description: detail });
}
