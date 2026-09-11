import {
  ContentGridProblemType,
  isProblemOfType,
  toProblemDisplayModel,
} from "@contentgrid/navigator-data";
import { toast } from "@contentgrid/ui";

/**
 * 412 (unsatisfied-version) means the item was modified concurrently — the
 * platform's documented recovery is re-fetch, re-apply, retry. Surface that
 * as a toast with a one-click reload instead of relying on the inline alert
 * alone. The toast copy comes from the same display-model bridge every other
 * problem-detail renderer uses — title as the message, detail as the
 * description — rather than a hardcoded string.
 */
export function notifyReloadOnUnsatisfiedVersion(error: unknown, reload: () => void) {
  if (!isProblemOfType(error, ContentGridProblemType.UNSATISFIED_VERSION)) {
    return;
  }

  const { title, detail } = toProblemDisplayModel(error);
  toast.error(title, {
    description: detail,
    action: { label: "Reload", onClick: reload },
  });
}
