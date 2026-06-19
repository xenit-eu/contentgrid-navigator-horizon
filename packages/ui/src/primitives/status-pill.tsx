import * as React from "react";
import { CheckCircle, Circle, Clock, XCircle } from "@phosphor-icons/react";
import { cn } from "../lib/utils";

interface StatusPillProps {
  status?: "success" | "danger" | "warning" | "neutral";
  label: string;
  icon?: React.ReactNode;
  className?: string;
}

const statusConfig = {
  success: {
    textClass: "text-[#2F7A55] dark:text-[#6FD3A1]",
    bgClass: "bg-[rgba(47,122,85,0.10)] dark:bg-[rgba(111,211,161,0.16)]",
    defaultIcon: <CheckCircle size={14} aria-hidden />,
  },
  danger: {
    textClass: "text-[#B3261E] dark:text-[#F2877F]",
    bgClass: "bg-[rgba(179,38,30,0.08)] dark:bg-[rgba(242,135,127,0.16)]",
    defaultIcon: <XCircle size={14} aria-hidden />,
  },
  warning: {
    textClass: "text-[#A4501F] dark:text-[#E89A63]",
    bgClass: "bg-[rgba(212,104,42,0.12)] dark:bg-[rgba(232,154,99,0.18)]",
    defaultIcon: <Clock size={14} aria-hidden />,
  },
  neutral: {
    textClass: "text-[#557891] dark:text-[#A6C0D0]",
    bgClass: "bg-[rgba(85,120,145,0.12)] dark:bg-[rgba(166,192,208,0.16)]",
    defaultIcon: <Circle size={14} aria-hidden />,
  },
};

function StatusPill({ status = "neutral", label, icon, className }: StatusPillProps) {
  const config = statusConfig[status];
  const renderedIcon = icon ?? config.defaultIcon;

  return (
    <span
      data-slot="status-pill"
      className={cn(
        "inline-flex items-center gap-[5px] px-[11px] py-1 rounded-full text-[12px] font-semibold",
        config.textClass,
        config.bgClass,
        className,
      )}
    >
      {renderedIcon}
      {label}
    </span>
  );
}

export { StatusPill };
