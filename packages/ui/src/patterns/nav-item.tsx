import * as React from "react";
import { cn } from "../lib/utils";

interface NavItemProps {
  active?: boolean;
  label: string;
  icon?: React.ReactNode;
  iconColor?: string;
  count?: string | number;
  onClick?: () => void;
  className?: string;
}

function NavItem({
  active = false,
  label,
  icon,
  iconColor,
  count,
  onClick,
  className,
}: NavItemProps) {
  return (
    <button
      type="button"
      data-slot="nav-item"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-[10px] px-3 py-2 rounded-[6px] cursor-pointer w-full text-left transition-colors",
        active
          ? "bg-[rgba(1,155,227,0.12)] dark:bg-[rgba(90,196,242,0.14)] shadow-[inset_2px_0_0_#019BE3] dark:shadow-[inset_2px_0_0_#5AC4F2]"
          : "bg-transparent",
        className,
      )}
    >
      {icon && (
        <span
          className={cn("flex-shrink-0", !iconColor && "text-[#028FCE] dark:text-[#7CCDF4]")}
          style={iconColor ? { color: iconColor } : undefined}
        >
          {icon}
        </span>
      )}

      <span
        className={cn(
          "flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-[13px]",
          active ? "font-medium text-[#084772] dark:text-[#9FD8F5]" : "font-normal text-foreground",
        )}
      >
        {label}
      </span>

      {count !== undefined && (
        <span
          className={cn(
            "text-[12px] tabular-nums flex-shrink-0",
            active ? "text-[#557891] dark:text-[#9FD8F5]" : "text-muted-foreground",
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}

export { NavItem };
