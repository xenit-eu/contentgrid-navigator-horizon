import type { ReactNode } from "react";

export interface EntityItemCollectionEmptyBlockProps {
  /** The icon inside the tile, drawn 28px (board 25's `xl`). */
  readonly icon: ReactNode;
  readonly title: string;
  readonly description: string;
  /** The action under the text, if the state offers one. */
  readonly children?: ReactNode;
}

/**
 * Board 25's centred notice: a dashed icon tile, a bold line, a short text and, optionally, one
 * button. It sits in the page's normal flow under the title (and the search bar, when that
 * shows), not centred in the height.
 */
export function EntityItemCollectionEmptyBlock({
  icon,
  title,
  description,
  children,
}: Readonly<EntityItemCollectionEmptyBlockProps>) {
  return (
    <div className="flex flex-col items-center gap-2.5 px-6 py-14 text-center text-(--text-dim) dark:text-muted-foreground">
      <span
        aria-hidden
        className="grid size-14 place-items-center rounded-[14px] border-[1.5px] border-dashed border-(--sky-tint-line) bg-(--sky-50) text-(--ocean) dark:border-primary/40 dark:bg-primary/10 dark:text-primary [&_svg]:size-7"
      >
        {icon}
      </span>
      <h2 className="text-[17px] font-bold text-foreground">{title}</h2>
      <p className="max-w-[44ch] text-[13.5px]">{description}</p>
      {children}
    </div>
  );
}

/** Board 25's buttons, over the shared Button: 36px high, 14px sides, 8px radius, 13.5px semibold. */
export const EMPTY_BLOCK_BUTTON_CLASS =
  "h-9 gap-2 rounded-sm px-3.5 text-[13.5px] font-semibold has-[>svg]:px-3.5";
