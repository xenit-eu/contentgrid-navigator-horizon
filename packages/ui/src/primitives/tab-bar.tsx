import * as React from "react";
import { Slot } from "radix-ui";
import { cn } from "../lib/utils";
import { IconBadge } from "./icon-badge";

function TabBar({
  className,
  orientation = "horizontal",
  ...props
}: React.ComponentProps<"div"> & { orientation?: "horizontal" | "vertical" }) {
  return (
    <div
      data-slot="tab-bar"
      role="tablist"
      aria-orientation={orientation}
      data-orientation={orientation}
      className={cn(
        "flex items-center gap-1 border-b data-[orientation=vertical]:flex-col data-[orientation=vertical]:items-stretch data-[orientation=vertical]:border-r data-[orientation=vertical]:border-b-0",
        className,
      )}
      {...props}
    />
  );
}

function TabLink({
  className,
  style,
  active = false,
  asChild = false,
  icon,
  iconColor,
  iconMuted = false,
  children,
  ...props
}: React.ComponentProps<"a"> & {
  active?: boolean;
  asChild?: boolean;
  /** Icon element rendered in an `IconBadge` before the label, e.g. a Phosphor icon. */
  icon?: React.ReactNode;
  /** `IconBadge` background color — also used for the active left border. Falls back to
   * the theme's muted color when omitted. */
  iconColor?: string;
  /** Blends the icon badge into a soft, semi-transparent fill instead of a solid one. */
  iconMuted?: boolean;
}) {
  const Comp = asChild ? Slot.Root : "a";
  const label = asChild ? <Slot.Slottable>{children}</Slot.Slottable> : children;

  return (
    <Comp
      data-slot="tab-link"
      role="tab"
      aria-selected={active}
      aria-current={active ? "page" : undefined}
      data-active={active}
      style={active && iconColor ? { ...style, borderLeftColor: iconColor } : style}
      className={cn(
        "text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 rounded-md border-l-2 border-l-transparent whitespace-nowrap px-3 py-2 text-sm font-medium transition-colors outline-none",
        "focus-visible:ring-ring/50 focus-visible:ring-[3px]",
        "data-[active=true]:bg-[rgba(1,155,227,0.12)] dark:data-[active=true]:bg-[rgba(90,196,242,0.14)]",
        "data-[active=true]:text-foreground",
        icon && "data-[active=true]:border-l-primary",
        "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}
    >
      {icon && <IconBadge icon={icon} color={iconColor} muted={iconMuted} variant="sm" />}
      {label}
    </Comp>
  );
}

function TabContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="tab-content"
      role="tabpanel"
      tabIndex={-1}
      className={cn("flex-1 pt-4 outline-none", className)}
      {...props}
    />
  );
}

export { TabBar, TabLink, TabContent };
