import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { BooleanQuickFilter as BooleanQuickFilterModel } from "../util/build-quick-filters";
import { BooleanQuickFilter } from "./boolean-quick-filter";

function model(value: boolean | undefined): BooleanQuickFilterModel {
  return {
    kind: "boolean",
    groupKey: "urgent",
    label: "Urgent",
    param: "urgent",
    paramNames: ["urgent"],
    value,
    isActive: value !== undefined,
    tone: value === undefined ? "idle" : value ? "positive" : "negative",
  };
}

/** Mirrors the hook's cycle so the test exercises the full click sequence. */
function Harness({ onChange }: { onChange: (value: boolean | undefined) => void }) {
  const [value, setValue] = useState<boolean | undefined>(undefined);
  return (
    <BooleanQuickFilter
      quickFilter={model(value)}
      onCycle={() => {
        const next = value === undefined ? true : value ? false : undefined;
        setValue(next);
        onChange(next);
      }}
      onClear={() => setValue(undefined)}
    />
  );
}

const tone = () => document.querySelector("[data-slot='filter-button']")?.getAttribute("data-tone");

describe("BooleanQuickFilter", () => {
  it("cycles unset → true → false → unset, with grey, green, red outlines", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    expect(tone()).toBe("idle");

    await user.click(screen.getByRole("button", { name: /Urgent: any/ }));
    expect(onChange).toHaveBeenLastCalledWith(true);
    expect(tone()).toBe("positive");
    expect(screen.getByRole("button", { name: /Urgent: true/ })).toHaveTextContent("Urgent: True");

    await user.click(screen.getByRole("button", { name: /Urgent: true/ }));
    expect(onChange).toHaveBeenLastCalledWith(false);
    expect(tone()).toBe("negative");

    await user.click(screen.getByRole("button", { name: /Urgent: false/ }));
    expect(onChange).toHaveBeenLastCalledWith(undefined);
    expect(tone()).toBe("idle");
  });

  it("opens no popover", async () => {
    const user = userEvent.setup();
    render(
      <BooleanQuickFilter quickFilter={model(undefined)} onCycle={vi.fn()} onClear={vi.fn()} />,
    );
    await user.click(screen.getByRole("button", { name: /Urgent/ }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("clears a set value with its ×", async () => {
    const user = userEvent.setup();
    const onClear = vi.fn();
    render(<BooleanQuickFilter quickFilter={model(true)} onCycle={vi.fn()} onClear={onClear} />);
    await user.click(screen.getByRole("button", { name: "Clear Urgent filter" }));
    expect(onClear).toHaveBeenCalledWith("urgent");
  });
});
