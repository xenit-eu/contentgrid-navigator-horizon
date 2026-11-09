import { toast } from "sonner";
import { toProblemDisplayModel } from "@contentgrid/navigator-data";

/**
 * Shows a failed request as an error toast, for actions that have no form or section left on
 * screen to show an inline `ProblemAlert` in. The message and description are the problem's
 * title and detail. When the item was changed by someone else (412) and `onRefresh` is given,
 * the toast offers a Reload action so the user can retry against the latest version.
 */
export function notifyProblem(error: unknown, onRefresh?: () => void) {
  const model = toProblemDisplayModel(error);
  const canReload = model.kind === "unsatisfiedVersion" && onRefresh !== undefined;

  toast.error(model.title, {
    description: model.detail,
    action: canReload ? { label: "Reload", onClick: onRefresh } : undefined,
  });
}
