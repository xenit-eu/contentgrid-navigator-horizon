import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useControllableState } from "./use-controllable-state";

interface Counter {
  readonly a?: number;
  readonly b?: number;
}

const DEFAULT: Counter = {};

describe("useControllableState", () => {
  it("builds a second controlled update in the same tick on the first", () => {
    const onStateChange = vi.fn();
    const { result } = renderHook(() =>
      useControllableState<Counter>({ state: DEFAULT, onStateChange, defaultState: DEFAULT }),
    );

    act(() => {
      result.current[1]((previous) => ({ ...previous, a: 1 }));
      result.current[1]((previous) => ({ ...previous, b: 2 }));
    });

    expect(onStateChange).toHaveBeenNthCalledWith(1, { a: 1 });
    expect(onStateChange).toHaveBeenNthCalledWith(2, { a: 1, b: 2 });
  });

  it("does not keep a change the host ignored after the tick", async () => {
    const onStateChange = vi.fn();
    const { result } = renderHook(() =>
      useControllableState<Counter>({ state: DEFAULT, onStateChange, defaultState: DEFAULT }),
    );

    act(() => result.current[1]((previous) => ({ ...previous, a: 1 })));
    await act(async () => {
      await Promise.resolve();
    });
    act(() => result.current[1]((previous) => ({ ...previous, b: 2 })));

    expect(onStateChange).toHaveBeenLastCalledWith({ b: 2 });
  });

  it("renders the host's state, or the default while controlled without a state", () => {
    const onStateChange = vi.fn();
    const { result, rerender } = renderHook(
      ({ state }: { state: Counter | undefined }) =>
        useControllableState<Counter>({ state, onStateChange, defaultState: { a: 9 } }),
      { initialProps: { state: undefined as Counter | undefined } },
    );
    expect(result.current[0]).toEqual({ a: 9 });

    rerender({ state: { b: 3 } });
    expect(result.current[0]).toEqual({ b: 3 });
  });

  it("accumulates uncontrolled updates in the same tick", () => {
    const { result } = renderHook(() =>
      useControllableState<Counter>({
        state: undefined,
        onStateChange: undefined,
        defaultState: DEFAULT,
      }),
    );

    act(() => {
      result.current[1]((previous) => ({ ...previous, a: 1 }));
      result.current[1]((previous) => ({ ...previous, b: 2 }));
    });

    expect(result.current[0]).toEqual({ a: 1, b: 2 });
  });

  it("keeps the same update function across renders and state changes", () => {
    const { result, rerender } = renderHook(
      ({ state }: { state: Counter }) =>
        useControllableState<Counter>({ state, onStateChange: vi.fn(), defaultState: DEFAULT }),
      { initialProps: { state: {} as Counter } },
    );
    const first = result.current[1];

    rerender({ state: { a: 1 } });

    expect(result.current[1]).toBe(first);
  });
});
