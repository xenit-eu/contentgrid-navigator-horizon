import {
  FilePdfIcon as FilePdf,
  FileTextIcon as FileText,
  ImageIcon as Image,
} from "@phosphor-icons/react";
import { cn } from "../lib/utils";

interface FileIconProps {
  readonly type?: "pdf" | "img" | "doc";
  readonly size?: number;
  readonly className?: string;
}

const typeConfig = {
  pdf: {
    bgClass: "bg-[#FBE9DC] dark:bg-[rgba(212,84,29,0.22)]",
    fgClass: "text-[#C2541D] dark:text-[#EFA07A]",
    Icon: FilePdf,
  },
  img: {
    bgClass: "bg-[#B3E8FF] dark:bg-[rgba(90,196,242,0.20)]",
    fgClass: "text-[#0173A8] dark:text-[#7CCDF4]",
    Icon: Image,
  },
  doc: {
    bgClass: "bg-[#F2F7FB] dark:bg-[rgba(166,192,208,0.16)]",
    fgClass: "text-[#557891] dark:text-[#A6C0D0]",
    Icon: FileText,
  },
};

function FileIcon({ type = "doc", size = 30, className }: FileIconProps) {
  const config = typeConfig[type];
  const { Icon } = config;
  const iconSize = Math.round(size * 0.47);

  return (
    <span
      data-slot="file-icon"
      style={{ width: size, height: size }}
      className={cn(
        "inline-grid place-items-center rounded-[6px] flex-shrink-0",
        config.bgClass,
        config.fgClass,
        className,
      )}
    >
      <Icon size={iconSize} aria-hidden />
    </span>
  );
}

export { FileIcon };
