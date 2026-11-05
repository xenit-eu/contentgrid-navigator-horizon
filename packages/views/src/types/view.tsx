import type { ReactNode } from "react";

export interface ViewToolbarOptions {
  readonly actions?: ReactNode;
}
/** `undefined`/`{}` draws the view's default toolbar; `false` draws none (the host draws its own). */
export type ViewToolbarConfiguration = ViewToolbarOptions | false | undefined;

export interface ViewProps {
  readonly toolbar?: ViewToolbarConfiguration;
}
