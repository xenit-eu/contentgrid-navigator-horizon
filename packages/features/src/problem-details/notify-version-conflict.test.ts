import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ContentGridProblemType,
  ProblemDetailError,
  type UnsatisfiedVersionProblem,
} from "@contentgrid/navigator-data";
import { toast } from "@contentgrid/ui";
import { notifyReloadOnUnsatisfiedVersion } from "./notify-version-conflict";

// notifyReloadOnUnsatisfiedVersion calls @contentgrid/ui's `toast`, which is
// sonner's `toast` re-exported as-is (packages/ui/src/primitives/sonner.tsx).
// Mock only `toast` — every other @contentgrid/ui export stays real.
vi.mock("@contentgrid/ui", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@contentgrid/ui")>();
  return {
    ...actual,
    toast: { error: vi.fn() },
  };
});

type CapturedToastOptions = {
  readonly description?: string;
  readonly action?: { readonly label: string; readonly onClick: () => void };
};

function unsatisfiedVersionError(title: string, detail: string) {
  return new ProblemDetailError<UnsatisfiedVersionProblem>({
    type: ContentGridProblemType.UNSATISFIED_VERSION,
    status: 412,
    title,
    detail,
    actual_version: 'W/"2"',
  });
}

describe("notifyReloadOnUnsatisfiedVersion", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("fires exactly one toast built from the display-model title/detail, with a Reload action", () => {
    const reload = vi.fn();
    const error = unsatisfiedVersionError(
      "Version conflict",
      "This item was changed by someone else.",
    );

    notifyReloadOnUnsatisfiedVersion(error, reload);

    expect(toast.error).toHaveBeenCalledOnce();

    const [message, options] = vi.mocked(toast.error).mock.calls[0];
    const { description, action } = options as CapturedToastOptions;
    expect(message).toBe("Version conflict");
    expect(description).toBe("This item was changed by someone else.");
    expect(action?.label).toBe("Reload");

    action?.onClick();
    expect(reload).toHaveBeenCalledOnce();
  });

  it("does not toast for a non-412 error", () => {
    const reload = vi.fn();

    notifyReloadOnUnsatisfiedVersion(new Error("network down"), reload);

    expect(toast.error).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
  });
});
