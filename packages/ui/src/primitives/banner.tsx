import * as React from "react";
import { Info, PencilSimpleLine, Warning } from "@phosphor-icons/react";
import { cn } from "../lib/utils";

interface BannerProps {
  tone?: "info" | "edit" | "warning";
  text: string;
  icon?: React.ReactNode;
  className?: string;
}

const toneConfig = {
  info: {
    textClass: "text-[#084772] dark:text-[#7CCDF4]",
    bgClass: "bg-[rgba(1,155,227,0.08)] dark:bg-[rgba(90,196,242,0.12)]",
    borderClass: "border border-[rgba(1,155,227,0.3)] dark:border-[rgba(90,196,242,0.34)]",
    defaultIcon: <Info size={16} aria-hidden />,
    role: "status" as const,
  },
  edit: {
    textClass: "text-[#084772] dark:text-[#7CCDF4]",
    bgClass: "bg-[rgba(1,155,227,0.08)] dark:bg-[rgba(90,196,242,0.12)]",
    borderClass: "border border-[rgba(1,155,227,0.3)] dark:border-[rgba(90,196,242,0.34)]",
    defaultIcon: <PencilSimpleLine size={16} aria-hidden />,
    role: "status" as const,
  },
  warning: {
    textClass: "text-[#A4501F] dark:text-[#E89A63]",
    bgClass: "bg-[rgba(212,104,42,0.10)] dark:bg-[rgba(232,154,99,0.14)]",
    borderClass: "border border-[rgba(212,104,42,0.3)] dark:border-[rgba(232,154,99,0.34)]",
    defaultIcon: <Warning size={16} aria-hidden />,
    role: "alert" as const,
  },
};

function Banner({ tone = "info", text, icon, className }: BannerProps) {
  const config = toneConfig[tone];
  const renderedIcon = icon ?? config.defaultIcon;

  return (
    <div
      data-slot="banner"
      role={config.role}
      className={cn(
        "flex items-center gap-[9px] px-[14px] py-[10px] rounded-[8px] text-[13px]",
        config.textClass,
        config.bgClass,
        config.borderClass,
        className,
      )}
    >
      <span className="flex-shrink-0">{renderedIcon}</span>
      {text}
    </div>
  );
}

export { Banner };
