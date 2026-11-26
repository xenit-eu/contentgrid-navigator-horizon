import { FileIcon, ImageIcon } from "@phosphor-icons/react";

export interface FileTileProps {
  /** MIME type of the file, to choose between the image and the generic file icon. */
  readonly mimetype?: string;
  /** `"md"` is the 30px tile of a collection row's title, `"sm"` the 24px one of a file column. */
  readonly size?: "sm" | "md";
  readonly className?: string;
}

/**
 * A small rounded tile with a file icon. One neutral colour for every file type (and for an
 * item without a file): the icon alone tells an image from other files.
 */
export function FileTile({ mimetype, size = "md", className }: Readonly<FileTileProps>) {
  const Icon = mimetype?.startsWith("image/") ? ImageIcon : FileIcon;
  return (
    <span
      data-slot="file-tile"
      aria-hidden
      className={`grid shrink-0 place-items-center rounded-[7px] bg-accent text-primary dark:text-foreground ${
        size === "md" ? "size-[30px]" : "size-6"
      } ${className ?? ""}`}
    >
      <Icon className={size === "md" ? "size-4" : "size-[13px]"} />
    </span>
  );
}
